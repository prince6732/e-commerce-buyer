import { relations } from 'drizzle-orm';
import {
  mysqlTable,
  bigint,
  varchar,
  text,
  boolean,
  int,
  json,
  timestamp,
} from 'drizzle-orm/mysql-core';
import { users } from './users';
import { products } from './products';

export const reviews = mysqlTable('reviews', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  userId: bigint('user_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  productId: bigint('product_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  rating: int('rating').default(5).notNull(),
  reviewText: text('review_text'),
  title: varchar('title', { length: 255 }),
  images: json('images'),
  isVerified: boolean('is_verified').default(false).notNull(),
  isApproved: boolean('is_approved').default(true).notNull(),
  helpfulVotes: json('helpful_votes'),
  helpfulCount: int('helpful_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const sliders = mysqlTable('sliders', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  title: varchar('title', { length: 255 }),
  image: varchar('image', { length: 255 }).notNull(),
  link: text('link'),
  openInNewTab: boolean('open_in_new_tab').default(false).notNull(),
  description: text('description'),
  status: boolean('status').default(true).notNull(),
  order: int('order').default(1).notNull(),
  showButtons: boolean('show_buttons').default(true).notNull(),
  button1Text: varchar('button1_text', { length: 100 }),
  button1Link: text('button1_link'),
  button2Text: varchar('button2_text', { length: 100 }),
  button2Link: text('button2_link'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const newArrivalSliders = mysqlTable('new_arrival_sliders', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  title: varchar('title', { length: 255 }),
  image: varchar('image', { length: 255 }).notNull(),
  link: text('link'),
  openInNewTab: boolean('open_in_new_tab').default(false).notNull(),
  description: text('description'),
  status: boolean('status').default(true).notNull(),
  order: int('order').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const settings = mysqlTable('settings', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  value: text('value'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const contactMessages = mysqlTable('contact_messages', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }),
  subject: varchar('subject', { length: 255 }),
  message: text('message').notNull(),
  isRead: boolean('is_read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const likes = mysqlTable('likes', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  userId: bigint('user_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  productId: bigint('product_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const images = mysqlTable('images', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  path: varchar('path', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const reviewsRelations = relations(reviews, ({ one }) => ({
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [reviews.productId],
    references: [products.id],
  }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  user: one(users, {
    fields: [likes.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [likes.productId],
    references: [products.id],
  }),
}));

export type Review = typeof reviews.$inferSelect;
export type Slider = typeof sliders.$inferSelect;
export type NewArrivalSlider = typeof newArrivalSliders.$inferSelect;
export type Setting = typeof settings.$inferSelect;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type Like = typeof likes.$inferSelect;
export type Image = typeof images.$inferSelect;

