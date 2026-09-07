import { Injectable, Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { eq, and, notInArray, inArray, or } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { orders, orderItems, returnRequests, returnRequestItems, products, variants } from '../database/schema';

export const RETURN_WINDOW_DAYS = 7;

export const ALLOWED_RETURN_REASONS = [
  { id: 'defective_damaged', label: 'Item is defective or damaged' },
  { id: 'wrong_item_received', label: 'Received wrong item or size' },
  { id: 'size_fit_issue', label: 'Size / Fit issue (Too tight / Too loose)' },
  { id: 'quality_not_expected', label: 'Quality not as expected' },
  { id: 'different_from_description', label: 'Product looks different from website description' },
  { id: 'missing_parts', label: 'Missing accessories or parts' },
  { id: 'product_not_as_expected', label: 'Fabric / Material not as expected' },
  { id: 'other', label: 'Other reason' },
];

@Injectable()
export class ReturnEligibilityService {
  private readonly logger = new Logger(ReturnEligibilityService.name);

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  /**
   * Helper to find order by ID, orderNumber, or invoiceNumber
   */
  async findOrderByIdentifier(identifier: number | string): Promise<any> {
    const raw = String(identifier).trim();
    if (!isNaN(Number(raw)) && /^\d+$/.test(raw)) {
      const byId = await this.db.query.orders.findFirst({
        where: eq(orders.id, Number(raw)),
        with: {
          user: true,
          orderItems: {
            with: { product: true, variant: true } as any,
          },
        } as any,
      });
      if (byId) return byId;
    }

    return await this.db.query.orders.findFirst({
      where: or(
        eq(orders.orderNumber, raw),
        eq(orders.invoiceNumber, raw),
        eq(orders.delhiveryWaybill, raw),
      ),
      with: {
        user: true,
        orderItems: {
          with: { product: true, variant: true } as any,
        },
      } as any,
    });
  }

  /**
   * Checks full eligibility of an order and its individual items for Return/Exchange.
   */
  async checkEligibility(orderIdentifier: number | string, requestingUserId?: number): Promise<any> {
    const order = await this.findOrderByIdentifier(orderIdentifier);
    if (!order) {
      throw new NotFoundException(`Order #${orderIdentifier} not found`);
    }

    // Ownership check (unless admin check without userId)
    if (requestingUserId && Number(order.userId) !== Number(requestingUserId)) {
      throw new BadRequestException('You are not authorized to access return eligibility for this order.');
    }

    const orderStatus = (order.status || '').toLowerCase();
    const delhiveryStatus = (order.delhiveryStatus || '').toLowerCase();
    const isDelivered = orderStatus === 'delivered' || orderStatus === 'completed' || delhiveryStatus.includes('delivered');

    if (!isDelivered) {
      return {
        eligible: false,
        reason: 'Return/Exchange can only be requested once the order has been delivered by courier.',
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        remainingDays: 0,
        items: [],
      };
    }

    // Determine delivery reference time
    const deliveryDate = order.deliveredAt || order.delhiveryStatusUpdatedAt || order.updatedAt || order.createdAt;
    const deliveryTimestamp = new Date(deliveryDate).getTime();
    const nowTimestamp = Date.now();
    const daysSinceDelivery = (nowTimestamp - deliveryTimestamp) / (1000 * 60 * 60 * 24);
    const remainingDays = Math.max(0, Math.ceil(RETURN_WINDOW_DAYS - daysSinceDelivery));
    const isWindowActive = daysSinceDelivery <= RETURN_WINDOW_DAYS;

    if (!isWindowActive) {
      return {
        eligible: false,
        reason: `The ${RETURN_WINDOW_DAYS}-day return policy window for this order has expired.`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        deliveredAt: deliveryDate,
        returnWindowDays: RETURN_WINDOW_DAYS,
        remainingDays: 0,
        items: [],
      };
    }

    // Fetch existing return requests for this order to calculate previously returned item quantities
    const existingReturns = await this.db.query.returnRequests.findMany({
      where: and(
        eq(returnRequests.orderId, order.id),
        notInArray(returnRequests.status, ['rejected', 'cancelled']),
      ),
      with: {
        items: true,
      } as any,
    });

    // Map already requested/returned quantities by orderItemId
    const returnedQtyMap = new Map<number, number>();
    for (const ret of existingReturns) {
      const retItems = (ret as any).items || [];
      for (const item of retItems) {
        const prev = returnedQtyMap.get(item.orderItemId) || 0;
        returnedQtyMap.set(item.orderItemId, prev + item.quantity);
      }
    }

    const itemsResult: any[] = [];
    let hasAnyEligibleItem = false;

    const rawOrderItems = (order as any).orderItems || [];
    for (const item of rawOrderItems) {
      const deliveredQty = Number(item.quantity);
      const alreadyReturnedQty = returnedQtyMap.get(item.id) || 0;
      const availableReturnQty = Math.max(0, deliveredQty - alreadyReturnedQty);
      const isItemEligible = availableReturnQty > 0;

      if (isItemEligible) {
        hasAnyEligibleItem = true;
      }

      // Fetch exchange variants (other active variants of the same product with stock > 0)
      const otherVariants = await this.db.query.variants.findMany({
        where: and(
          eq(variants.productId, item.productId),
          eq(variants.status, true),
        ),
      });

      const exchangeVariants = otherVariants
        .filter((v: any) => v.id !== item.variantId && v.stock > 0 && v.deletedAt === null)
        .map((v: any) => ({
          variantId: v.id,
          title: v.title,
          sku: v.sku,
          stock: v.stock,
          price: v.sp,
          imageUrl: v.imageUrl,
        }));

      itemsResult.push({
        orderItemId: item.id,
        productId: item.productId,
        productName: item.product?.name || 'Product',
        variantId: item.variantId,
        variantTitle: item.variant?.title || '',
        sku: item.variant?.sku || '',
        imageUrl: item.variant?.imageUrl || item.product?.imageUrl || null,
        unitPrice: parseFloat(item.price as string),
        totalPrice: parseFloat(item.total as string),
        selectedAttributes: item.selectedAttributes,
        deliveredQuantity: deliveredQty,
        alreadyReturnedQuantity: alreadyReturnedQty,
        availableReturnQuantity: availableReturnQty,
        isEligible: isItemEligible,
        exchangeVariants,
      });
    }

    return {
      eligible: hasAnyEligibleItem,
      reason: hasAnyEligibleItem ? null : 'All items in this order have already been returned or are under active return requests.',
      orderId: order.id,
      orderNumber: order.orderNumber,
      invoiceNumber: order.invoiceNumber,
      deliveredAt: deliveryDate,
      paymentMethod: order.paymentMethod,
      returnWindowDays: RETURN_WINDOW_DAYS,
      remainingDays,
      allowedReasons: ALLOWED_RETURN_REASONS,
      items: itemsResult,
    };
  }
}
