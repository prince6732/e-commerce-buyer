import { relations } from 'drizzle-orm';
import {
  mysqlTable,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/mysql-core';
import { categoryAttributes } from './categories';
import { variantAttributeValues, itemAttributes, productAttributeValues } from './products';

export const attributes = mysqlTable('attributes', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: boolean('status').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const attributeValues = mysqlTable('attribute_values', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  value: varchar('value', { length: 255 }).notNull(),
  description: varchar('description', { length: 255 }),
  attributeId: bigint('attribute_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => attributes.id, { onDelete: 'cascade' }),
  status: boolean('status').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const attributesRelations = relations(attributes, ({ many }) => ({
  attributeValues: many(attributeValues),
  categoryAttributes: many(categoryAttributes),
  itemAttributes: many(itemAttributes),
  productAttributeValues: many(productAttributeValues),
}));

export const attributeValuesRelations = relations(attributeValues, ({ one, many }) => ({
  attribute: one(attributes, {
    fields: [attributeValues.attributeId],
    references: [attributes.id],
  }),
  variantAttributeValues: many(variantAttributeValues),
  productAttributeValues: many(productAttributeValues),
}));

export type Attribute = typeof attributes.$inferSelect;
export type AttributeValue = typeof attributeValues.$inferSelect;

