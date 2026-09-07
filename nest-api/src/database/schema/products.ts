import { relations } from 'drizzle-orm';
import {
  mysqlTable,
  bigint,
  varchar,
  text,
  boolean,
  decimal,
  int,
  json,
  timestamp,
  primaryKey,
  foreignKey,
} from 'drizzle-orm/mysql-core';
import { categories } from './categories';
import { brands } from './brands';
import { attributes, attributeValues } from './attributes';
import { reviews, likes } from './misc';
import { orderItems, carts } from './orders';

export const products = mysqlTable('products', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  itemCode: varchar('item_code', { length: 255 }),
  categoryId: bigint('category_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => categories.id, { onDelete: 'cascade' }),
  brandId: bigint('brand_id', { mode: 'number', unsigned: true }).references(
    () => brands.id,
    { onDelete: 'cascade' },
  ),
  status: boolean('status').default(true).notNull(),
  featureJson: json('feature_json'),
  detailJson: json('detail_json'),
  imageUrl: varchar('image_url', { length: 255 }),
  imageJson: json('image_json'),
  isNewArrival: boolean('is_new_arrival').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const variants = mysqlTable('variants', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  title: varchar('title', { length: 255 }),
  sku: varchar('sku', { length: 255 }).notNull().unique(),
  mrp: decimal('mrp', { precision: 10, scale: 2 }).notNull(),
  sp: decimal('sp', { precision: 10, scale: 2 }).notNull(),
  bp: decimal('bp', { precision: 10, scale: 2 }).notNull(),
  stock: int('stock').default(0).notNull(),
  imageUrl: varchar('image_url', { length: 255 }),
  imageJson: json('image_json'),
  productId: bigint('product_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  status: boolean('status').default(true).notNull(),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

// Pivot: variant <-> attribute_values (many-to-many)
export const variantAttributeValues = mysqlTable(
  'variant_attribute_values',
  {
    variantId: bigint('variant_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => variants.id, { onDelete: 'cascade' }),
    attributeValueId: bigint('attribute_value_id', { mode: 'number', unsigned: true })
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.variantId, t.attributeValueId] }),
    attrValFk: foreignKey({
      name: 'vav_attr_val_fk',
      columns: [t.attributeValueId],
      foreignColumns: [attributeValues.id],
    }).onDelete('cascade'),
  }),
);

// Pivot: item_attributes (product <-> attributes)
export const itemAttributes = mysqlTable(
  'item_attributes',
  {
    productId: bigint('product_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    attributeId: bigint('attribute_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => attributes.id, { onDelete: 'cascade' }),
    hasImages: boolean('has_images').default(false).notNull(),
    isPrimary: boolean('is_primary').default(false).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.productId, t.attributeId] }),
  }),
);

// Pivot: product_attribute_values (product <-> attribute <-> attribute_value)
export const productAttributeValues = mysqlTable(
  'product_attribute_values',
  {
    productId: bigint('product_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    attributeId: bigint('attribute_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => attributes.id, { onDelete: 'cascade' }),
    attributeValueId: bigint('attribute_value_id', { mode: 'number', unsigned: true })
      .notNull(),
  },
  (t) => ({
    pk: primaryKey({ name: 'prod_attr_val_pk', columns: [t.productId, t.attributeId, t.attributeValueId] }),
    attrValFk: foreignKey({
      name: 'pav_attr_val_fk',
      columns: [t.attributeValueId],
      foreignColumns: [attributeValues.id],
    }).onDelete('cascade'),
  }),
);

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  brand: one(brands, {
    fields: [products.brandId],
    references: [brands.id],
  }),
  variants: many(variants),
  itemAttributes: many(itemAttributes),
  productAttributeValues: many(productAttributeValues),
  reviews: many(reviews),
  likes: many(likes),
}));

export const variantsRelations = relations(variants, ({ one, many }) => ({
  product: one(products, {
    fields: [variants.productId],
    references: [products.id],
  }),
  variantAttributeValues: many(variantAttributeValues),
  orderItems: many(orderItems),
  carts: many(carts),
}));

export const variantAttributeValuesRelations = relations(variantAttributeValues, ({ one }) => ({
  variant: one(variants, {
    fields: [variantAttributeValues.variantId],
    references: [variants.id],
  }),
  attributeValue: one(attributeValues, {
    fields: [variantAttributeValues.attributeValueId],
    references: [attributeValues.id],
  }),
}));

export const itemAttributesRelations = relations(itemAttributes, ({ one }) => ({
  product: one(products, {
    fields: [itemAttributes.productId],
    references: [products.id],
  }),
  attribute: one(attributes, {
    fields: [itemAttributes.attributeId],
    references: [attributes.id],
  }),
}));

export const productAttributeValuesRelations = relations(productAttributeValues, ({ one }) => ({
  product: one(products, {
    fields: [productAttributeValues.productId],
    references: [products.id],
  }),
  attribute: one(attributes, {
    fields: [productAttributeValues.attributeId],
    references: [attributes.id],
  }),
  attributeValue: one(attributeValues, {
    fields: [productAttributeValues.attributeValueId],
    references: [attributeValues.id],
  }),
}));

export type Product = typeof products.$inferSelect;
export type Variant = typeof variants.$inferSelect;
export type VariantAttributeValue = typeof variantAttributeValues.$inferSelect;
export type ItemAttribute = typeof itemAttributes.$inferSelect;
export type ProductAttributeValue = typeof productAttributeValues.$inferSelect;

