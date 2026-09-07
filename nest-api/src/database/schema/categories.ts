import { relations } from 'drizzle-orm';
import {
  mysqlTable,
  bigint,
  varchar,
  text,
  boolean,
  decimal,
  timestamp,
  AnyMySqlColumn,
  primaryKey,
} from 'drizzle-orm/mysql-core';
import { attributes } from './attributes';
import { products } from './products';

export const categories = mysqlTable('categories', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  image: varchar('image', { length: 255 }),
  secondaryImage: varchar('secondary_image', { length: 255 }),
  link: text('link'),
  parentId: bigint('parent_id', { mode: 'number', unsigned: true }).references(
    (): AnyMySqlColumn => categories.id,
    { onDelete: 'cascade' },
  ),
  status: boolean('status').default(true).notNull(),
  hsn: varchar('hsn', { length: 15 }),
  cgst: decimal('cgst', { precision: 5, scale: 2 }),
  sgst: decimal('sgst', { precision: 5, scale: 2 }),
  igst: decimal('igst', { precision: 5, scale: 2 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

// Pivot: category <-> attributes (subcategory attribute configuration)
export const categoryAttributes = mysqlTable(
  'category_attributes',
  {
    categoryId: bigint('category_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    attributeId: bigint('attribute_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => attributes.id, { onDelete: 'cascade' }),
    hasImages: boolean('has_images').default(false).notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.categoryId, t.attributeId] }),
  }),
);

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'categoryParent',
  }),
  subcategories: many(categories, {
    relationName: 'categoryParent',
  }),
  products: many(products),
  categoryAttributes: many(categoryAttributes),
}));

export const categoryAttributesRelations = relations(categoryAttributes, ({ one }) => ({
  category: one(categories, {
    fields: [categoryAttributes.categoryId],
    references: [categories.id],
  }),
  attribute: one(attributes, {
    fields: [categoryAttributes.attributeId],
    references: [attributes.id],
  }),
}));

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type CategoryAttribute = typeof categoryAttributes.$inferSelect;

