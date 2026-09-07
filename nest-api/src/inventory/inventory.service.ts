import { Injectable, Inject, BadRequestException, Logger, forwardRef } from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { variants, products, inventoryTransactions, returnRequests, returnRequestItems, rtoCases, orders, orderItems } from '../database/schema';
import { ProductsGateway } from '../products/products.gateway';
import { ProductsService } from '../products/products.service';

export type InventoryTransactionType =
  | 'sale'
  | 'cancelled_order'
  | 'rto_restock'
  | 'return_restock'
  | 'return_damaged'
  | 'rto_damaged'
  | 'manual_adjustment';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    @Inject(forwardRef(() => ProductsService)) private productsService: ProductsService,
    private productsGateway: ProductsGateway,
  ) {}

  /**
   * Transactionally adjust inventory for a single variant and log transaction.
   */
  async adjustStock(
    productId: number,
    variantId: number,
    quantityDelta: number,
    transactionType: InventoryTransactionType,
    reason: string,
    options: {
      orderId?: number | null;
      returnRequestId?: number | null;
      rtoCaseId?: number | null;
      createdBy?: number | null;
      notes?: string | null;
    } = {},
  ): Promise<{ previousQuantity: number; newQuantity: number }> {
    const freshVar = await this.db.query.variants.findFirst({
      where: eq(variants.id, variantId),
    });

    if (!freshVar) {
      throw new BadRequestException(`Variant #${variantId} not found for inventory adjustment`);
    }

    const previousQuantity = Number(freshVar.stock ?? 0);
    const newQuantity = previousQuantity + quantityDelta;

    if (newQuantity < 0 && quantityDelta < 0) {
      throw new BadRequestException(`Insufficient stock for Variant #${variantId}. Current: ${previousQuantity}, Requested reduction: ${Math.abs(quantityDelta)}`);
    }

    // 1. Update Variant Stock in DB
    await this.db.update(variants).set({
      stock: newQuantity,
      updatedAt: new Date(),
    }).where(eq(variants.id, variantId));

    // 2. Record Immutable Inventory Transaction Log
    await this.db.insert(inventoryTransactions).values({
      productId: Number(productId),
      variantId: Number(variantId),
      orderId: options.orderId ? Number(options.orderId) : null,
      returnRequestId: options.returnRequestId ? Number(options.returnRequestId) : null,
      rtoCaseId: options.rtoCaseId ? Number(options.rtoCaseId) : null,
      transactionType,
      quantity: quantityDelta,
      previousQuantity,
      newQuantity,
      reason,
      notes: options.notes || null,
      createdBy: options.createdBy ? Number(options.createdBy) : null,
      createdAt: new Date(),
    });

    this.logger.log(
      `[Inventory] Variant #${variantId} stock updated: ${previousQuantity} -> ${newQuantity} (${quantityDelta >= 0 ? '+' : ''}${quantityDelta}) [Type: ${transactionType}]`,
    );

    // 3. Real-time broadcast to all connected clients
    try {
      const fullProd = await this.db.query.products.findFirst({
        where: eq(products.id, productId),
        with: { variants: true, brand: true, category: true } as any,
      });

      if (fullProd) {
        const formatted = this.productsService?.formatProduct ? this.productsService.formatProduct(fullProd) : fullProd;
        this.productsGateway.emitProductStockUpdated({
          productId: Number(productId),
          variantId: Number(variantId),
          stock: Number(newQuantity),
          totalStock: ((fullProd as any).variants || []).reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0),
          product: formatted,
        });
      }
    } catch (err: any) {
      this.logger.warn(`Could not broadcast inventory update: ${err.message}`);
    }

    return { previousQuantity, newQuantity };
  }

  /**
   * Restock items from an approved & QC-passed customer return request.
   */
  async restockReturnRequest(returnRequestId: number, adminId?: number | null): Promise<void> {
    const ret = await this.db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, returnRequestId),
      with: { items: true } as any,
    });

    if (!ret) throw new BadRequestException(`Return Request #${returnRequestId} not found`);

    // Check if already restocked
    const existingRestock = await this.db.query.inventoryTransactions.findFirst({
      where: and(
        eq(inventoryTransactions.returnRequestId, returnRequestId),
        eq(inventoryTransactions.transactionType, 'return_restock'),
      ),
    });

    if (existingRestock) {
      throw new BadRequestException(`Return Request #${ret.returnNumber} has already been restocked.`);
    }

    const items = (ret as any).items || [];
    for (const item of items) {
      if (item.qcStatus === 'passed') {
        await this.adjustStock(
          item.productId,
          item.variantId,
          item.quantity,
          'return_restock',
          `Restocked from Customer Return #${ret.returnNumber} (QC Passed)`,
          {
            returnRequestId: ret.id,
            orderId: ret.orderId,
            createdBy: adminId,
          },
        );
      } else if (item.qcStatus === 'failed') {
        // Log non-sellable/damaged item without increasing sellable stock
        await this.db.insert(inventoryTransactions).values({
          productId: Number(item.productId),
          variantId: Number(item.variantId),
          returnRequestId: ret.id,
          orderId: ret.orderId,
          transactionType: 'return_damaged',
          quantity: item.quantity,
          previousQuantity: 0,
          newQuantity: 0,
          reason: `Customer Return #${ret.returnNumber} QC Failed - Marked as Damaged/Non-sellable`,
          notes: item.qcRemarks || ret.qcRemarks || null,
          createdBy: adminId ? Number(adminId) : null,
          createdAt: new Date(),
        });
      }
    }
  }

  /**
   * Restock items from an RTO parcel that has arrived at warehouse and passed QC.
   */
  async restockRtoCase(rtoCaseId: number, adminId?: number | null): Promise<void> {
    const rto = await this.db.query.rtoCases.findFirst({
      where: eq(rtoCases.id, rtoCaseId),
      with: { order: { with: { orderItems: true } as any } } as any,
    });

    if (!rto) throw new BadRequestException(`RTO Case #${rtoCaseId} not found`);
    if (rto.inventoryAction === 'restocked') {
      throw new BadRequestException(`RTO Case #${rto.rtoNumber} has already been restocked.`);
    }

    const orderObj = (rto as any).order;
    const items = orderObj?.orderItems || [];

    if (rto.warehouseQcStatus === 'passed') {
      for (const item of items) {
        await this.adjustStock(
          item.productId,
          item.variantId,
          item.quantity,
          'rto_restock',
          `Restocked from RTO Case #${rto.rtoNumber} for Order #${orderObj.orderNumber}`,
          {
            rtoCaseId: rto.id,
            orderId: orderObj.id,
            createdBy: adminId,
          },
        );
      }

      await this.db.update(rtoCases).set({
        inventoryAction: 'restocked',
        inventoryActionAt: new Date(),
        status: 'restocked',
        updatedAt: new Date(),
      }).where(eq(rtoCases.id, rtoCaseId));
    } else {
      // QC failed -> Damaged inventory logging
      for (const item of items) {
        await this.db.insert(inventoryTransactions).values({
          productId: Number(item.productId),
          variantId: Number(item.variantId),
          rtoCaseId: rto.id,
          orderId: orderObj.id,
          transactionType: 'rto_damaged',
          quantity: item.quantity,
          previousQuantity: 0,
          newQuantity: 0,
          reason: `RTO Case #${rto.rtoNumber} QC Failed - Damaged/Lost in Transit`,
          notes: rto.warehouseQcRemarks || null,
          createdBy: adminId ? Number(adminId) : null,
          createdAt: new Date(),
        });
      }

      await this.db.update(rtoCases).set({
        inventoryAction: 'damaged',
        inventoryActionAt: new Date(),
        updatedAt: new Date(),
      }).where(eq(rtoCases.id, rtoCaseId));
    }
  }
}
