import { relations } from 'drizzle-orm';
import {
  mysqlTable,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
} from 'drizzle-orm/mysql-core';
import { reviews, likes } from './misc';
import { orders, carts } from './orders';

export const users = mysqlTable('users', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  googleId: varchar('google_id', { length: 255 }),
  phoneNumber: varchar('phone_number', { length: 20 }),
  address: text('address'),
  profilePicture: varchar('profile_picture', { length: 255 }),
  password: varchar('password', { length: 255 }).notNull(),
  isVerified: varchar('is_verified', { length: 255 }),
  emailVerifiedAt: timestamp('email_verified_at'),
  emailVerificationCode: varchar('email_verification_code', { length: 255 }),
  status: boolean('status').default(true).notNull(),
  role: varchar('role', { length: 50 }).default('User').notNull(),
  otp: varchar('otp', { length: 6 }),
  otpExpiresAt: timestamp('otp_expires_at'),
  rememberToken: varchar('remember_token', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const passwordResetTokens = mysqlTable('password_reset_tokens', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  email: varchar('email', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).notNull(),
  createdAt: timestamp('created_at'),
  expiresAt: timestamp('expires_at'),
});

export const usersRelations = relations(users, ({ many }) => ({
  reviews: many(reviews),
  orders: many(orders),
  likes: many(likes),
  carts: many(carts),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

