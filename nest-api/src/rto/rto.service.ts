import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
  forwardRef,
} from '@nestjs/common';
import { eq, desc, and, sql, inArray, like, or, SQL } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import {
  rtoCases,
  rtoTrackingEvents,
  orders,
  orderItems,
  products,
  variants,
  users,
} from '../database/schema';
import { InventoryService } from '../inventory/inventory.service';
import { AuditLogService } from '../audit/audit-log.service';
import { MailService } from '../mail/mail.service';
import { NotificationsService } from '../notifications/notifications.service';
import { DelhiveryService } from '../delhivery/delhivery.service';
import { RefundService } from '../returns/refund.service';
import { getOrderSlug } from '../common/utils/slug.util';
import { NdrActionDto, RtoQcDto, ProcessRtoRefundDto } from './dto/rto.dto';

@Injectable()
export class RtoService {
  private readonly logger = new Logger(RtoService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private inventoryService: InventoryService,
    private auditLogService: AuditLogService,
    private mailService: MailService,
    private notificationsService: NotificationsService,
    private refundService: RefundService,
    @Inject(forwardRef(() => DelhiveryService))
    private delhiveryService: DelhiveryService,
  ) {}

  // ─── Handle NDR Event (Courier Webhook or Manual) ──────────────────────────
  async handleNdrEvent(orderId: number, ndrData: {
    reason?: string;
    courierLocation?: string;
    attemptCount?: number;
    waybill?: string;
  }): Promise<any> {
    this.logger.log(`NDR raised for Order #${orderId} - Reason: ${ndrData.reason}`);

    const order = await this.db.query.orders.findFirst({
      where: eq(orders.id, orderId),
      with: { user: true } as any,
    });

    if (!order) {
      this.logger.warn(`NDR event received for non-existent order #${orderId}`);
      return;
    }

    // Check if an RTO case already exists for this order
    let rtoCase = await this.db.query.rtoCases.findFirst({
      where: eq(rtoCases.orderId, orderId),
    });

    const waybillNumber = ndrData.waybill || order.delhiveryWaybill || `WB-${order.orderNumber}`;
    const attemptCount = (rtoCase?.ndrAttempts || 0) + 1;

    if (!rtoCase) {
      const rtoNumber = `RTO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const [inserted] = await this.db.insert(rtoCases).values({
        rtoNumber,
        orderId,
        waybill: waybillNumber,
        status: 'ndr',
        firstNdrAt: new Date(),
        lastNdrAt: new Date(),
        ndrAttempts: attemptCount,
        courierStatus: 'NDR',
        courierRemarks: ndrData.reason || 'Customer not available at destination address',
        rtoReason: 'customer_not_available',
        warehouseQcStatus: 'pending',
        inventoryAction: 'pending',
      });
      rtoCase = await this.db.query.rtoCases.findFirst({
        where: eq(rtoCases.id, inserted.insertId),
      });
    } else {
      await this.db
        .update(rtoCases)
        .set({
          status: 'ndr',
          ndrAttempts: attemptCount,
          lastNdrAt: new Date(),
          courierRemarks: ndrData.reason || rtoCase.courierRemarks,
        })
        .where(eq(rtoCases.id, rtoCase.id));
    }

    // Add tracking event
    await this.db.insert(rtoTrackingEvents).values({
      rtoCaseId: rtoCase!.id,
      waybill: waybillNumber,
      status: 'ndr',
      description: `Delivery attempt #${attemptCount} failed: ${ndrData.reason || 'Undelivered'}`,
      location: ndrData.courierLocation || 'Destination Delivery Center',
      eventTime: new Date(),
    });

    // Notify Customer
    const customer = (order as any).user;
    if (customer?.email) {
      this.mailService.sendNdrAlertEmail(
        customer.email,
        order,
        ndrData.reason || 'Delivery attempt failed. Please ensure someone is available or contact our support team.',
      ).catch((err) => this.logger.error(`Failed to send NDR alert email: ${err.message}`));
    }

    if (order.userId) {
      const orderSlug = getOrderSlug(order) || order.orderNumber || order.id;
      this.notificationsService.createAndEmitNotification({
        userId: order.userId,
        title: '⚠️ Delivery Attempt Unsuccessful',
        message: `Delivery attempt #${attemptCount} for Order #${order.orderNumber} was not successful (${ndrData.reason || 'Customer unavailable'}). Please update your details or contact support.`,
        type: 'ORDER_PLACED',
        priority: 'HIGH',
        entityType: 'order',
        entityId: order.id,
        referenceKey: `NDR_ALERT_${order.id}_${attemptCount}`,
        link: `/orders/${orderSlug}/tracking`,
      }).catch(() => {});
    }

