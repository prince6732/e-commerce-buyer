import { Injectable, Inject, Logger } from '@nestjs/common';
import { eq, and, or, desc, sql, inArray, like } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { notifications, notificationPreferences, adminNotificationPreferences, users } from '../database/schema';
import { NotificationsGateway } from './notifications.gateway';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';

export class CreateNotificationDto {
  userId?: number | null;
  recipientGroup?: 'admin' | 'customer' | 'global';
  title!: string;
  message!: string;
  type?: string; // ACCOUNT, ORDER, PAYMENT, REFUND, RETURN, EXCHANGE, PRODUCT, MARKETING, SHIPPING, INVENTORY, CUSTOMER, SYSTEM etc.
  priority?: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';
  entityType?: string;
  entityId?: number;
  link?: string;
  referenceKey?: string;
  metadata?: any;
  userEmail?: string;
}

export class UpdatePreferencesDto {
  inAppOrders?: boolean;
  inAppPayments?: boolean;
  inAppShipping?: boolean;
  inAppReturns?: boolean;
  inAppProducts?: boolean;
  inAppMarketing?: boolean;
  emailOrders?: boolean;
  emailPayments?: boolean;
  emailShipping?: boolean;
  emailReturns?: boolean;
  emailProducts?: boolean;
  emailMarketing?: boolean;
}

