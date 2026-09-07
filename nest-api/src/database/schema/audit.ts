import { relations } from 'drizzle-orm';
import {
  mysqlTable,
  bigint,
  varchar,
  text,
  json,
  boolean,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/mysql-core';
import { users } from './users';

export const adminAuditLogs = mysqlTable('admin_audit_logs', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  adminId: bigint('admin_id', { mode: 'number', unsigned: true })
    .references(() => users.id, { onDelete: 'set null' }),
  action: varchar('action', { length: 255 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: bigint('entity_id', { mode: 'number', unsigned: true }).notNull(),
  oldValue: json('old_value'),
  newValue: json('new_value'),
  reason: text('reason'),
  ipAddress: varchar('ip_address', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const courierWebhookEvents = mysqlTable('courier_webhook_events', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  courier: varchar('courier', { length: 100 }).default('Delhivery').notNull(),
  eventId: varchar('event_id', { length: 255 }).notNull(),
  waybill: varchar('waybill', { length: 255 }),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  payload: json('payload'),
  processed: boolean('processed').default(false).notNull(),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  courierEventIdx: uniqueIndex('courier_event_idx').on(t.courier, t.eventId),
}));

export const adminAuditLogsRelations = relations(adminAuditLogs, ({ one }) => ({
  admin: one(users, {
    fields: [adminAuditLogs.adminId],
    references: [users.id],
  }),
}));

export type AdminAuditLog = typeof adminAuditLogs.$inferSelect;
export type CourierWebhookEvent = typeof courierWebhookEvents.$inferSelect;
