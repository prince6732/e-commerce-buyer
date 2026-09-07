import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { eq, desc, and, sql, inArray, like, or, SQL } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import {
  returnRequests,
  returnRequestItems,
  returnTrackingEvents,
  orders,
  orderItems,
  products,
  variants,
  users,
} from '../database/schema';
import { ReturnEligibilityService } from './return-eligibility.service';
import { ExchangeService } from './exchange.service';
import { RefundService } from './refund.service';
import { InventoryService } from '../inventory/inventory.service';
import { AuditLogService } from '../audit/audit-log.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DelhiveryService } from '../delhivery/delhivery.service';
import {
  RequestReturnDto,
  ApproveReturnDto,
  RejectReturnDto,
  ReturnQualityCheckDto,
  ProcessRefundDto,
} from './dto/return.dto';

@Injectable()
export class ReturnsService {
  private readonly logger = new Logger(ReturnsService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private eligibilityService: ReturnEligibilityService,
    private exchangeService: ExchangeService,
    private refundService: RefundService,
    private inventoryService: InventoryService,
    private auditLogService: AuditLogService,
    private mailService: MailService,
    private notificationsService: NotificationsService,
    @Inject(forwardRef(() => DelhiveryService))
    private delhiveryService: DelhiveryService,
  ) {}

