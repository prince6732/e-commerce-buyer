import { relations } from 'drizzle-orm';
import {
  mysqlTable,
  bigint,
  varchar,
  text,
  decimal,
  int,
  json,
  mysqlEnum,
  timestamp,
  boolean,
} from 'drizzle-orm/mysql-core';
import { users } from './users';
import { orders, orderItems } from './orders';
import { products, variants } from './products';

export const returnRequests = mysqlTable('return_requests', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  returnNumber: varchar('return_number', { length: 255 }).notNull().unique(),
  orderId: bigint('order_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  userId: bigint('user_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: mysqlEnum('status', [
    'requested',
    'approved',
    'rejected',
    'pickup_scheduled',
    'picked_up',
    'in_transit',
    'received_at_warehouse',
    'qc_pending',
    'qc_passed',
    'qc_failed',
    'refund_pending',
    'refund_processing',
    'refunded',
    'exchange_processing',
    'completed',
    'cancelled',
  ]).default('requested').notNull(),
  returnType: mysqlEnum('return_type', ['return', 'exchange']).default('return').notNull(),
  reason: mysqlEnum('reason', [
    'defective_damaged',
    'wrong_item_received',
    'size_fit_issue',
    'quality_not_expected',
    'different_from_description',
    'missing_parts',
    'product_not_as_expected',
    'other',
  ]).default('defective_damaged').notNull(),
  reasonDetails: text('reason_details'),
  customerImages: json('customer_images'),
  refundMode: mysqlEnum('refund_mode', [
    'original_source',
    'bank_transfer_upi',
    'store_credit',
    'manual_cash',
  ]).default('original_source').notNull(),
  refundStatus: mysqlEnum('refund_status', [
    'not_applicable',
    'pending',
    'processing',
    'processed',
    'failed',
    'cancelled',
  ]).default('pending').notNull(),
  bankDetails: json('bank_details'),
  pickupAddress: json('pickup_address'),
  reverseWaybill: varchar('reverse_waybill', { length: 255 }),
  reverseCourierName: varchar('reverse_courier_name', { length: 255 }).default('Delhivery Reverse'),
  reversePickupDate: timestamp('reverse_pickup_date'),
  refundAmount: decimal('refund_amount', { precision: 10, scale: 2 }).default('0.00'),
  refundTransactionId: varchar('refund_transaction_id', { length: 255 }),
  refundFailureReason: text('refund_failure_reason'),
  refundAttempts: int('refund_attempts').default(0).notNull(),
  refundedAt: timestamp('refunded_at'),
  qcStatus: mysqlEnum('qc_status', ['pending', 'passed', 'failed']).default('pending').notNull(),
  qcRemarks: text('qc_remarks'),
  qcPassedAt: timestamp('qc_passed_at'),
  qcFailedAt: timestamp('qc_failed_at'),
  exchangeRequested: boolean('exchange_requested').default(false).notNull(),
  replacementOrderId: bigint('replacement_order_id', { mode: 'number', unsigned: true }).references(() => orders.id, { onDelete: 'set null' }),
  adminNotes: text('admin_notes'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const returnRequestItems = mysqlTable('return_request_items', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  returnRequestId: bigint('return_request_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => returnRequests.id, { onDelete: 'cascade' }),
  orderItemId: bigint('order_item_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => orderItems.id, { onDelete: 'cascade' }),
  productId: bigint('product_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  variantId: bigint('variant_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => variants.id, { onDelete: 'cascade' }),
  quantity: int('quantity').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  exchangeVariantId: bigint('exchange_variant_id', { mode: 'number', unsigned: true }).references(() => variants.id, { onDelete: 'set null' }),
  qcStatus: mysqlEnum('qc_status', ['pending', 'passed', 'failed']).default('pending').notNull(),
  qcRemarks: text('qc_remarks'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const returnTrackingEvents = mysqlTable('return_tracking_events', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  returnRequestId: bigint('return_request_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => returnRequests.id, { onDelete: 'cascade' }),
  waybill: varchar('waybill', { length: 255 }).notNull(),
  status: varchar('status', { length: 255 }).notNull(),
  statusCode: varchar('status_code', { length: 100 }),
  location: varchar('location', { length: 255 }),
  description: text('description'),
  eventTime: timestamp('event_time').defaultNow().notNull(),
  rawResponse: json('raw_response'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const returnRequestsRelations = relations(returnRequests, ({ one, many }) => ({
  order: one(orders, {
    fields: [returnRequests.orderId],
    references: [orders.id],
    relationName: 'orderReturnRequests',
  }),
  replacementOrder: one(orders, {
    fields: [returnRequests.replacementOrderId],
    references: [orders.id],
    relationName: 'replacementOrder',
  }),
  user: one(users, {
    fields: [returnRequests.userId],
    references: [users.id],
  }),
  items: many(returnRequestItems),
  trackingEvents: many(returnTrackingEvents),
}));

export const returnRequestItemsRelations = relations(returnRequestItems, ({ one }) => ({
  returnRequest: one(returnRequests, {
    fields: [returnRequestItems.returnRequestId],
    references: [returnRequests.id],
  }),
  orderItem: one(orderItems, {
    fields: [returnRequestItems.orderItemId],
    references: [orderItems.id],
  }),
  product: one(products, {
    fields: [returnRequestItems.productId],
    references: [products.id],
  }),
  variant: one(variants, {
    fields: [returnRequestItems.variantId],
    references: [variants.id],
  }),
  exchangeVariant: one(variants, {
    fields: [returnRequestItems.exchangeVariantId],
    references: [variants.id],
    relationName: 'exchangeVariant',
  }),
}));

export const returnTrackingEventsRelations = relations(returnTrackingEvents, ({ one }) => ({
  returnRequest: one(returnRequests, {
    fields: [returnTrackingEvents.returnRequestId],
    references: [returnRequests.id],
  }),
}));

export type ReturnRequest = typeof returnRequests.$inferSelect;
export type ReturnRequestItem = typeof returnRequestItems.$inferSelect;
export type ReturnTrackingEvent = typeof returnTrackingEvents.$inferSelect;