    await this.auditLogService.logAction({
      entityType: 'rto_case',
      entityId: rtoCase!.id,
      action: 'NDR_RAISED',
      performedBy: 'courier_webhook',
      newState: { attemptCount, reason: ndrData.reason, location: ndrData.courierLocation },
    });

    return rtoCase;
  }

  // ─── Execute NDR Action (Admin Command Center) ────────────────────────────
  async executeNdrAction(caseId: number, adminUser: any, dto: NdrActionDto): Promise<any> {
    const rtoCase = await this.db.query.rtoCases.findFirst({
      where: eq(rtoCases.id, caseId),
      with: { order: true } as any,
    });

    if (!rtoCase) throw new NotFoundException('RTO Case not found.');

    const order = (rtoCase as any).order;

    if (dto.action === 'rto') {
      // Direct RTO Confirmation
      await this.delhiveryService.executeNdrAction(rtoCase.waybill || order?.delhiveryWaybill, {
        action: 'rto',
        remarks: dto.remarks || 'Customer refused / RTO confirmed by merchant',
      });

      await this.db
        .update(rtoCases)
        .set({
          status: 'rto_initiated',
          rtoInitiatedAt: new Date(),
          ndrActionTaken: 'rto_approved',
          adminNotes: dto.remarks ? `RTO Action: ${dto.remarks}` : rtoCase.adminNotes,
        })
        .where(eq(rtoCases.id, caseId));

      await this.db.insert(rtoTrackingEvents).values({
        rtoCaseId: caseId,
        waybill: rtoCase.waybill,
        status: 'rto_initiated',
        description: `RTO initiated by Zelton Logistics. ${dto.remarks ? `Remarks: ${dto.remarks}` : ''}`,
        location: 'Destination Delivery Center',
        eventTime: new Date(),
      });

      await this.auditLogService.logAction({
        entityType: 'rto_case',
        entityId: caseId,
        action: 'RTO_INITIATED',
        performedBy: 'admin',
        performedById: adminUser?.id,
        newState: { status: 'rto_initiated', remarks: dto.remarks },
      });
    } else {
      // Reattempt / Reschedule / Address Update
      await this.delhiveryService.executeNdrAction(rtoCase.waybill || order?.delhiveryWaybill, {
        action: dto.action,
        remarks: dto.remarks,
        rescheduleDate: dto.reschedule_date,
        address: dto.updated_address,
        city: dto.updated_city,
        state: dto.updated_state,
        pincode: dto.updated_pincode,
        phone: dto.updated_phone,
      });

      let actionMapped: 'reattempt_requested' | 'address_updated' | 'phone_updated' | 'rescheduled' = 'reattempt_requested';
      if (dto.action === 'update_address') actionMapped = 'address_updated';
      else if (dto.action === 'update_phone') actionMapped = 'phone_updated';
      else if (dto.action === 'reschedule') actionMapped = 'rescheduled';

      await this.db
        .update(rtoCases)
        .set({
          status: 'reattempt_requested',
          ndrActionTaken: actionMapped,
          nextReattemptAt: dto.reschedule_date ? new Date(dto.reschedule_date) : undefined,
          adminNotes: dto.remarks ? `NDR Action: ${dto.remarks}` : rtoCase.adminNotes,
        })
        .where(eq(rtoCases.id, caseId));

      let actionDesc = `NDR Action '${dto.action.toUpperCase()}' dispatched to Delhivery.`;
      if (dto.reschedule_date) actionDesc += ` Reschedule Date: ${dto.reschedule_date}.`;
      if (dto.updated_address) actionDesc += ` New Address: ${dto.updated_address}.`;
      if (dto.updated_phone) actionDesc += ` New Phone: ${dto.updated_phone}.`;
      if (dto.remarks) actionDesc += ` Remarks: ${dto.remarks}.`;

      await this.db.insert(rtoTrackingEvents).values({
        rtoCaseId: caseId,
        waybill: rtoCase.waybill,
        status: 'reattempt_requested',
        description: actionDesc,
        location: 'Destination Hub',
        eventTime: new Date(),
      });

      await this.auditLogService.logAction({
        entityType: 'rto_case',
        entityId: caseId,
        action: 'NDR_ACTION_EXECUTED',
        performedBy: 'admin',
        performedById: adminUser?.id,
        newState: { action: dto.action, remarks: dto.remarks, dto },
      });
    }

    return this.getRtoCaseById(caseId);
  }

  // ─── Handle RTO Scans (Webhook or Sync) ────────────────────────────────────
  async handleRtoScan(orderIdOrWaybill: string | number, scanData: {
    status: string;
    location?: string;
    reason?: string;
  }): Promise<any> {
    let rtoCase = await this.db.query.rtoCases.findFirst({
      where: typeof orderIdOrWaybill === 'number'
        ? eq(rtoCases.orderId, orderIdOrWaybill)
        : or(eq(rtoCases.waybill, String(orderIdOrWaybill)), eq(rtoCases.orderId, Number(orderIdOrWaybill) || 0)),
    });

    if (!rtoCase) {
      this.logger.log(`Creating new RTO case for scan: ${orderIdOrWaybill}`);
      const order = await this.db.query.orders.findFirst({
        where: typeof orderIdOrWaybill === 'number'
          ? eq(orders.id, orderIdOrWaybill)
          : or(eq(orders.delhiveryWaybill, String(orderIdOrWaybill)), eq(orders.id, Number(orderIdOrWaybill) || 0)),
      });

      if (!order) return;

      const rtoNumber = `RTO-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const [inserted] = await this.db.insert(rtoCases).values({
        rtoNumber,
        orderId: order.id,
        waybill: order.delhiveryWaybill || `WB-${order.orderNumber}`,
        status: 'rto_in_transit',
        rtoInitiatedAt: new Date(),
        courierRemarks: scanData.reason || 'RTO in transit',
        rtoReason: 'customer_not_available',
        warehouseQcStatus: 'pending',
        inventoryAction: 'pending',
      });

      rtoCase = await this.db.query.rtoCases.findFirst({
        where: eq(rtoCases.id, inserted.insertId),
      });
    }

    const cleanStatus = scanData.status.toLowerCase();
    let newStatus: 'rto_in_transit' | 'rto_received' = 'rto_in_transit';
    let desc = `RTO scan: ${scanData.status}`;

    if (cleanStatus.includes('delivered') || cleanStatus.includes('received') || cleanStatus.includes('dlv')) {
      newStatus = 'rto_received';
      desc = 'RTO package successfully delivered back to Zelton Central Warehouse. Awaiting QC Inspection.';
      await this.db
        .update(rtoCases)
        .set({
          status: 'rto_received',
          rtoReceivedAt: new Date(),
        })
        .where(eq(rtoCases.id, rtoCase!.id));
    } else {
      newStatus = 'rto_in_transit';
      desc = `RTO package in transit to warehouse. Current location: ${scanData.location || 'Hub'}`;
      await this.db
        .update(rtoCases)
        .set({
          status: 'rto_in_transit',
        })
        .where(eq(rtoCases.id, rtoCase!.id));
    }

    await this.db.insert(rtoTrackingEvents).values({
      rtoCaseId: rtoCase!.id,
      waybill: rtoCase!.waybill,
      status: newStatus,
      description: desc,
      location: scanData.location || 'Delhivery Transit Network',
      eventTime: new Date(),
    });
  }

  // ─── Mark RTO Delivered at Warehouse ──────────────────────────────────────
  async markRtoDelivered(caseId: number, adminUser?: any): Promise<any> {
    const rtoCase = await this.db.query.rtoCases.findFirst({
      where: eq(rtoCases.id, caseId),
    });

    if (!rtoCase) throw new NotFoundException('RTO Case not found.');

    await this.db
      .update(rtoCases)
      .set({
        status: 'rto_received',
        rtoReceivedAt: new Date(),
      })
      .where(eq(rtoCases.id, caseId));

    await this.db.insert(rtoTrackingEvents).values({
      rtoCaseId: caseId,
      waybill: rtoCase.waybill,
      status: 'rto_received',
      description: 'RTO package safely received at Zelton Central Warehouse (Ambala). QC Inspection pending.',
      location: 'Zelton Ambala Central Warehouse',
      eventTime: new Date(),
    });

    await this.auditLogService.logAction({
      entityType: 'rto_case',
      entityId: caseId,
      action: 'RTO_DELIVERED_TO_WAREHOUSE',
      performedBy: adminUser ? 'admin' : 'courier_scan',
      performedById: adminUser?.id,
      newState: { status: 'rto_received' },
    });

    return this.getRtoCaseById(caseId);
  }

  // ─── Quality Check & Restock on RTO ───────────────────────────────────────
  async qualityCheckRto(caseId: number, adminUser: any, dto: RtoQcDto): Promise<any> {
    const rtoCase = await this.db.query.rtoCases.findFirst({
      where: eq(rtoCases.id, caseId),
      with: {
        order: {
          with: {
            orderItems: {
              with: { product: true, variant: true } as any,
            },
            user: true,
          } as any,
        },
      } as any,
    });

    if (!rtoCase) throw new NotFoundException('RTO Case not found.');

    const orderObj = (rtoCase as any).order;
    const isPassed = dto.qc_status === 'passed';

    await this.db
      .update(rtoCases)
      .set({
        status: isPassed ? 'qc_passed' : 'qc_failed',
        warehouseQcStatus: isPassed ? 'passed' : 'failed',
        warehouseQcRemarks: dto.qc_remarks || null,
        adminNotes: dto.qc_remarks ? `QC Remarks: ${dto.qc_remarks}` : rtoCase.adminNotes,
      })
      .where(eq(rtoCases.id, caseId));

    await this.db.insert(rtoTrackingEvents).values({
      rtoCaseId: caseId,
      waybill: rtoCase.waybill,
      status: isPassed ? 'qc_passed' : 'qc_failed',
      description: isPassed
        ? `RTO Quality Check PASSED. ${dto.qc_remarks ? `Remarks: ${dto.qc_remarks}` : 'Items in brand new condition.'}`
        : `RTO Quality Check FAILED (${dto.qc_status.toUpperCase()}). Remarks: ${dto.qc_remarks || 'Packaging damaged / seals broken.'}`,
      location: 'Zelton Central Warehouse QC Lab',
      eventTime: new Date(),
    });

    await this.auditLogService.logAction({
      entityType: 'rto_case',
      entityId: caseId,
      action: isPassed ? 'RTO_QC_PASSED' : 'RTO_QC_FAILED',
      performedBy: 'admin',
      performedById: adminUser?.id,
      newState: { qcStatus: dto.qc_status, remarks: dto.qc_remarks, restock: dto.restock },
    });

    // Auto-restock items into inventory if QC passed and restock is true
    if (isPassed && dto.restock !== false && rtoCase.inventoryAction !== 'restocked') {
      try {
        await this.inventoryService.restockRtoCase(caseId, adminUser?.id);
      } catch (err: any) {
        this.logger.error(`Failed to restock RTO Case #${caseId}: ${err.message}`);
      }
    }

    // Auto-process prepaid refund if order was paid online
    const isPrepaid = orderObj?.paymentMethod !== 'cash_on_delivery' && orderObj?.paymentStatus === 'paid';
    if (isPrepaid) {
      try {
        await this.refundService.processPrepaidRtoRefund(caseId, adminUser);
      } catch (err: any) {
        this.logger.error(`Failed to auto-process prepaid RTO refund for Case #${caseId}: ${err.message}`);
      }
    }

    return this.getRtoCaseById(caseId);
  }

  // ─── Process Prepaid RTO Refund Manually ──────────────────────────────────
  async processRtoRefund(caseId: number, adminUser: any, dto?: ProcessRtoRefundDto): Promise<any> {
    return this.refundService.processPrepaidRtoRefund(caseId, adminUser, dto);
  }

  // ─── Get Single RTO Case ──────────────────────────────────────────────────
  async getRtoCaseById(caseId: number): Promise<any> {
    const rto = await this.db.query.rtoCases.findFirst({
      where: eq(rtoCases.id, caseId),
      with: {
        order: {
          with: {
            user: true,
            orderItems: {
              with: { product: true, variant: true } as any,
            },
          } as any,
        },
        trackingEvents: {
          orderBy: [desc(rtoTrackingEvents.eventTime)],
        },
      } as any,
    });

    if (!rto) throw new NotFoundException('RTO Case not found.');
    return rto;
  }

  // ─── Get All RTO Cases (Admin with NDR Aging & Filters) ───────────────────
  async getAllRtoCases(query: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    ndrAging?: string; // '<24h' | '24-48h' | '48-72h' | '>72h'
  } = {}): Promise<any> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 15));
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [];
    if (query.status && query.status !== 'all') {
      conditions.push(eq(rtoCases.status, query.status as any));
    }
    if (query.search && query.search.trim()) {
      const term = `%${query.search.trim()}%`;
      conditions.push(
        or(
          like(rtoCases.rtoNumber, term),
          like(rtoCases.waybill, term),
          like(rtoCases.courierRemarks, term),
        )!,
      );
    }

    // NDR Aging Filter
    if (query.ndrAging) {
      const now = new Date();
      if (query.ndrAging === '<24h') {
        const threshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        conditions.push(sql`${rtoCases.firstNdrAt} >= ${threshold}`);
      } else if (query.ndrAging === '24-48h') {
        const t24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const t48 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        conditions.push(sql`${rtoCases.firstNdrAt} < ${t24} AND ${rtoCases.firstNdrAt} >= ${t48}`);
      } else if (query.ndrAging === '48-72h') {
        const t48 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const t72 = new Date(now.getTime() - 72 * 60 * 60 * 1000);
        conditions.push(sql`${rtoCases.firstNdrAt} < ${t48} AND ${rtoCases.firstNdrAt} >= ${t72}`);
      } else if (query.ndrAging === '>72h') {
        const t72 = new Date(now.getTime() - 72 * 60 * 60 * 1000);
        conditions.push(sql`${rtoCases.firstNdrAt} < ${t72}`);
      }
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      this.db.query.rtoCases.findMany({
        where: whereClause,
        orderBy: [desc(rtoCases.createdAt)],
        limit,
        offset,
        with: {
          order: {
            with: {
              user: true,
              orderItems: {
                with: { product: true, variant: true } as any,
              },
            } as any,
          },
          trackingEvents: {
            orderBy: [desc(rtoTrackingEvents.eventTime)],
            limit: 2,
          },
        } as any,
      }),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(rtoCases)
        .where(whereClause),
    ]);

    const total = Number(totalResult[0]?.count || 0);

    // Status Breakdown counts for tabs
    const counts = await this.db
      .select({
        status: rtoCases.status,
        count: sql<number>`count(*)`,
      })
      .from(rtoCases)
      .groupBy(rtoCases.status);

    const countsByStatus: Record<string, number> = {
      all: total,
      ndr: 0,
      reattempt_requested: 0,
      rto_initiated: 0,
      rto_in_transit: 0,
      rto_received: 0,
      qc_pending: 0,
      qc_passed: 0,
      qc_failed: 0,
      restocked: 0,
      completed: 0,
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

  // ─── Get RTO Analytics ────────────────────────────────────────────────────
  async getRtoAnalytics(): Promise<any> {
    const now = new Date();
    const t24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const t48 = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const t72 = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    const [allCases, aging24, aging48, aging72, agingOlder] = await Promise.all([
      this.db.select().from(rtoCases),
      this.db.select({ count: sql<number>`count(*)` }).from(rtoCases).where(and(eq(rtoCases.status, 'ndr'), sql`${rtoCases.firstNdrAt} >= ${t24}`)),
      this.db.select({ count: sql<number>`count(*)` }).from(rtoCases).where(and(eq(rtoCases.status, 'ndr'), sql`${rtoCases.firstNdrAt} < ${t24} AND ${rtoCases.firstNdrAt} >= ${t48}`)),
      this.db.select({ count: sql<number>`count(*)` }).from(rtoCases).where(and(eq(rtoCases.status, 'ndr'), sql`${rtoCases.firstNdrAt} < ${t48} AND ${rtoCases.firstNdrAt} >= ${t72}`)),
      this.db.select({ count: sql<number>`count(*)` }).from(rtoCases).where(and(eq(rtoCases.status, 'ndr'), sql`${rtoCases.firstNdrAt} < ${t72}`)),
    ]);

    let totalNdr = 0;
    let totalRto = 0;
    let totalRestocked = 0;
    let qcPassedCount = 0;
    let qcFailedCount = 0;

    for (const c of allCases) {
      if (c.firstNdrAt) totalNdr++;
      if (['rto_initiated', 'rto_in_transit', 'rto_received', 'qc_passed', 'qc_failed', 'restocked', 'completed'].includes(c.status)) {
        totalRto++;
      }
      if (c.inventoryAction === 'restocked') totalRestocked++;
      if (c.warehouseQcStatus === 'passed') qcPassedCount++;
      if (c.warehouseQcStatus === 'failed') qcFailedCount++;
    }

    return {
      totalCases: allCases.length,
      totalNdr,
      totalRto,
      totalRestocked,
      qcPassedCount,
      qcFailedCount,
      ndrAging: {
        lessThan24h: Number(aging24[0]?.count || 0),
        between24and48h: Number(aging48[0]?.count || 0),
        between48and72h: Number(aging72[0]?.count || 0),
        greaterThan72h: Number(agingOlder[0]?.count || 0),
      },
    };
  }
}