  // ─── Request Return / Exchange (Customer) ─────────────────────────────────
  async requestReturn(userId: number, dto: RequestReturnDto): Promise<any> {
    this.logger.log(`User #${userId} requesting return for order #${dto.order_id}`);

    // 1. Verify eligibility
    const eligibility = await this.eligibilityService.checkEligibility(dto.order_id);
    if (!eligibility.is_eligible && (!eligibility.items || eligibility.items.length === 0)) {
      throw new BadRequestException(eligibility.rejection_reason || 'This order is not eligible for return or exchange.');
    }

    const order = eligibility.order;
    if (order.userId && order.userId !== userId) {
      throw new ForbiddenException('You are not authorized to return items for this order.');
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Please select at least one item to return or exchange.');
    }

    // 2. Validate selected items
    const eligibleItemMap = new Map<number, any>();
    for (const it of eligibility.items) {
      eligibleItemMap.set(it.order_item_id || it.orderItemId, it);
    }

    let calculatedRefundAmount = 0;
    const validatedItems: Array<{
      orderItemId: number;
      productId: number;
      variantId: number | null;
      productName: string;
      variantName: string | null;
      sku: string | null;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      exchangeVariantId: number | null;
    }> = [];

    for (const reqItem of dto.items) {
      const eligibleItem = eligibleItemMap.get(reqItem.order_item_id);
      if (!eligibleItem) {
        throw new BadRequestException(`Order item #${reqItem.order_item_id} is not eligible for return.`);
      }

      const returnableQty = eligibleItem.returnable_quantity || eligibleItem.availableReturnQuantity || 0;
      if (reqItem.quantity <= 0 || reqItem.quantity > returnableQty) {
        throw new BadRequestException(
          `Requested quantity (${reqItem.quantity}) exceeds eligible quantity (${returnableQty}) for item "${eligibleItem.product_name || eligibleItem.productName}".`,
        );
      }

      let exchangeVarId: number | null = null;
      if (dto.return_type === 'exchange') {
        if (!reqItem.exchange_variant_id) {
          throw new BadRequestException(
            `Exchange variant must be selected for item "${eligibleItem.product_name || eligibleItem.productName}".`,
          );
        }
        exchangeVarId = reqItem.exchange_variant_id;
      }

      const unitPrice = eligibleItem.unit_price || eligibleItem.unitPrice || 0;
      const itemTotal = unitPrice * reqItem.quantity;
      calculatedRefundAmount += itemTotal;

      validatedItems.push({
        orderItemId: reqItem.order_item_id,
        productId: eligibleItem.product_id || eligibleItem.productId,
        variantId: eligibleItem.variant_id || eligibleItem.variantId || null,
        productName: eligibleItem.product_name || eligibleItem.productName,
        variantName: eligibleItem.variant_name || eligibleItem.variantTitle || null,
        sku: eligibleItem.sku || null,
        quantity: reqItem.quantity,
        unitPrice,
        totalPrice: itemTotal,
        exchangeVariantId: exchangeVarId,
      });
    }

    // 3. Resolve pickup address
    let pickupAddr = dto.pickup_address;
    if (!pickupAddr) {
      const parsedShipping = typeof order.shippingAddress === 'object' && order.shippingAddress !== null
        ? order.shippingAddress
        : {};
      pickupAddr = {
        name: (parsedShipping as any).name || (order as any).user?.name || 'Customer',
        phone: String((parsedShipping as any).phone || (order as any).user?.phoneNumber || '9999999999'),
        address: (parsedShipping as any).address || (parsedShipping as any).street || String(order.shippingAddress || ''),
        city: (parsedShipping as any).city || 'Ambala',
        state: (parsedShipping as any).state || 'Haryana',
        pincode: (parsedShipping as any).pin || (parsedShipping as any).pincode || '134003',
      };
    }

    // 4. Generate unique Return Number
    const returnNumber = `RET-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 5. Determine refund mode
    const isPrepaid = order.paymentMethod !== 'cash_on_delivery' && order.paymentStatus === 'paid';
    const refundMode = dto.refund_mode || (isPrepaid ? 'original_source' : 'bank_transfer_upi');

    // 6. Insert Return Request into database
    const [insertedReturn] = await this.db.insert(returnRequests).values({
      returnNumber,
      orderId: order.id,
      userId,
      returnType: dto.return_type,
      status: 'requested',
      reason: dto.reason as any,
      reasonDetails: dto.reason_details || null,
      customerImages: dto.customer_images || [],
      refundMode: refundMode as any,
      refundStatus: dto.return_type === 'exchange' ? 'not_applicable' : 'pending',
      bankDetails: dto.bank_details || null,
      pickupAddress: pickupAddr,
      refundAmount: calculatedRefundAmount.toFixed(2),
      createdAt: new Date(),
    });

    const returnId = insertedReturn.insertId;

    // 7. Insert Return Items
    for (const item of validatedItems) {
      await this.db.insert(returnRequestItems).values({
        returnRequestId: returnId,
        orderItemId: item.orderItemId,
        productId: item.productId,
        variantId: item.variantId || 0,
        quantity: item.quantity,
        price: item.unitPrice.toFixed(2),
        exchangeVariantId: item.exchangeVariantId,
        qcStatus: 'pending',
      });
    }

    // 8. Log initial tracking event
    await this.db.insert(returnTrackingEvents).values({
      returnRequestId: returnId,
      waybill: returnNumber,
      status: 'requested',
      description: `Return request submitted by customer for ${dto.return_type === 'exchange' ? 'Exchange' : 'Refund'} (Reason: ${dto.reason.replace(/_/g, ' ')})`,
      location: pickupAddr.city || 'Customer Location',
      createdAt: new Date(),
    });

    // 9. Send Email & In-App Notification
    const customer = (order as any).user || (await this.db.query.users.findFirst({ where: eq(users.id, userId) }));
    if (customer?.email) {
      this.mailService.sendReturnRequestedEmail(
        customer.email,
        {
          returnNumber,
          returnType: dto.return_type,
          orderId: order.id,
          order,
        },
      ).catch((err) => this.logger.error(`Failed to send return requested email: ${err.message}`));
    }

    this.notificationsService.createAndEmitNotification({
      userId,
      title: dto.return_type === 'exchange' ? '🔄 Exchange Request Received' : '📦 Return Request Received',
      message: `Your ${dto.return_type} request #${returnNumber} for Order #${order.orderNumber} has been received and is under review.`,
      type: 'ORDER_PLACED',
      priority: 'HIGH',
      entityType: 'order',
      entityId: returnId,
      referenceKey: `RETURN_REQ_${returnId}`,
      link: `/profile/returns`,
    }).catch(() => {});

    // 10. Audit Log
    await this.auditLogService.logAction({
      entityType: 'return_request',
      entityId: returnId,
      action: 'RETURN_REQUESTED',
      performedBy: 'customer',
      performedById: userId,
      newState: { returnNumber, returnType: dto.return_type, items: validatedItems, refundAmount: calculatedRefundAmount },
    });

    return this.getReturnByIdentifier(returnId, userId, false);
  }

  // ─── Get Single Return By ID or Return Number ──────────────────────────────
  async getReturnByIdentifier(identifier: string | number, userId?: number, isAdmin = false): Promise<any> {
    const isNum = !isNaN(Number(identifier));
    const condition = isNum
      ? eq(returnRequests.id, Number(identifier))
      : eq(returnRequests.returnNumber, String(identifier));

    const ret = await this.db.query.returnRequests.findFirst({
      where: condition,
      with: {
        order: {
          with: {
            user: true,
          } as any,
        },
        user: true,
        items: {
          with: {
            product: true,
            variant: true,
            exchangeVariant: true,
          } as any,
        },
        trackingEvents: {
          orderBy: [desc(returnTrackingEvents.createdAt)],
        },
      } as any,
    });

    if (!ret) throw new NotFoundException('Return request not found.');

    if (!isAdmin && userId && ret.userId !== userId) {
      throw new ForbiddenException('You do not have permission to view this return request.');
    }

    return ret;
  }

  // ─── Get Customer Returns ──────────────────────────────────────────────────
  async getMyReturns(userId: number, query: { page?: number; limit?: number; status?: string } = {}): Promise<any> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(returnRequests.userId, userId)];
    if (query.status && query.status !== 'all') {
      conditions.push(eq(returnRequests.status, query.status as any));
    }

    const whereClause = and(...conditions);

    const [items, totalResult] = await Promise.all([
      this.db.query.returnRequests.findMany({
        where: whereClause,
        orderBy: [desc(returnRequests.createdAt)],
        limit,
        offset,
        with: {
          order: true,
          items: {
            with: { product: true, variant: true } as any,
          },
          trackingEvents: {
            orderBy: [desc(returnTrackingEvents.createdAt)],
            limit: 3,
          },
        } as any,
      }),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(returnRequests)
        .where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Admin: Get All Returns ────────────────────────────────────────────────
  async getAllReturns(query: {
    page?: number;
    limit?: number;
    status?: string;
    returnType?: string;
    search?: string;
  } = {}): Promise<any> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 15));
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (query.status && query.status !== 'all') {
      conditions.push(eq(returnRequests.status, query.status as any));
    }
    if (query.returnType && query.returnType !== 'all') {
      conditions.push(eq(returnRequests.returnType, query.returnType as any));
    }
    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        or(
          like(returnRequests.returnNumber, term),
          like(returnRequests.reverseWaybill, term),
          like(returnRequests.refundTransactionId, term),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      this.db.query.returnRequests.findMany({
        where: whereClause,
        orderBy: [desc(returnRequests.createdAt)],
        limit,
        offset,
        with: {
          order: {
            with: { user: true } as any,
          },
          user: true,
          items: {
            with: { product: true, variant: true, exchangeVariant: true } as any,
          },
          trackingEvents: {
            orderBy: [desc(returnTrackingEvents.createdAt)],
            limit: 2,
          },
        } as any,
      }),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(returnRequests)
        .where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    // Summary counts for tabs
    const counts = await this.db
      .select({
        status: returnRequests.status,
        count: sql<number>`count(*)`,
      })
      .from(returnRequests)
      .groupBy(returnRequests.status);

    const countsByStatus: Record<string, number> = {
      all: total,
      requested: 0,
      approved: 0,
      pickup_scheduled: 0,
      picked_up: 0,
      in_transit: 0,
      received_at_warehouse: 0,
      qc_pending: 0,
      qc_passed: 0,
      qc_failed: 0,
      refund_pending: 0,
      refund_processing: 0,
      refunded: 0,
      exchange_processing: 0,
      completed: 0,
      cancelled: 0,
      rejected: 0,
    };

    for (const c of counts) {
      countsByStatus[c.status] = Number(c.count);
    }

    return {
      items,
      countsByStatus,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Admin: Approve Return ────────────────────────────────────────────────
  async approveReturn(returnId: number, adminUser: any, dto?: ApproveReturnDto): Promise<any> {
    const ret = await this.db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, returnId),
      with: { order: { with: { user: true } as any }, items: true } as any,
    });

    if (!ret) throw new NotFoundException('Return request not found.');
    if (ret.status !== 'requested') {
      throw new BadRequestException(`Cannot approve return with status '${ret.status}'. Must be 'requested'.`);
    }

    await this.db
      .update(returnRequests)
      .set({
        status: 'approved',
        adminNotes: dto?.admin_notes || ret.adminNotes,
      })
      .where(eq(returnRequests.id, returnId));

    await this.db.insert(returnTrackingEvents).values({
      returnRequestId: returnId,
      waybill: ret.reverseWaybill || ret.returnNumber,
      status: 'approved',
      description: `Return request approved by Admin. ${dto?.admin_notes ? `Notes: ${dto.admin_notes}` : 'Preparing reverse pickup.'}`,
      createdAt: new Date(),
    });

    // Auto-schedule Delhivery Reverse Pickup
    try {
      await this.scheduleReversePickup(returnId, adminUser);
    } catch (err: any) {
      this.logger.warn(`Could not auto-schedule reverse pickup on approve for return #${returnId}: ${err.message}`);
    }

    // Customer Notification
    const customer = (ret as any).order?.user || (await this.db.query.users.findFirst({ where: eq(users.id, ret.userId) }));
    if (customer?.email) {
      this.mailService.sendReturnApprovedEmail(
        customer.email,
        ret,
      ).catch((err) => this.logger.error(`Failed to send return approved email: ${err.message}`));
    }

    this.notificationsService.createAndEmitNotification({
      userId: ret.userId,
      title: '✅ Return Approved',
      message: `Your return #${ret.returnNumber} has been approved! Reverse pickup will be scheduled shortly.`,
      type: 'ORDER_PLACED',
      priority: 'HIGH',
      entityType: 'order',
      entityId: returnId,
      referenceKey: `RETURN_APP_${returnId}`,
      link: `/profile/returns`,
    }).catch(() => {});

    await this.auditLogService.logAction({
      entityType: 'return_request',
      entityId: returnId,
      action: 'RETURN_APPROVED',
      performedBy: 'admin',
      performedById: adminUser?.id,
      previousState: { status: 'requested' },
      newState: { status: 'approved', notes: dto?.admin_notes },
    });

    return this.getReturnByIdentifier(returnId, undefined, true);
  }

  // ─── Admin: Reject Return ─────────────────────────────────────────────────
  async rejectReturn(returnId: number, adminUser: any, dto: RejectReturnDto): Promise<any> {
    const ret = await this.db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, returnId),
      with: { order: { with: { user: true } as any } } as any,
    });

    if (!ret) throw new NotFoundException('Return request not found.');
    if (ret.status !== 'requested') {
      throw new BadRequestException(`Cannot reject return with status '${ret.status}'. Must be 'requested'.`);
    }

    await this.db
      .update(returnRequests)
      .set({
        status: 'rejected',
        rejectionReason: dto.rejection_reason,
      })
      .where(eq(returnRequests.id, returnId));

    await this.db.insert(returnTrackingEvents).values({
      returnRequestId: returnId,
      waybill: ret.reverseWaybill || ret.returnNumber,
      status: 'rejected',
      description: `Return request rejected: ${dto.rejection_reason}`,
      createdAt: new Date(),
    });

    // Notify Customer
    const customer = (ret as any).order?.user || (await this.db.query.users.findFirst({ where: eq(users.id, ret.userId) }));
    if (customer?.email) {
      this.mailService.sendReturnRejectedEmail(
        customer.email,
        ret,
        dto.rejection_reason,
      ).catch((err) => this.logger.error(`Failed to send return rejected email: ${err.message}`));
    }

    this.notificationsService.createAndEmitNotification({
      userId: ret.userId,
      title: '❌ Return Request Update',
      message: `Your return request #${ret.returnNumber} could not be approved. Reason: ${dto.rejection_reason}`,
      type: 'ORDER_PLACED',
      priority: 'HIGH',
      entityType: 'order',
      entityId: returnId,
      referenceKey: `RETURN_REJ_${returnId}`,
      link: `/profile/returns`,
    }).catch(() => {});

    await this.auditLogService.logAction({
      entityType: 'return_request',
      entityId: returnId,
      action: 'RETURN_REJECTED',
      performedBy: 'admin',
      performedById: adminUser?.id,
      previousState: { status: 'requested' },
      newState: { status: 'rejected', rejectionReason: dto.rejection_reason },
    });

    return this.getReturnByIdentifier(returnId, undefined, true);
  }

  // ─── Schedule Reverse Pickup ──────────────────────────────────────────────
  async scheduleReversePickup(returnId: number, adminUser: any, pickupDate?: string): Promise<any> {
    const ret = await this.db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, returnId),
      with: { order: true, items: true } as any,
    });

    if (!ret) throw new NotFoundException('Return request not found.');
    if (!['approved', 'pickup_scheduled'].includes(ret.status)) {
      throw new BadRequestException(`Cannot schedule reverse pickup for return in '${ret.status}' state.`);
    }

    const pickupResponse = await this.delhiveryService.createReversePickup(ret, pickupDate);

    const waybill = pickupResponse.waybill || ret.reverseWaybill || `DLHV-REV-${ret.returnNumber}`;

    await this.db
      .update(returnRequests)
      .set({
        status: 'pickup_scheduled',
        reverseWaybill: waybill,
        reversePickupDate: pickupDate ? new Date(pickupDate) : new Date(),
      })
      .where(eq(returnRequests.id, returnId));

    await this.db.insert(returnTrackingEvents).values({
      returnRequestId: returnId,
      waybill,
      status: 'pickup_scheduled',
      description: `Delhivery reverse pickup scheduled. AWB: ${waybill}`,
      location: (ret.pickupAddress as any)?.city || 'Customer Address',
      createdAt: new Date(),
    });

    await this.auditLogService.logAction({
      entityType: 'return_request',
      entityId: returnId,
      action: 'REVERSE_PICKUP_SCHEDULED',
      performedBy: 'admin',
      performedById: adminUser?.id,
      newState: { waybill, pickupDate },
    });

    return {
      success: true,
      message: 'Reverse pickup scheduled successfully.',
      waybill,
    };
  }

  // ─── Mark In Transit ───────────────────────────────────────────────────────
  async markInTransit(returnId: number, location?: string): Promise<any> {
    const ret = await this.db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, returnId),
    });

    if (!ret) throw new NotFoundException('Return request not found.');

    await this.db
      .update(returnRequests)
      .set({ status: 'in_transit' })
      .where(eq(returnRequests.id, returnId));

    await this.db.insert(returnTrackingEvents).values({
      returnRequestId: returnId,
      waybill: ret.reverseWaybill || ret.returnNumber,
      status: 'in_transit',
      description: 'Package picked up by courier and currently in transit to Zelton warehouse.',
      location: location || 'Delhivery Hub',
      createdAt: new Date(),
    });

    return this.getReturnByIdentifier(returnId, undefined, true);
  }

  // ─── Mark Received at Warehouse ───────────────────────────────────────────
  async markReceivedAtWarehouse(returnId: number, adminUser?: any): Promise<any> {
    const ret = await this.db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, returnId),
    });

    if (!ret) throw new NotFoundException('Return request not found.');

    await this.db
      .update(returnRequests)
      .set({
        status: 'received_at_warehouse',
      })
      .where(eq(returnRequests.id, returnId));

    await this.db.insert(returnTrackingEvents).values({
      returnRequestId: returnId,
      waybill: ret.reverseWaybill || ret.returnNumber,
      status: 'received_at_warehouse',
      description: 'Return package safely received at Zelton Ambala Central Warehouse. Quality Inspection pending.',
      location: 'Zelton Ambala Central Warehouse',
      createdAt: new Date(),
    });

    await this.auditLogService.logAction({
      entityType: 'return_request',
      entityId: returnId,
      action: 'RECEIVED_AT_WAREHOUSE',
      performedBy: adminUser ? 'admin' : 'courier_scan',
      performedById: adminUser?.id,
      newState: { status: 'received_at_warehouse' },
    });

    return this.getReturnByIdentifier(returnId, undefined, true);
  }

  // ─── Quality Check (QC) ───────────────────────────────────────────────────
  async qualityCheck(returnId: number, adminUser: any, dto: ReturnQualityCheckDto): Promise<any> {
    const ret = await this.db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, returnId),
      with: { items: true, order: true } as any,
    });

    if (!ret) throw new NotFoundException('Return request not found.');
    if (!['received_at_warehouse', 'in_transit', 'approved', 'pickup_scheduled', 'qc_pending'].includes(ret.status)) {
      throw new BadRequestException(`Cannot perform QC on return in status '${ret.status}'.`);
    }

    const isPassed = dto.qc_status === 'passed';

    // 1. Update items QC if provided
    if (dto.item_qc && dto.item_qc.length > 0) {
      for (const it of dto.item_qc) {
        await this.db
          .update(returnRequestItems)
          .set({
            qcStatus: it.qc_status,
            qcRemarks: it.qc_remarks || null,
          })
          .where(and(eq(returnRequestItems.id, it.item_id), eq(returnRequestItems.returnRequestId, returnId)));
      }
    } else {
      // Default all items to the main QC status
      await this.db
        .update(returnRequestItems)
        .set({
          qcStatus: isPassed ? 'passed' : 'failed',
          qcRemarks: dto.qc_remarks || null,
        })
        .where(eq(returnRequestItems.returnRequestId, returnId));
    }

    // 2. Update Return Request
    await this.db
      .update(returnRequests)
      .set({
        status: isPassed ? 'qc_passed' : 'qc_failed',
        qcStatus: isPassed ? 'passed' : 'failed',
        qcRemarks: dto.qc_remarks || null,
        qcPassedAt: isPassed ? new Date() : null,
        qcFailedAt: !isPassed ? new Date() : null,
      })
      .where(eq(returnRequests.id, returnId));

    await this.db.insert(returnTrackingEvents).values({
      returnRequestId: returnId,
      waybill: ret.reverseWaybill || ret.returnNumber,
      status: isPassed ? 'qc_passed' : 'qc_failed',
      description: isPassed
        ? `Quality Check PASSED. ${dto.qc_remarks ? `Remarks: ${dto.qc_remarks}` : 'Items verified and intact.'}`
        : `Quality Check FAILED. Remarks: ${dto.qc_remarks || 'Items failed inspection criteria.'}`,
      location: 'Zelton Quality Control Lab',
      createdAt: new Date(),
    });

    await this.auditLogService.logAction({
      entityType: 'return_request',
      entityId: returnId,
      action: isPassed ? 'QC_PASSED' : 'QC_FAILED',
      performedBy: 'admin',
      performedById: adminUser?.id,
      newState: { qcStatus: dto.qc_status, remarks: dto.qc_remarks },
    });

    // 3. Post-QC Actions
    if (isPassed) {
      // Auto-restock verified passed items into inventory
      try {
        await this.inventoryService.restockReturnRequest(returnId, adminUser?.id);
      } catch (err: any) {
        this.logger.error(`Error during restock for return #${returnId}: ${err.message}`);
      }

      // Handle Exchange or Refund
      if (ret.returnType === 'exchange') {
        try {
          const exchangeResult = await this.exchangeService.processReplacementOrder(returnId, adminUser?.id);
          this.logger.log(`Exchange replacement order created: #${exchangeResult.replacementOrderNumber}`);
        } catch (err: any) {
          this.logger.error(`Failed to auto-create replacement order for exchange #${returnId}: ${err.message}`);
        }
      } else {
        try {
          await this.refundService.processRefund(returnId, adminUser);
        } catch (err: any) {
          this.logger.error(`Failed to auto-process refund for return #${returnId}: ${err.message}`);
        }
      }
    }

    return this.getReturnByIdentifier(returnId, undefined, true);
  }

  // ─── Manual Refund Processing Trigger ─────────────────────────────────────
  async triggerRefund(returnId: number, adminUser: any, dto?: ProcessRefundDto): Promise<any> {
    return this.refundService.processRefund(returnId, adminUser, dto);
  }

  // ─── Cancel Return (Customer) ─────────────────────────────────────────────
  async cancelReturn(returnId: number, userId: number, reason?: string): Promise<any> {
    const ret = await this.db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, returnId),
    });

    if (!ret) throw new NotFoundException('Return request not found.');
    if (ret.userId !== userId) {
      throw new ForbiddenException('You do not have permission to cancel this return.');
    }

    if (!['requested', 'approved'].includes(ret.status)) {
      throw new BadRequestException(`Cannot cancel return request in '${ret.status}' state once pickup or inspection has started.`);
    }

    await this.db
      .update(returnRequests)
      .set({
        status: 'cancelled',
        adminNotes: reason ? `Cancelled by customer: ${reason}` : 'Cancelled by customer',
      })
      .where(eq(returnRequests.id, returnId));

    await this.db.insert(returnTrackingEvents).values({
      returnRequestId: returnId,
      waybill: ret.reverseWaybill || ret.returnNumber,
      status: 'cancelled',
      description: `Return request cancelled by customer. ${reason ? `Reason: ${reason}` : ''}`,
      createdAt: new Date(),
    });

    await this.auditLogService.logAction({
      entityType: 'return_request',
      entityId: returnId,
      action: 'RETURN_CANCELLED',
      performedBy: 'customer',
      performedById: userId,
      newState: { status: 'cancelled', reason },
    });

    return { success: true, message: 'Return request cancelled successfully.' };
  }
}
