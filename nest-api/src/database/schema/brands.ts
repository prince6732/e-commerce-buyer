import { relations } from 'drizzle-orm';
import {
  mysqlTable,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/mysql-core';
import { products } from './products';

export const brands = mysqlTable('brands', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  image1: varchar('image1', { length: 255 }),
  description1: text('description1'),
  image2: varchar('image2', { length: 255 }),
  description2: text('description2'),
  image3: varchar('image3', { length: 255 }),
  description3: text('description3'),
  status: boolean('status').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));

export type Brand = typeof brands.$inferSelect;
export type NewBrand = typeof brands.$inferInsert;