export class UpdateAdminPreferencesDto {
  inAppOrders?: boolean;
  inAppPayments?: boolean;
  inAppInventory?: boolean;
  inAppReturns?: boolean;
  inAppShipping?: boolean;
  inAppCustomers?: boolean;
  inAppSystem?: boolean;
  emailOrders?: boolean;
  emailPayments?: boolean;
  emailInventory?: boolean;
  emailReturns?: boolean;
  emailShipping?: boolean;
  emailCustomers?: boolean;
  emailSystem?: boolean;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  // ─── 1. Create & Emit Notification ──────────────────────────────────────────
  async createAndEmitNotification(dto: CreateNotificationDto) {
    try {
      const recipientGroup = dto.recipientGroup || (dto.userId ? 'customer' : 'admin');
      const type = (dto.type || 'system').toUpperCase();
      const priority = dto.priority || this.resolvePriority(type);
      const userId = dto.userId ? Number(dto.userId) : null;

      // Idempotency check: prevent duplicate notifications for same event
      if (dto.referenceKey) {
        const existing = await this.db.query.notifications.findFirst({
          where: eq(notifications.referenceKey, dto.referenceKey),
        });
        if (existing) {
          this.logger.log(`Skipping duplicate notification [Ref: ${dto.referenceKey}]`);
          return existing;
        }
      }

      let allowInApp = true;
      let allowEmail = true;

      // Check Preferences for Customer vs Admin
      if (recipientGroup === 'customer' && userId) {
        const prefs = await this.getPreferences(userId);
        const category = this.resolveCategory(type);

        if (!['SECURITY_ALERT', 'PASSWORD_RESET', 'PASSWORD_CHANGED', 'EMAIL_VERIFICATION'].includes(type)) {
          if (category === 'ORDERS') {
            allowInApp = prefs.inAppOrders;
            allowEmail = prefs.emailOrders;
          } else if (category === 'PAYMENTS') {
            allowInApp = prefs.inAppPayments;
            allowEmail = prefs.emailPayments;
          } else if (category === 'SHIPPING') {
            allowInApp = prefs.inAppShipping;
            allowEmail = prefs.emailShipping;
          } else if (category === 'RETURNS') {
            allowInApp = prefs.inAppReturns;
            allowEmail = prefs.emailReturns;
          } else if (category === 'PRODUCTS') {
            allowInApp = prefs.inAppProducts;
            allowEmail = prefs.emailProducts;
          } else if (category === 'MARKETING') {
            allowInApp = prefs.inAppMarketing;
            allowEmail = prefs.emailMarketing;
          }
        }
      } else if (recipientGroup === 'admin') {
        const adminUsers = await this.db.query.users.findMany({
          where: or(eq(users.role, 'Admin'), eq(users.role, 'superadmin'), eq(users.role, 'Manager')),
        });

        const primaryAdmin = adminUsers[0];
        if (primaryAdmin) {
          const adminPrefs = await this.getAdminPreferences(primaryAdmin.id);
          const category = this.resolveCategory(type);

          if (!['SYSTEM_ERROR', 'PAYMENT_GATEWAY_ERROR', 'BACKUP_FAILED'].includes(type)) {
            if (category === 'ORDERS') {
              allowInApp = adminPrefs.inAppOrders;
              allowEmail = adminPrefs.emailOrders;
            } else if (category === 'PAYMENTS') {
              allowInApp = adminPrefs.inAppPayments;
              allowEmail = adminPrefs.emailPayments;
            } else if (category === 'INVENTORY' || category === 'PRODUCTS') {
              allowInApp = adminPrefs.inAppInventory;
              allowEmail = adminPrefs.emailInventory;
            } else if (category === 'RETURNS') {
              allowInApp = adminPrefs.inAppReturns;
              allowEmail = adminPrefs.emailReturns;
            } else if (category === 'SHIPPING') {
              allowInApp = adminPrefs.inAppShipping;
              allowEmail = adminPrefs.emailShipping;
            } else if (category === 'CUSTOMERS') {
              allowInApp = adminPrefs.inAppCustomers;
              allowEmail = adminPrefs.emailCustomers;
            } else if (category === 'SYSTEM') {
              allowInApp = adminPrefs.inAppSystem;
              allowEmail = adminPrefs.emailSystem;
            }
          }
        }
      }

      let createdNotification: any = null;

      // Save to database if In-App allowed
      if (allowInApp) {
        const [result] = await this.db.insert(notifications).values({
          userId,
          recipientGroup,
          title: dto.title,
          message: dto.message,
          type,
          priority,
          entityType: dto.entityType ?? null,
          entityId: dto.entityId ? Number(dto.entityId) : null,
          link: dto.link ?? null,
          isRead: false,
          referenceKey: dto.referenceKey ?? null,
          metadata: dto.metadata ?? null,
        });

        const notificationId = result?.insertId;

        createdNotification = {
          id: notificationId,
          userId,
          recipientGroup,
          title: dto.title,
          message: dto.message,
          type,
          priority,
          entityType: dto.entityType ?? null,
          entityId: dto.entityId ? Number(dto.entityId) : null,
          link: dto.link ?? null,
          isRead: false,
          referenceKey: dto.referenceKey ?? null,
          metadata: dto.metadata ?? null,
          createdAt: new Date(),
        };

        // Emit real-time WebSocket event
        if (recipientGroup === 'admin') {
          this.notificationsGateway.emitToRoom('admin', 'notification:new', createdNotification);
        } else if (userId) {
          this.notificationsGateway.emitToRoom(`user_${userId}`, 'notification:new', createdNotification);
        } else if (recipientGroup === 'global') {
          this.notificationsGateway.emitToAll('notification:new', createdNotification);
        }

        this.logger.log(`Created notification [${type}/${priority}] for [${recipientGroup}] user [${userId ?? 'all'}]`);
      }

      // Send Transactional Email
      if (allowEmail) {
        if (recipientGroup === 'admin' && this.shouldSendAdminEmail(type)) {
          const adminEmail = this.config.get<string>('ADMIN_EMAIL', 'admin@topntech.com');
          this.mailService
            .sendAdminAlertEmail(adminEmail, `🚨 Super Admin Alert: ${dto.title}`, dto.title, dto.message, dto.link, priority)
            .catch((err) => this.logger.error(`Failed sending admin alert email to ${adminEmail}:`, err));
        } else if (recipientGroup === 'customer' && this.shouldSendCustomerEmail(type)) {
          let recipientEmail = dto.userEmail;
          if (!recipientEmail && userId) {
            const userRec = await this.db.query.users.findFirst({
              where: eq(users.id, userId),
              columns: { email: true },
            });
            recipientEmail = userRec?.email;
          }

          if (recipientEmail) {
            this.mailService
              .sendNotificationEmail(recipientEmail, `Zelton: ${dto.title}`, dto.title, dto.message, dto.link, priority)
              .catch((err) => this.logger.error(`Failed sending customer notification email to ${recipientEmail}:`, err));
          }
        }
      }

      return createdNotification;
    } catch (error) {
      this.logger.error('Failed to create and emit notification:', error);
      throw error;
    }
  }

