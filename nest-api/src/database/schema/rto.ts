import { relations } from 'drizzle-orm';
import {
  mysqlTable,
  bigint,
  varchar,
  text,
  int,
  json,
  mysqlEnum,
  timestamp,
  boolean,
} from 'drizzle-orm/mysql-core';
import { orders } from './orders';

export const rtoCases = mysqlTable('rto_cases', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  rtoNumber: varchar('rto_number', { length: 255 }).notNull().unique(),
  orderId: bigint('order_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  waybill: varchar('waybill', { length: 255 }).notNull(),
  status: mysqlEnum('status', [
    'ndr',
    'reattempt_requested',
    'rto_initiated',
    'rto_in_transit',
    'rto_received',
    'qc_pending',
    'qc_passed',
    'qc_failed',
    'restocked',
    'completed',
  ]).default('ndr').notNull(),
  ndrAttempts: int('ndr_attempts').default(1).notNull(),
  firstNdrAt: timestamp('first_ndr_at').defaultNow().notNull(),
  lastNdrAt: timestamp('last_ndr_at').defaultNow().notNull(),
  nextReattemptAt: timestamp('next_reattempt_at'),
  ndrActionTaken: mysqlEnum('ndr_action_taken', [
    'reattempt_requested',
    'address_updated',
    'phone_updated',
    'rto_approved',
    'rescheduled',
  ]),
  rtoReason: mysqlEnum('rto_reason', [
    'customer_refused',
    'customer_unreachable',
    'incorrect_address',
    'door_locked',
    'pincode_unserviceable',
    'fake_delivery_attempt',
    'customer_not_available',
    'other',
  ]).default('customer_unreachable').notNull(),
  courierStatus: varchar('courier_status', { length: 255 }),
  courierRemarks: text('courier_remarks'),
  rtoInitiatedAt: timestamp('rto_initiated_at'),
  rtoReceivedAt: timestamp('rto_received_at'),
  warehouseQcStatus: mysqlEnum('warehouse_qc_status', ['pending', 'passed', 'failed']).default('pending').notNull(),
  warehouseQcRemarks: text('warehouse_qc_remarks'),
  inventoryAction: mysqlEnum('inventory_action', ['pending', 'restocked', 'damaged']).default('pending').notNull(),
  inventoryActionAt: timestamp('inventory_action_at'),
  adminNotes: text('admin_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const rtoTrackingEvents = mysqlTable('rto_tracking_events', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  rtoCaseId: bigint('rto_case_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => rtoCases.id, { onDelete: 'cascade' }),
  waybill: varchar('waybill', { length: 255 }).notNull(),
  status: varchar('status', { length: 255 }).notNull(),
  location: varchar('location', { length: 255 }),
  description: text('description'),
  eventTime: timestamp('event_time').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const rtoCasesRelations = relations(rtoCases, ({ one, many }) => ({
  order: one(orders, {
    fields: [rtoCases.orderId],
    references: [orders.id],
  }),
  trackingEvents: many(rtoTrackingEvents),
}));

export const rtoTrackingEventsRelations = relations(rtoTrackingEvents, ({ one }) => ({
  rtoCase: one(rtoCases, {
    fields: [rtoTrackingEvents.rtoCaseId],
    references: [rtoCases.id],
  }),
}));

export type RtoCase = typeof rtoCases.$inferSelect;
export type RtoTrackingEvent = typeof rtoTrackingEvents.$inferSelect;
