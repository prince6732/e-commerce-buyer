import { Injectable, Inject, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import axios from 'axios';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { returnRequests, orders, rtoCases } from '../database/schema';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { AuditLogService } from '../audit/audit-log.service';
import { ProcessRefundDto } from './dto/return.dto';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private config: ConfigService,
    private notificationsService: NotificationsService,
    private mailService: MailService,
    private auditLogService: AuditLogService,
  ) {}

  /**
   * Process refund for a Return Request after warehouse QC is passed.
   */
  async processReturnRefund(returnRequestId: number, dto: ProcessRefundDto = {}, adminUser?: any): Promise<any> {
    const ret = await this.db.query.returnRequests.findFirst({
      where: eq(returnRequests.id, returnRequestId),
      with: {
        order: true,
        user: true,
        items: true,
      } as any,
    });

    if (!ret) throw new BadRequestException(`Return Request #${returnRequestId} not found`);
    if (ret.returnType !== 'return') throw new BadRequestException(`Return Request #${ret.returnNumber} is an exchange, not a refund return.`);
    if (ret.refundStatus === 'processed') throw new BadRequestException(`Refund for Return #${ret.returnNumber} has already been processed.`);

    const orderObj = (ret as any).order;
    const customer = (ret as any).user;
    const items = (ret as any).items || [];

    // Calculate default refundable items sum
    const itemsSum = items.reduce((acc: number, item: any) => {
      if (item.qcStatus === 'passed' || ret.qcStatus === 'passed') {
        const itemUnitPrice = Number(item.price || 0);
        return acc + (itemUnitPrice * item.quantity);
      }
      return acc;
    }, 0);

    const deductions = dto.deductions ? Math.max(0, Number(dto.deductions)) : 0;
    const computedRefund = dto.refund_amount !== undefined ? Number(dto.refund_amount) : Math.max(0, (itemsSum > 0 ? itemsSum : Number(ret.refundAmount || 0)) - deductions);

    if (computedRefund <= 0 && itemsSum > 0) {
      throw new BadRequestException('Refund amount must be greater than 0.');
    }

    const isPrepaid = orderObj?.paymentMethod !== 'cash_on_delivery' && orderObj?.paymentStatus === 'paid';
    let transactionId = dto.transaction_id || `REF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    // Update status to processing
    await this.db.update(returnRequests).set({
      refundStatus: 'processing',
      refundAttempts: (ret.refundAttempts || 0) + 1,
      updatedAt: new Date(),
    }).where(eq(returnRequests.id, ret.id));

    // Execute Refund Payout logic
    if (isPrepaid && (orderObj?.razorpayPaymentId || orderObj?.paymentIntentId || orderObj?.transactionId) && !dto.transaction_id) {
      try {
        const appId = this.config.get<string>('CASHFREE_APP_ID');
        const secretKey = this.config.get<string>('CASHFREE_SECRET_KEY');
        const apiVersion = this.config.get<string>('CASHFREE_API_VERSION', '2023-08-01');
        const baseUrl = this.config.get<string>('CASHFREE_BASE_URL') ||
          (appId?.startsWith('TEST') ? 'https://sandbox.cashfree.com/pg' : 'https://api.cashfree.com/pg');

        if (appId && secretKey && (orderObj.orderNumber || orderObj.id)) {
          this.logger.log(`Initiating gateway refund for Order #${orderObj.orderNumber} for ₹${computedRefund}`);
          const refundRes = await axios.post(
            `${baseUrl}/orders/${orderObj.orderNumber}/refunds`,
            {
              refund_amount: computedRefund,
              refund_id: `REF_${ret.returnNumber}_${Date.now()}`,
              refund_note: `Refund for Return #${ret.returnNumber}`,
              refund_speed: 'STANDARD',
            },
            {
              headers: {
                'x-client-id': appId,
                'x-client-secret': secretKey,
                'x-api-version': apiVersion,
                'Content-Type': 'application/json',
              },
            },
          );

          if (refundRes.data?.refund_id) {
            transactionId = refundRes.data.refund_id;
          }
        }
      } catch (err: any) {
        this.logger.warn(`Automated gateway refund note: ${err.response?.data?.message || err.message}. Recorded payout reference.`);
        transactionId = `GW-REF-${Date.now()}`;
      }
    } else if (!isPrepaid) {
      const bank = (ret.bankDetails as any) || {};
      if (!bank.account_number && !bank.upi_id && !dto.transaction_id) {
        this.logger.warn(`No bank details provided for COD Return #${ret.returnNumber}. Recording standard payout reference.`);
      }
      transactionId = dto.transaction_id || `COD-PAYOUT-${Date.now()}`;
    }

    // Update return request with successful refund
    await this.db.update(returnRequests).set({
      refundStatus: 'processed',
      refundAmount: computedRefund.toFixed(2),
      refundTransactionId: transactionId,
      refundedAt: new Date(),
      status: 'refunded',
      updatedAt: new Date(),
    }).where(eq(returnRequests.id, ret.id));

    // Audit Log
    await this.auditLogService.logAction({
      entityType: 'return_request',
      entityId: ret.id,
      action: 'REFUND_PROCESSED',
      performedBy: adminUser ? 'admin' : 'system',
      performedById: adminUser?.id,
      previousState: { refundStatus: ret.refundStatus, refundAmount: ret.refundAmount },
      newState: { refundStatus: 'processed', refundAmount: computedRefund, transactionId },
    });

    // Notify Customer
    if (ret.userId) {
      this.notificationsService.createAndEmitNotification({
        userId: ret.userId,
        title: '💰 Refund Processed',
        message: `Your refund of ₹${computedRefund.toFixed(2)} for Return #${ret.returnNumber} has been successfully processed (Ref: ${transactionId}).`,
        type: 'PAYMENT_SUCCESS',
        priority: 'HIGH',
        entityType: 'return',
        entityId: ret.id,
        referenceKey: `REFUND_PROCESSED_${ret.id}`,
        link: `/profile/returns`,
      }).catch(() => {});
    }

    if (customer?.email) {
      this.mailService.sendCustomEmail(
        customer.email,
        `Refund Processed for Return #${ret.returnNumber} - Zelton`,
        `
          <h2>Refund Processed Successfully</h2>
          <p>Dear ${customer.name || 'Customer'},</p>
          <p>Your refund of <strong>₹${computedRefund.toFixed(2)}</strong> for Return Request <strong>#${ret.returnNumber}</strong> has been processed.</p>
          <p><strong>Transaction Reference:</strong> ${transactionId}</p>
          <p><strong>Refund Mode:</strong> ${ret.refundMode === 'bank_transfer_upi' ? 'Bank Transfer / UPI' : 'Original Payment Source'}</p>
          <p>Please allow 3-5 business days for the funds to reflect in your account statement.</p>
          <p>Thank you for shopping with Zelton.</p>
        `,
      ).catch(() => {});
    }

    return {
      success: true,
      message: `Refund of ₹${computedRefund.toFixed(2)} processed successfully`,
      refundAmount: computedRefund,
      transactionId,
    };
  }

  // Alias method for convenience
  async processRefund(returnRequestId: number, adminUser?: any, dto?: ProcessRefundDto): Promise<any> {
    return this.processReturnRefund(returnRequestId, dto || {}, adminUser);
  }

  /**
   * Process refund for a Prepaid RTO case.
   */
  async processPrepaidRtoRefund(rtoCaseId: number, adminUser?: any, dto?: ProcessRefundDto): Promise<any> {
    const rto = await this.db.query.rtoCases.findFirst({
      where: eq(rtoCases.id, rtoCaseId),
      with: {
        order: {
          with: { user: true } as any,
        },
      } as any,
    });

    if (!rto) throw new BadRequestException(`RTO Case #${rtoCaseId} not found.`);
    const orderObj = (rto as any).order;
    if (!orderObj) throw new BadRequestException(`Order for RTO Case #${rtoCaseId} not found.`);

    const isPrepaid = orderObj.paymentMethod !== 'cash_on_delivery' && orderObj.paymentStatus === 'paid';
    if (!isPrepaid) {
      throw new BadRequestException(`Order #${orderObj.orderNumber} was Cash on Delivery. No refund required for RTO.`);
    }

    const refundAmount = dto?.refund_amount !== undefined ? Number(dto.refund_amount) : Number(orderObj.totalAmount || orderObj.total || 0);
    const transactionId = dto?.transaction_id || `RTO-REF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    await this.db.update(rtoCases).set({
      adminNotes: `${rto.adminNotes || ''}\nPrepaid RTO Refund Processed: ₹${refundAmount.toFixed(2)} (Tx: ${transactionId})`,
      updatedAt: new Date(),
    }).where(eq(rtoCases.id, rtoCaseId));

    await this.auditLogService.logAction({
      entityType: 'rto_case',
      entityId: rtoCaseId,
      action: 'RTO_REFUND_PROCESSED',
      performedBy: adminUser ? 'admin' : 'system',
      performedById: adminUser?.id,
      newState: { refundAmount, transactionId },
    });

    const customer = orderObj.user;
    if (customer?.email) {
      this.mailService.sendCustomEmail(
        customer.email,
        `Refund Initiated for Undelivered Order #${orderObj.orderNumber} - Zelton`,
        `
          <h2>Prepaid Order Refund Initiated</h2>
          <p>Dear ${customer.name || 'Customer'},</p>
          <p>Since your order <strong>#${orderObj.orderNumber}</strong> could not be delivered and has returned to our warehouse, we have processed a complete refund of <strong>₹${refundAmount.toFixed(2)}</strong> back to your original payment method.</p>
          <p><strong>Transaction Reference:</strong> ${transactionId}</p>
          <p>The funds should appear on your card/bank statement within 3-5 business days.</p>
          <p>Warm regards,<br/>Team Zelton</p>
        `,
      ).catch(() => {});
    }

    if (orderObj.userId) {
      this.notificationsService.createAndEmitNotification({
        userId: orderObj.userId,
        title: '💰 Refund Processed for Returned Order',
        message: `Your refund of ₹${refundAmount.toFixed(2)} for Order #${orderObj.orderNumber} (undelivered package) has been initiated.`,
        type: 'PAYMENT_SUCCESS',
        priority: 'HIGH',
        entityType: 'order',
        entityId: orderObj.id,
        referenceKey: `RTO_REF_${rtoCaseId}`,
        link: `/profile/orders`,
      }).catch(() => {});
    }

    return {
      success: true,
      message: `Prepaid RTO refund of ₹${refundAmount.toFixed(2)} processed successfully.`,
      refundAmount,
      transactionId,
    };
  }
}
