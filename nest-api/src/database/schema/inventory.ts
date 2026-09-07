import { relations } from 'drizzle-orm';
import {
  mysqlTable,
  bigint,
  varchar,
  text,
  int,
  mysqlEnum,
  timestamp,
} from 'drizzle-orm/mysql-core';
import { products, variants } from './products';
import { orders } from './orders';
import { returnRequests } from './returns';
import { rtoCases } from './rto';
import { users } from './users';

export const inventoryTransactions = mysqlTable('inventory_transactions', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  productId: bigint('product_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  variantId: bigint('variant_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => variants.id, { onDelete: 'cascade' }),
  orderId: bigint('order_id', { mode: 'number', unsigned: true })
    .references(() => orders.id, { onDelete: 'set null' }),
  returnRequestId: bigint('return_request_id', { mode: 'number', unsigned: true })
    .references(() => returnRequests.id, { onDelete: 'set null' }),
  rtoCaseId: bigint('rto_case_id', { mode: 'number', unsigned: true })
    .references(() => rtoCases.id, { onDelete: 'set null' }),
  transactionType: mysqlEnum('transaction_type', [
    'sale',
    'cancelled_order',
    'rto_restock',
    'return_restock',
    'return_damaged',
    'rto_damaged',
    'manual_adjustment',
  ]).notNull(),
  quantity: int('quantity').notNull(),
  previousQuantity: int('previous_quantity').notNull(),
  newQuantity: int('new_quantity').notNull(),
  reason: varchar('reason', { length: 255 }).notNull(),
  notes: text('notes'),
  createdBy: bigint('created_by', { mode: 'number', unsigned: true })
    .references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const inventoryTransactionsRelations = relations(inventoryTransactions, ({ one }) => ({
  product: one(products, {
    fields: [inventoryTransactions.productId],
    references: [products.id],
  }),
  variant: one(variants, {
    fields: [inventoryTransactions.variantId],
    references: [variants.id],
  }),
  order: one(orders, {
    fields: [inventoryTransactions.orderId],
    references: [orders.id],
  }),
  returnRequest: one(returnRequests, {
    fields: [inventoryTransactions.returnRequestId],
    references: [returnRequests.id],
  }),
  rtoCase: one(rtoCases, {
    fields: [inventoryTransactions.rtoCaseId],
    references: [rtoCases.id],
  }),
  user: one(users, {
    fields: [inventoryTransactions.createdBy],
    references: [users.id],
  }),
}));

export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
