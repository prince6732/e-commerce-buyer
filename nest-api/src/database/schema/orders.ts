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
import { products, variants } from './products';

export const carts = mysqlTable('carts', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  userId: bigint('user_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  productId: bigint('product_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  variantId: bigint('variant_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => variants.id, { onDelete: 'cascade' }),
  quantity: int('quantity').default(1).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).default('0.00'),
  selectedAttributes: json('selected_attributes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const orders = mysqlTable('orders', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  orderNumber: varchar('order_number', { length: 255 }).notNull().unique(),
  invoiceNumber: varchar('invoice_number', { length: 255 }).unique(),
  userId: bigint('user_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  status: mysqlEnum('status', [
    'pending',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'completed',
    'cancelled',
  ]).default('pending').notNull(),
  deliveryConfirmationToken: varchar('delivery_confirmation_token', { length: 255 }),
  deliveryConfirmedAt: timestamp('delivery_confirmed_at'),
  deliveryConfirmationSentAt: timestamp('delivery_confirmation_sent_at'),
  paymentMethod: mysqlEnum('payment_method', ['cash_on_delivery', 'online'])
    .default('cash_on_delivery')
    .notNull(),
  paymentStatus: mysqlEnum('payment_status', ['pending', 'paid', 'failed'])
    .default('pending')
    .notNull(),
  transactionId: varchar('transaction_id', { length: 255 }),
  delhiveryWaybill: varchar('delhivery_waybill', { length: 255 }),
  delhiveryStatus: varchar('delhivery_status', { length: 255 }),
  delhiveryStatusUpdatedAt: timestamp('delhivery_status_updated_at'),
  delhiveryTrackingData: json('delhivery_tracking_data'),
  courierName: varchar('courier_name', { length: 255 }).default('Delhivery'),
  deliveryInstructions: text('delivery_instructions'),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  shippingFee: decimal('shipping_fee', { precision: 10, scale: 2 }).default('0.00').notNull(),
  tax: decimal('tax', { precision: 10, scale: 2 }).default('0.00').notNull(),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  shippingAddress: text('shipping_address').notNull(),
  billingAddress: text('billing_address'),
  notes: text('notes'),
  shippedAt: timestamp('shipped_at'),
  deliveredAt: timestamp('delivered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const orderItems = mysqlTable('order_items', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  orderId: bigint('order_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  productId: bigint('product_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  variantId: bigint('variant_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => variants.id, { onDelete: 'cascade' }),
  quantity: int('quantity').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  selectedAttributes: json('selected_attributes'),
  hsn: varchar('hsn', { length: 15 }),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }),
  taxableAmount: decimal('taxable_amount', { precision: 10, scale: 2 }),
  taxAmount: decimal('tax_amount', { precision: 10, scale: 2 }),
  cgstRate: decimal('cgst_rate', { precision: 5, scale: 2 }),
  cgstAmount: decimal('cgst_amount', { precision: 10, scale: 2 }),
  sgstRate: decimal('sgst_rate', { precision: 5, scale: 2 }),
  sgstAmount: decimal('sgst_amount', { precision: 10, scale: 2 }),
  igstRate: decimal('igst_rate', { precision: 5, scale: 2 }),
  igstAmount: decimal('igst_amount', { precision: 10, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const orderTrackingRecords = mysqlTable('order_tracking_records', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  orderId: bigint('order_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => orders.id, { onDelete: 'cascade' }),
  status: varchar('status', { length: 100 }).notNull(),
  description: text('description'),
  location: varchar('location', { length: 255 }),
  trackedAt: timestamp('tracked_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const cartsRelations = relations(carts, ({ one }) => ({
  user: one(users, {
    fields: [carts.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [carts.productId],
    references: [products.id],
  }),
  variant: one(variants, {
    fields: [carts.variantId],
    references: [variants.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  orderItems: many(orderItems),
  trackingRecords: many(orderTrackingRecords),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
  variant: one(variants, {
    fields: [orderItems.variantId],
    references: [variants.id],
  }),
}));

export const orderTrackingRecordsRelations = relations(orderTrackingRecords, ({ one }) => ({
  order: one(orders, {
    fields: [orderTrackingRecords.orderId],
    references: [orders.id],
  }),
}));

export type CartItem = typeof carts.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderTrackingRecord = typeof orderTrackingRecords.$inferSelect;

