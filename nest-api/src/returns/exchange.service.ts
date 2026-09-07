import { Injectable, Inject, BadRequestException, Logger, forwardRef } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { orders, orderItems, returnRequests, returnRequestItems, variants, products, users } from '../database/schema';
import { InventoryService } from '../inventory/inventory.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { getOrderSlug } from '../common/utils/slug.util';
import { calculateItemTax } from '../common/utils/tax.util';

@Injectable()
export class ExchangeService {
  private readonly logger = new Logger(ExchangeService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private inventoryService: InventoryService,
    private notificationsService: NotificationsService,
    private mailService: MailService,
  ) {}

  /**
   * Generates a replacement order for an approved & QC-passed exchange request.
   */
  async processReplacementOrder(returnRequestId: number, adminId?: number | null): Promise<any> {
    const ret = await this.db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, returnRequestId),
      with: {
        order: true,
        user: true,
        items: {
          with: {
            product: true,
            variant: true,
            exchangeVariant: true,
          } as any,
        },
      } as any,
    });

    if (!ret) throw new BadRequestException(`Return Request #${returnRequestId} not found`);
    if (ret.returnType !== 'exchange') throw new BadRequestException(`Return Request #${ret.returnNumber} is not an exchange request`);
    if (ret.qcStatus !== 'passed') throw new BadRequestException(`QC must be passed before creating replacement order for #${ret.returnNumber}`);
    if (ret.replacementOrderId) throw new BadRequestException(`Replacement order has already been generated for #${ret.returnNumber}`);

    const originalOrder = (ret as any).order;
    const customer = (ret as any).user;
    const items = (ret as any).items || [];

    const shippingAddressStr = typeof ret.pickupAddress === 'string'
      ? ret.pickupAddress
      : ret.pickupAddress
        ? JSON.stringify(ret.pickupAddress)
        : (originalOrder?.shippingAddress || '');

    const replacementOrderNumber = `ORD-EXC-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    // Prepare replacement items & deduct inventory
    const replacementItemsData: any[] = [];
    let subtotal = 0;

    for (const item of items) {
      const targetVariantId = item.exchangeVariantId || item.variantId;
      const targetVar = await this.db.query.variants.findFirst({
        where: eq(variants.id, targetVariantId),
      });

      if (!targetVar || targetVar.status === false) {
        throw new BadRequestException(`Replacement variant #${targetVariantId} is unavailable`);
      }

      if (targetVar.stock < item.quantity) {
        throw new BadRequestException(`Insufficient stock for replacement variant "${targetVar.title || targetVar.sku}". Available: ${targetVar.stock}, Requested: ${item.quantity}`);
      }

      // Deduct stock for replacement variant
      await this.inventoryService.adjustStock(
        item.productId,
        targetVariantId,
        -item.quantity,
        'sale',
        `Dispatched as replacement for Exchange Return #${ret.returnNumber}`,
        {
          returnRequestId: ret.id,
          createdBy: adminId,
        },
      );

      const itemPrice = parseFloat(targetVar.sp as string);
      const itemTotal = itemPrice * item.quantity;
      subtotal += itemTotal;
      const itemTax = calculateItemTax(item.product, itemTotal, shippingAddressStr);

      replacementItemsData.push({
        productId: item.productId,
        variantId: targetVariantId,
        quantity: item.quantity,
        price: itemPrice.toFixed(2),
        total: itemTotal.toFixed(2),
        selectedAttributes: targetVar.title ? { Variant: targetVar.title } : null,
        hsn: itemTax.hsn,
        taxRate: itemTax.taxRate,
        taxableAmount: itemTax.taxableAmount,
        taxAmount: itemTax.taxAmount,
        cgstRate: itemTax.cgstRate,
        cgstAmount: itemTax.cgstAmount,
        sgstRate: itemTax.sgstRate,
        sgstAmount: itemTax.sgstAmount,
        igstRate: itemTax.igstRate,
        igstAmount: itemTax.igstAmount,
      });
    }

    // Create Replacement Order in DB
    const [result]: any = await this.db.insert(orders).values({
      orderNumber: replacementOrderNumber,
      userId: ret.userId,
      status: 'confirmed',
      paymentMethod: originalOrder.paymentMethod,
      paymentStatus: 'paid', // Pre-credited from original returned item
      transactionId: `EXC-CREDIT-${ret.returnNumber}`,
      subtotal: subtotal.toFixed(2),
      shippingFee: '0.00',
      tax: '0.00',
      total: subtotal.toFixed(2),
      shippingAddress: shippingAddressStr,
      billingAddress: originalOrder.billingAddress || shippingAddressStr,
      notes: `Replacement Order for Exchange #${ret.returnNumber} (Original Order: #${originalOrder.orderNumber})`,
      createdAt: new Date(),
    });

    const newOrderId = result.insertId;

    for (const rItem of replacementItemsData) {
      await this.db.insert(orderItems).values({
        orderId: newOrderId,
        productId: rItem.productId,
        variantId: rItem.variantId,
        quantity: rItem.quantity,
        price: rItem.price,
        total: rItem.total,
        selectedAttributes: rItem.selectedAttributes,
        hsn: rItem.hsn,
        taxRate: rItem.taxRate,
        taxableAmount: rItem.taxableAmount,
        taxAmount: rItem.taxAmount,
        cgstRate: rItem.cgstRate,
        cgstAmount: rItem.cgstAmount,
        sgstRate: rItem.sgstRate,
        sgstAmount: rItem.sgstAmount,
        igstRate: rItem.igstRate,
        igstAmount: rItem.igstAmount,
        createdAt: new Date(),
      });
    }

    // Update return request with replacement order link
    await this.db.update(returnRequests).set({
      replacementOrderId: newOrderId,
      status: 'completed',
      updatedAt: new Date(),
    }).where(eq(returnRequests.id, ret.id));

    this.logger.log(`Created replacement Order #${replacementOrderNumber} (ID: ${newOrderId}) for Exchange #${ret.returnNumber}`);

    // Notify customer
    if (ret.userId) {
      const orderSlug = getOrderSlug({ id: newOrderId, orderNumber: replacementOrderNumber });
      this.notificationsService.createAndEmitNotification({
        userId: ret.userId,
        title: '🔄 Exchange Order Created',
        message: `Your replacement order #${replacementOrderNumber} for Exchange #${ret.returnNumber} has been confirmed and is being prepared for dispatch.`,
        type: 'ORDER_PLACED',
        priority: 'HIGH',
        entityType: 'order',
        entityId: newOrderId,
        referenceKey: `EXCHANGE_REPLACEMENT_${ret.id}_${newOrderId}`,
        link: `/orders/${orderSlug}/tracking`,
      }).catch(() => {});
    }

    return {
      success: true,
      message: 'Replacement order created successfully',
      replacementOrderId: newOrderId,
      replacementOrderNumber,
    };
  }
}