  // ─── 2. Stock Threshold Intelligent Alert Engine ─────────────────────────────
  async checkAndTriggerStockAlert(params: {
    productId: number;
    variantId: number;
    title: string;
    currentStock: number;
    previousStock: number;
    threshold?: number;
  }) {
    const threshold = params.threshold ?? 5;

    if (params.currentStock === 0 && params.previousStock !== 0) {
      // OUT_OF_STOCK
      await this.createAndEmitNotification({
        recipientGroup: 'admin',
        title: '🚨 Product Out of Stock',
        message: `"${params.title}" is completely OUT OF STOCK (0 units remaining).`,
        type: 'OUT_OF_STOCK',
        priority: 'CRITICAL',
        entityType: 'product',
        entityId: params.productId,
        referenceKey: `OUT_OF_STOCK_${params.variantId}_${Date.now()}`,
        link: `/dashboard/products/${params.productId}`,
      });
    } else if (params.currentStock <= threshold && params.previousStock > threshold) {
      // LOW_STOCK
      await this.createAndEmitNotification({
        recipientGroup: 'admin',
        title: '📉 Low Stock Warning',
        message: `"${params.title}" has only ${params.currentStock} units remaining (Threshold: ${threshold}).`,
        type: 'LOW_STOCK',
        priority: 'HIGH',
        entityType: 'product',
        entityId: params.productId,
        referenceKey: `LOW_STOCK_${params.variantId}`,
        link: `/dashboard/products/${params.productId}`,
      });
    }
  }

  // ─── 3. Fetch Notifications with Pagination & Filtering ────────────────────
  async getNotifications(options: {
    userId?: number;
    recipientGroup?: string;
    category?: string;
    priority?: string;
    isRead?: boolean;
    search?: string;
    page?: number;
    limit?: number;
    offset?: number;
  }) {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = options.offset !== undefined ? options.offset : (page - 1) * limit;

    let baseCondition;
    if (options.userId) {
      baseCondition = or(
        eq(notifications.userId, options.userId),
        eq(notifications.recipientGroup, 'global'),
      );
    } else if (options.recipientGroup === 'admin') {
      baseCondition = or(
        eq(notifications.recipientGroup, 'admin'),
        eq(notifications.recipientGroup, 'global'),
      );
    } else {
      baseCondition = eq(notifications.recipientGroup, 'global');
    }

    const conditions: any[] = [];
    if (baseCondition) conditions.push(baseCondition);

    if (options.isRead !== undefined) {
      conditions.push(eq(notifications.isRead, options.isRead));
    }

    if (options.priority) {
      conditions.push(eq(notifications.priority, options.priority.toUpperCase()));
    }

    if (options.search && options.search.trim()) {
      const searchTerm = `%${options.search.trim()}%`;
      conditions.push(
        or(
          like(notifications.title, searchTerm),
          like(notifications.message, searchTerm),
          like(notifications.type, searchTerm),
        ),
      );
    }

    const finalCondition = conditions.length > 1 ? and(...conditions) : conditions[0];

    // Total count for pagination
    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(finalCondition);
    const total = Number(countResult?.count || 0);

    let items = await this.db
      .select()
      .from(notifications)
      .where(finalCondition)
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);

    // Apply category filter
    if (options.category && options.category.toUpperCase() !== 'ALL') {
      const cat = options.category.toUpperCase();
      items = items.filter((n) => this.resolveCategory(n.type) === cat);
    }

    const [unreadResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(baseCondition, eq(notifications.isRead, false)));

    const unreadCount = Number(unreadResult?.count || 0);
    const lastPage = Math.max(1, Math.ceil(total / limit));
    const hasNextPage = page < lastPage;

