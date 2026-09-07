import { relations } from 'drizzle-orm';
import {
  mysqlTable,
  bigint,
  varchar,
  text,
  boolean,
  json,
  timestamp,
} from 'drizzle-orm/mysql-core';
import { users } from './users';

export const notifications = mysqlTable('notifications', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }).references(() => users.id, { onDelete: 'cascade' }),
  recipientGroup: varchar('recipient_group', { length: 50 }).default('admin').notNull(), // 'admin' | 'customer' | 'global'
  title: varchar('title', { length: 255 }).notNull(),
  message: text('message').notNull(),
  type: varchar('type', { length: 50 }).default('system').notNull(), // ACCOUNT, ORDER, PAYMENT, REFUND, RETURN, EXCHANGE, PRODUCT, MARKETING, SHIPPING etc.
  priority: varchar('priority', { length: 20 }).default('NORMAL').notNull(), // 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW'
  entityType: varchar('entity_type', { length: 50 }), // 'order' | 'payment' | 'return' | 'refund' | 'product' | 'user' | 'shipping'
  entityId: bigint('entity_id', { mode: 'number', unsigned: true }),
  link: varchar('link', { length: 500 }),
  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at'),
  referenceKey: varchar('reference_key', { length: 255 }), // Idempotency / duplicate prevention key
  metadata: json('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const notificationPreferences = mysqlTable('notification_preferences', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }).references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  inAppOrders: boolean('in_app_orders').default(true).notNull(),
  inAppPayments: boolean('in_app_payments').default(true).notNull(),
  inAppShipping: boolean('in_app_shipping').default(true).notNull(),
  inAppReturns: boolean('in_app_returns').default(true).notNull(),
  inAppProducts: boolean('in_app_products').default(true).notNull(),
  inAppMarketing: boolean('in_app_marketing').default(true).notNull(),
  emailOrders: boolean('email_orders').default(true).notNull(),
  emailPayments: boolean('email_payments').default(true).notNull(),
  emailShipping: boolean('email_shipping').default(true).notNull(),
  emailReturns: boolean('email_returns').default(true).notNull(),
  emailProducts: boolean('email_products').default(true).notNull(),
  emailMarketing: boolean('email_marketing').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const adminNotificationPreferences = mysqlTable('admin_notification_preferences', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  userId: bigint('user_id', { mode: 'number', unsigned: true }).references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  inAppOrders: boolean('in_app_orders').default(true).notNull(),
  inAppPayments: boolean('in_app_payments').default(true).notNull(),
  inAppInventory: boolean('in_app_inventory').default(true).notNull(),
  inAppReturns: boolean('in_app_returns').default(true).notNull(),
  inAppShipping: boolean('in_app_shipping').default(true).notNull(),
  inAppCustomers: boolean('in_app_customers').default(true).notNull(),
  inAppSystem: boolean('in_app_system').default(true).notNull(),
  emailOrders: boolean('email_orders').default(false).notNull(),
  emailPayments: boolean('email_payments').default(true).notNull(),
  emailInventory: boolean('email_inventory').default(true).notNull(),
  emailReturns: boolean('email_returns').default(true).notNull(),
  emailShipping: boolean('email_shipping').default(true).notNull(),
  emailCustomers: boolean('email_customers').default(true).notNull(),
  emailSystem: boolean('email_system').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

export const adminNotificationPreferencesRelations = relations(adminNotificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [adminNotificationPreferences.userId],
    references: [users.id],
  }),
}));

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference = typeof notificationPreferences.$inferInsert;
export type AdminNotificationPreference = typeof adminNotificationPreferences.$inferSelect;
export type NewAdminNotificationPreference = typeof adminNotificationPreferences.$inferInsert;


