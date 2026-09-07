import { relations } from 'drizzle-orm';
import {
  mysqlTable,
  bigint,
  varchar,
  boolean,
  timestamp,
} from 'drizzle-orm/mysql-core';

export const states = mysqlTable('states', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  status: boolean('status').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const cities = mysqlTable('cities', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  name: varchar('name', { length: 255 }).notNull(),
  stateId: bigint('state_id', { mode: 'number', unsigned: true })
    .notNull()
    .references(() => states.id, { onDelete: 'cascade' }),
  status: boolean('status').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().onUpdateNow().notNull(),
});

export const statesRelations = relations(states, ({ many }) => ({
  cities: many(cities),
}));

export const citiesRelations = relations(cities, ({ one }) => ({
  state: one(states, {
    fields: [cities.stateId],
    references: [states.id],
  }),
}));

export type State = typeof states.$inferSelect;
export type NewState = typeof states.$inferInsert;
export type City = typeof cities.$inferSelect;
export type NewCity = typeof cities.$inferInsert;