    return {
      notifications: items,
      data: items,
      unreadCount,
      page,
      limit,
      per_page: limit,
      total,
      last_page: lastPage,
      totalPages: lastPage,
      hasNextPage,
      has_next_page: hasNextPage,
      has_more: hasNextPage,
    };
  }

  // ─── 4. Unread Count ────────────────────────────────────────────────────────
  async getUnreadCount(options: { userId?: number; recipientGroup?: string }) {
    let condition;
    if (options.userId) {
      condition = or(
        eq(notifications.userId, options.userId),
        eq(notifications.recipientGroup, 'global'),
      );
    } else if (options.recipientGroup === 'admin') {
      condition = or(
        eq(notifications.recipientGroup, 'admin'),
        eq(notifications.recipientGroup, 'global'),
      );
    } else {
      condition = eq(notifications.recipientGroup, 'global');
    }

    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(condition, eq(notifications.isRead, false)));

    return { unreadCount: Number(result?.count || 0) };
  }

  // ─── 5. Mark As Read ────────────────────────────────────────────────────────
  async markAsRead(id: number, userId?: number) {
    const condition = userId
      ? and(eq(notifications.id, id), eq(notifications.userId, userId))
      : eq(notifications.id, id);

    await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(condition);

    if (userId) {
      const { unreadCount } = await this.getUnreadCount({ userId });
      this.notificationsGateway.emitToRoom(`user_${userId}`, 'notification:read', { id, unreadCount });
      this.notificationsGateway.emitToRoom(`user_${userId}`, 'notification:unread-count', { unreadCount });
    } else {
      const { unreadCount } = await this.getUnreadCount({ recipientGroup: 'admin' });
      this.notificationsGateway.emitToRoom('admin', 'notification:read', { id, unreadCount });
      this.notificationsGateway.emitToRoom('admin', 'notification:unread-count', { unreadCount });
    }

    return { success: true, id };
  }

  // ─── 6. Mark All As Read ───────────────────────────────────────────────────
  async markAllAsRead(options: { userId?: number; recipientGroup?: string }) {
    let condition;
    if (options.userId) {
      condition = eq(notifications.userId, options.userId);
    } else if (options.recipientGroup) {
      condition = eq(notifications.recipientGroup, options.recipientGroup);
    }

    const finalCondition = condition
      ? and(condition, eq(notifications.isRead, false))
      : eq(notifications.isRead, false);

    await this.db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(finalCondition);

    if (options.userId) {
      this.notificationsGateway.emitToRoom(`user_${options.userId}`, 'notification:read-all', { unreadCount: 0 });
      this.notificationsGateway.emitToRoom(`user_${options.userId}`, 'notification:unread-count', { unreadCount: 0 });
    } else if (options.recipientGroup === 'admin') {
      this.notificationsGateway.emitToRoom('admin', 'notification:read-all', { unreadCount: 0 });
      this.notificationsGateway.emitToRoom('admin', 'notification:unread-count', { unreadCount: 0 });
    }

    return { success: true };
  }

  // ─── 7. Delete Individual Notification ─────────────────────────────────────
  async deleteNotification(id: number, userId?: number) {
    const condition = userId
      ? and(eq(notifications.id, id), eq(notifications.userId, userId))
      : eq(notifications.id, id);

    await this.db.delete(notifications).where(condition);

    if (userId) {
      const { unreadCount } = await this.getUnreadCount({ userId });
      this.notificationsGateway.emitToRoom(`user_${userId}`, 'notification:deleted', { id, unreadCount });
      this.notificationsGateway.emitToRoom(`user_${userId}`, 'notification:unread-count', { unreadCount });
    } else {
      const { unreadCount } = await this.getUnreadCount({ recipientGroup: 'admin' });
      this.notificationsGateway.emitToRoom('admin', 'notification:deleted', { id, unreadCount });
      this.notificationsGateway.emitToRoom('admin', 'notification:unread-count', { unreadCount });
    }

    return { success: true, id };
  }

  // ─── 8. Bulk Delete Notifications ──────────────────────────────────────────
  async bulkDeleteNotifications(userId?: number, body?: { ids?: number[]; allRead?: boolean }) {
    if (userId) {
      if (body?.allRead) {
        await this.db
          .delete(notifications)
          .where(and(eq(notifications.userId, userId), eq(notifications.isRead, true)));
      } else if (body?.ids && body.ids.length > 0) {
        await this.db
          .delete(notifications)
          .where(and(eq(notifications.userId, userId), inArray(notifications.id, body.ids)));
      }
      const { unreadCount } = await this.getUnreadCount({ userId });
      this.notificationsGateway.emitToRoom(`user_${userId}`, 'notification:bulk-deleted', { unreadCount });
      this.notificationsGateway.emitToRoom(`user_${userId}`, 'notification:unread-count', { unreadCount });
      return { success: true, unreadCount };
    } else {
      // Admin Bulk Delete
      if (body?.allRead) {
        await this.db
          .delete(notifications)
          .where(and(eq(notifications.recipientGroup, 'admin'), eq(notifications.isRead, true)));
      } else if (body?.ids && body.ids.length > 0) {
        await this.db
          .delete(notifications)
          .where(and(eq(notifications.recipientGroup, 'admin'), inArray(notifications.id, body.ids)));
      }
      const { unreadCount } = await this.getUnreadCount({ recipientGroup: 'admin' });
      this.notificationsGateway.emitToRoom('admin', 'notification:bulk-deleted', { unreadCount });
      this.notificationsGateway.emitToRoom('admin', 'notification:unread-count', { unreadCount });
      return { success: true, unreadCount };
    }
  }

  // ─── 9. Preferences Management ──────────────────────────────────────────────
  async getPreferences(userId: number) {
    let prefs = await this.db.query.notificationPreferences.findFirst({
      where: eq(notificationPreferences.userId, userId),
    });

    if (!prefs) {
      await this.db.insert(notificationPreferences).values({
        userId,
        inAppOrders: true,
        inAppPayments: true,
        inAppShipping: true,
        inAppReturns: true,
        inAppProducts: true,
        inAppMarketing: true,
        emailOrders: true,
        emailPayments: true,
        emailShipping: true,
        emailReturns: true,
        emailProducts: true,
        emailMarketing: true,
      });

      prefs = await this.db.query.notificationPreferences.findFirst({
        where: eq(notificationPreferences.userId, userId),
      });
    }

    return prefs!;
  }

  async updatePreferences(userId: number, dto: UpdatePreferencesDto) {
    await this.getPreferences(userId);
    await this.db
      .update(notificationPreferences)
      .set(dto)
      .where(eq(notificationPreferences.userId, userId));
    return this.getPreferences(userId);
  }

  async getAdminPreferences(userId: number) {
    let prefs = await this.db.query.adminNotificationPreferences.findFirst({
      where: eq(adminNotificationPreferences.userId, userId),
    });

    if (!prefs) {
      await this.db.insert(adminNotificationPreferences).values({
        userId,
        inAppOrders: true,
        inAppPayments: true,
        inAppInventory: true,
        inAppReturns: true,
        inAppShipping: true,
        inAppCustomers: true,
        inAppSystem: true,
        emailOrders: false,
        emailPayments: true,
        emailInventory: true,
        emailReturns: true,
        emailShipping: true,
        emailCustomers: true,
        emailSystem: true,
      });

      prefs = await this.db.query.adminNotificationPreferences.findFirst({
        where: eq(adminNotificationPreferences.userId, userId),
      });
    }

    return prefs!;
  }

  async updateAdminPreferences(userId: number, dto: UpdateAdminPreferencesDto) {
    await this.getAdminPreferences(userId);
    await this.db
      .update(adminNotificationPreferences)
      .set(dto)
      .where(eq(adminNotificationPreferences.userId, userId));
    return this.getAdminPreferences(userId);
  }

  // ─── Helper Resolvers ──────────────────────────────────────────────────────
  private resolvePriority(type: string): 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' {
    const t = type.toUpperCase();
    if (['SECURITY_ALERT', 'PAYMENT_FAILED', 'DELIVERY_FAILED', 'SHIPMENT_RTO', 'SHIPMENT_LOST', 'OUT_OF_STOCK', 'PAYMENT_GATEWAY_ERROR', 'SYSTEM_ERROR', 'BACKUP_FAILED'].includes(t)) {
      return 'CRITICAL';
    }
    if (['ORDER_PLACED', 'ORDER_SHIPPED', 'ORDER_CANCELLED', 'CANCELLATION_REQUESTED', 'REFUND_REQUESTED', 'REFUND_FAILED', 'RETURN_REQUESTED', 'EXCHANGE_REQUESTED', 'SHIPMENT_CREATION_FAILED', 'CUSTOMER_COMPLAINT', 'LOW_STOCK'].includes(t)) {
      return 'HIGH';
    }
    if (['NEW_OFFER', 'COUPON_AVAILABLE', 'FLASH_SALE', 'PRICE_DROP', 'NEW_CUSTOMER'].includes(t)) {
      return 'LOW';
    }
    return 'NORMAL';
  }

  private resolveCategory(type: string): string {
    const t = type.toUpperCase();
    if (t.startsWith('ORDER_') || t.startsWith('CANCELLATION_') || t === 'ORDER') return 'ORDERS';
    if (t.startsWith('PAYMENT_') || t.startsWith('REFUND_') || t === 'PAYMENT') return 'PAYMENTS';
    if (t.startsWith('SHIPMENT_') || t.startsWith('DELIVERY_') || t === 'SHIPPING') return 'SHIPPING';
    if (t.startsWith('RETURN_') || t.startsWith('EXCHANGE_')) return 'RETURNS';
    if (t.startsWith('PRODUCT_') || t === 'LOW_STOCK' || t === 'OUT_OF_STOCK' || t === 'STOCK') return 'INVENTORY';
    if (['NEW_CUSTOMER', 'NEW_REVIEW', 'CUSTOMER_COMPLAINT', 'CONTACT'].includes(t)) return 'CUSTOMERS';
    if (['NEW_OFFER', 'COUPON_AVAILABLE', 'FLASH_SALE', 'PROMO'].includes(t)) return 'MARKETING';
    if (['WELCOME', 'EMAIL_VERIFICATION', 'PASSWORD_CHANGED', 'SECURITY_ALERT', 'ACCOUNT'].includes(t)) return 'ACCOUNT';
    return 'SYSTEM';
  }

  private shouldSendCustomerEmail(type: string): boolean {
    const t = type.toUpperCase();
    const emailTypes = [
      'WELCOME',
      'EMAIL_VERIFICATION',
      'PASSWORD_RESET',
      'PASSWORD_CHANGED',
      'SECURITY_ALERT',
      'ORDER_SHIPPED',
      'ORDER_DELIVERED',
      'PAYMENT_SUCCESS',
      'PAYMENT_FAILED',
      'REFUND_INITIATED',
      'REFUND_COMPLETED',
      'RETURN_APPROVED',
      'RETURN_REJECTED',
      'RETURN_COMPLETED',
      'EXCHANGE_APPROVED',
      'REPLACEMENT_SHIPPED',
      'DELIVERY_FAILED',
      'SHIPMENT_DELAYED',
      'SHIPMENT_RTO',
    ];
    return emailTypes.includes(t);
  }

  private shouldSendAdminEmail(type: string): boolean {
    const t = type.toUpperCase();
    const adminEmailTypes = [
      'CANCELLATION_REQUESTED',
      'PAYMENT_FAILED',
      'REFUND_REQUESTED',
      'REFUND_FAILED',
      'OUT_OF_STOCK',
      'RETURN_REQUESTED',
      'EXCHANGE_REQUESTED',
      'SHIPMENT_CREATION_FAILED',
      'DELIVERY_FAILED',
      'SHIPMENT_RTO',
      'SHIPMENT_LOST',
      'CUSTOMER_COMPLAINT',
      'PAYMENT_GATEWAY_ERROR',
      'SHIPPING_API_ERROR',
      'EMAIL_SERVICE_ERROR',
      'SMS_SERVICE_ERROR',
      'SYSTEM_ERROR',
      'BACKUP_FAILED',
    ];
    return adminEmailTypes.includes(t);
  }
}
