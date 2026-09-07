import { mysqlTable, bigint, varchar, mysqlEnum } from 'drizzle-orm/mysql-core';

export const topbarAnnouncements = mysqlTable('topbar_announcements', {
  id: bigint('id', { mode: 'number', unsigned: true }).primaryKey().autoincrement(),
  title: varchar('title', { length: 255 }).notNull(),
  icon: varchar('icon', { length: 100 }),
  link_url: varchar('link_url', { length: 500 }),
  status: mysqlEnum('status', ['inactive', 'active']).default('active').notNull(),
});

export type TopbarAnnouncement = typeof topbarAnnouncements.$inferSelect;
export type NewTopbarAnnouncement = typeof topbarAnnouncements.$inferInsert;
