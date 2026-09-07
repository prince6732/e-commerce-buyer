import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, desc, like, or, and, sql } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { topbarAnnouncements } from '../database/schema/topbar-announcements';
import { CreateTopbarAnnouncementDto, UpdateTopbarAnnouncementDto, UpdateStatusDto } from './dto/topbar-announcement.dto';

@Injectable()
export class TopbarAnnouncementsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  /**
   * Public endpoint for marketing application:
   * Returns ONLY active announcements
   */
  async getActiveAnnouncements() {
    const records = await this.db
      .select()
      .from(topbarAnnouncements)
      .where(eq(topbarAnnouncements.status, 'active'))
      .orderBy(desc(topbarAnnouncements.id));

    return {
      res: 'success',
      data: records,
    };
  }

  /**
   * Admin endpoint:
   * Returns all announcements with optional search/status filter
   */
  async getAdminAnnouncements(query?: { search?: string; status?: string; page?: number; per_page?: number; limit?: number }) {
    const conditions: any[] = [];

    if (query?.search && query.search.trim()) {
      const searchTerm = `%${query.search.trim()}%`;
      conditions.push(
        or(
          like(topbarAnnouncements.title, searchTerm),
          like(topbarAnnouncements.link_url, searchTerm),
          like(topbarAnnouncements.icon, searchTerm),
        ),
      );
    }

    if (query?.status && (query.status === 'active' || query.status === 'inactive')) {
      conditions.push(eq(topbarAnnouncements.status, query.status as 'active' | 'inactive'));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const records = await this.db
      .select()
      .from(topbarAnnouncements)
      .where(whereClause)
      .orderBy(desc(topbarAnnouncements.id));

    const total = records.length;
    const page = query?.page ? Math.max(1, Number(query.page)) : 1;
    const perPage = query?.per_page || query?.limit ? Math.max(1, Number(query.per_page || query.limit)) : 10;
    const paginated = records.slice((page - 1) * perPage, page * perPage);
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const hasNextPage = page < lastPage;

    return {
      res: 'success',
      data: paginated,
      announcements: paginated,
      total,
      current_page: page,
      per_page: perPage,
      limit: perPage,
      last_page: lastPage,
      hasNextPage,
      has_next_page: hasNextPage,
      has_more: hasNextPage,
    };
  }

  async getById(id: number) {
    const [record] = await this.db
      .select()
      .from(topbarAnnouncements)
      .where(eq(topbarAnnouncements.id, id))
      .limit(1);

    if (!record) {
      throw new NotFoundException(`Topbar announcement with ID ${id} not found`);
    }

    return {
      res: 'success',
      data: record,
    };
  }

  async create(dto: CreateTopbarAnnouncementDto) {
    const trimmedTitle = dto.title?.trim();
    if (!trimmedTitle || trimmedTitle.length < 3) {
      throw new BadRequestException('Title must be at least 3 characters');
    }

    const insertData = {
      title: trimmedTitle,
      icon: dto.icon?.trim() || null,
      link_url: dto.link_url?.trim() || null,
      status: dto.status || 'active',
    };

    const [result] = await this.db.insert(topbarAnnouncements).values(insertData);
    const newId = (result as any).insertId;

    const created = await this.getById(newId);

    return {
      res: 'success',
      data: created.data,
      message: 'Announcement created successfully',
    };
  }

  async update(id: number, dto: UpdateTopbarAnnouncementDto) {
    await this.getById(id);

    const updateData: Partial<typeof topbarAnnouncements.$inferInsert> = {};

    if (dto.title !== undefined) {
      const trimmedTitle = dto.title.trim();
      if (!trimmedTitle || trimmedTitle.length < 3) {
        throw new BadRequestException('Title must be at least 3 characters');
      }
      updateData.title = trimmedTitle;
    }

    if (dto.icon !== undefined) {
      updateData.icon = dto.icon?.trim() || null;
    }

    if (dto.link_url !== undefined) {
      updateData.link_url = dto.link_url?.trim() || null;
    }

    if (dto.status !== undefined) {
      if (dto.status !== 'active' && dto.status !== 'inactive') {
        throw new BadRequestException('Status must be active or inactive');
      }
      updateData.status = dto.status;
    }

    await this.db
      .update(topbarAnnouncements)
      .set(updateData)
      .where(eq(topbarAnnouncements.id, id));

    const updated = await this.getById(id);

    return {
      res: 'success',
      data: updated.data,
      message: 'Announcement updated successfully',
    };
  }

  async delete(id: number) {
    await this.getById(id);

    await this.db
      .delete(topbarAnnouncements)
      .where(eq(topbarAnnouncements.id, id));

    return {
      res: 'success',
      message: 'Announcement deleted successfully',
    };
  }

  async toggleStatus(id: number, dto?: UpdateStatusDto) {
    const existing = await this.getById(id);

    let nextStatus: 'active' | 'inactive';
    if (dto?.status) {
      nextStatus = dto.status;
    } else {
      nextStatus = existing.data.status === 'active' ? 'inactive' : 'active';
    }

    await this.db
      .update(topbarAnnouncements)
      .set({ status: nextStatus })
      .where(eq(topbarAnnouncements.id, id));

    const updated = await this.getById(id);

    return {
      res: 'success',
      data: updated.data,
      message: `Announcement status changed to ${nextStatus}`,
    };
  }
}
