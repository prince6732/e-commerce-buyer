import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { sliders, newArrivalSliders } from '../database/schema';

@Injectable()
export class SlidersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  // ─── Sliders ──────────────────────────────────────────────────────────────
  async index(query?: any): Promise<any> {
    const list = await this.db.query.sliders.findMany({ orderBy: [asc(sliders.order)] });
    let formatted = list.map((s) => this.formatSlider(s));

    if (query?.status !== undefined && query?.status !== null && query?.status !== '') {
      const statusBool = query.status === 'true' || query.status === true || query.status === 1 || query.status === '1' || query.status === 'active';
      formatted = formatted.filter((s: any) => s.status === statusBool);
    }

    if (query?.search) {
      const search = query.search.trim().toLowerCase();
      formatted = formatted.filter((s: any) =>
        (s.title && s.title.toLowerCase().includes(search)) ||
        (s.description && s.description.toLowerCase().includes(search)) ||
        (s.link && s.link.toLowerCase().includes(search))
      );
    }

    if (query?.page || query?.limit || query?.per_page || query?.paginate) {
      const page = parseInt(query?.page ?? '1', 10) || 1;
      const limit = parseInt(query?.limit ?? query?.per_page ?? '10', 10) || 10;
      const total = formatted.length;
      const start = (page - 1) * limit;
      const paginated = formatted.slice(start, start + limit);
      const lastPage = Math.max(1, Math.ceil(total / limit));
      const hasNextPage = page < lastPage;

      return {
        res: 'success',
        data: {
          sliders: paginated,
          pagination: {
            current_page: page,
            per_page: limit,
            limit,
            total,
            last_page: lastPage,
            hasNextPage,
            has_next_page: hasNextPage,
            has_more: hasNextPage,
          },
        },
        sliders: paginated,
      };
    }

    return formatted;
  }

  async show(id: number): Promise<any> {
    const item = await this.db.query.sliders.findFirst({ where: eq(sliders.id, id) });
    if (!item) {
      throw new HttpException(
        { res: 'error', message: 'Slider not found.' },
        HttpStatus.NOT_FOUND,
      );
    }
    return this.formatSlider(item);
  }

  async store(body: any): Promise<any> {
    if (!body?.image) {
      throw new HttpException(
        { res: 'error', message: 'The image field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (body?.status === undefined || body?.status === null) {
      throw new HttpException(
        { res: 'error', message: 'The status field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const [r] = await this.db
      .insert(sliders)
      .values({
        title: body.title ?? '',
        image: body.image,
        link: body.link ?? null,
        openInNewTab: body.open_in_new_tab !== undefined ? Boolean(body.open_in_new_tab) : false,
        description: body.description ?? null,
        status: Boolean(body.status),
        order: body.order ? Number(body.order) : 1,
        showButtons: body.show_buttons !== undefined ? Boolean(body.show_buttons) : true,
        button1Text: body.button1_text ?? null,
        button1Link: body.button1_link ?? null,
        button2Text: body.button2_text ?? null,
        button2Link: body.button2_link ?? null,
      })
      .$returningId();

    const created = await this.db.query.sliders.findFirst({ where: eq(sliders.id, r.id) });

    return {
      res: 'success',
      message: 'Slider created successfully',
      slider: this.formatSlider(created),
    };
  }

  async update(id: number, body: any): Promise<any> {
    const existing = await this.db.query.sliders.findFirst({ where: eq(sliders.id, id) });
    if (!existing) {
      throw new HttpException(
        { res: 'error', message: 'Slider not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (body?.status === undefined || body?.status === null) {
      throw new HttpException(
        { res: 'error', message: 'The status field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    await this.db
      .update(sliders)
      .set({
        title: body.title ?? '',
        image: body.image ?? existing.image,
        link: body.link ?? existing.link,
        openInNewTab: body.open_in_new_tab !== undefined ? Boolean(body.open_in_new_tab) : existing.openInNewTab,
        description: body.description ?? existing.description,
        status: Boolean(body.status),
        order: body.order ? Number(body.order) : existing.order,
        showButtons: body.show_buttons !== undefined ? Boolean(body.show_buttons) : existing.showButtons,
        button1Text: body.button1_text ?? existing.button1Text,
        button1Link: body.button1_link ?? existing.button1Link,
        button2Text: body.button2_text ?? existing.button2Text,
        button2Link: body.button2_link ?? existing.button2Link,
      })
      .where(eq(sliders.id, id));

    const updated = await this.db.query.sliders.findFirst({ where: eq(sliders.id, id) });
    return { res: 'success', message: 'Slider updated successfully', slider: this.formatSlider(updated) };
  }

  async destroy(id: number): Promise<any> {
    const existing = await this.db.query.sliders.findFirst({ where: eq(sliders.id, id) });
    if (!existing) {
      throw new HttpException(
        { res: 'error', message: 'Slider not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.db.delete(sliders).where(eq(sliders.id, id));
    return { res: 'success', message: 'Slider deleted successfully' };
  }

  async changeStatus(id: number): Promise<any> {
    const item = await this.db.query.sliders.findFirst({ where: eq(sliders.id, id) });
    if (!item) {
      throw new HttpException(
        { res: 'error', message: 'Slider not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const newStatus = !item.status;
    await this.db.update(sliders).set({ status: newStatus }).where(eq(sliders.id, id));
    return { result: 'success', message: 'Status updated successfully', status: newStatus };
  }

  async updateOrder(body: any): Promise<any> {
    let ids: any[] = [];
    if (Array.isArray(body)) {
      ids = body;
    } else if (body && Array.isArray(body.order)) {
      ids = body.order;
    } else if (body && Array.isArray(body.items)) {
      ids = body.items;
    }

    if (ids.length) {
      for (let index = 0; index < ids.length; index++) {
        const sliderId = typeof ids[index] === 'object' ? ids[index].id : ids[index];
        if (sliderId) {
          await this.db.update(sliders).set({ order: index + 1 }).where(eq(sliders.id, Number(sliderId)));
        }
      }
    }

    return { res: 'success', message: 'Slider order updated successfully' };
  }

  // ─── New Arrival Sliders ──────────────────────────────────────────────────
  async naIndex(query?: any): Promise<any> {
    const list = await this.db.query.newArrivalSliders.findMany({ orderBy: [asc(newArrivalSliders.order)] });
    let formatted = list.map((s) => this.formatNewArrivalSlider(s));

    if (query?.status !== undefined && query?.status !== null && query?.status !== '') {
      const statusBool = query.status === 'true' || query.status === true || query.status === 1 || query.status === '1' || query.status === 'active';
      formatted = formatted.filter((s: any) => s.status === statusBool);
    }

    if (query?.search) {
      const search = query.search.trim().toLowerCase();
      formatted = formatted.filter((s: any) =>
        (s.title && s.title.toLowerCase().includes(search)) ||
        (s.description && s.description.toLowerCase().includes(search)) ||
        (s.link && s.link.toLowerCase().includes(search))
      );
    }

    if (query?.page || query?.limit || query?.per_page || query?.paginate) {
      const page = parseInt(query?.page ?? '1', 10) || 1;
      const limit = parseInt(query?.limit ?? query?.per_page ?? '10', 10) || 10;
      const total = formatted.length;
      const start = (page - 1) * limit;
      const paginated = formatted.slice(start, start + limit);
      const lastPage = Math.max(1, Math.ceil(total / limit));
      const hasNextPage = page < lastPage;

      return {
        res: 'success',
        data: {
          sliders: paginated,
          pagination: {
            current_page: page,
            per_page: limit,
            limit,
            total,
            last_page: lastPage,
            hasNextPage,
            has_next_page: hasNextPage,
            has_more: hasNextPage,
          },
        },
        sliders: paginated,
      };
    }

    return formatted;
  }

  async naShow(id: number): Promise<any> {
    const item = await this.db.query.newArrivalSliders.findFirst({ where: eq(newArrivalSliders.id, id) });
    if (!item) {
      throw new HttpException(
        { res: 'error', message: 'New Arrival Slider not found.' },
        HttpStatus.NOT_FOUND,
      );
    }
    return this.formatNewArrivalSlider(item);
  }

  async naStore(body: any) {
    if (!body?.image) {
      throw new HttpException(
        { res: 'error', message: 'The image field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    if (body?.status === undefined || body?.status === null) {
      throw new HttpException(
        { res: 'error', message: 'The status field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const [r] = await this.db
      .insert(newArrivalSliders)
      .values({
        title: body.title ?? null,
        image: body.image,
        link: body.link ?? null,
        openInNewTab: body.open_in_new_tab !== undefined ? Boolean(body.open_in_new_tab) : false,
        description: body.description ?? null,
        status: Boolean(body.status),
        order: body.order ? Number(body.order) : 1,
      })
      .$returningId();

    const created = await this.db.query.newArrivalSliders.findFirst({ where: eq(newArrivalSliders.id, r.id) });

    return {
      res: 'success',
      message: 'New Arrival Slider created successfully',
      slider: this.formatNewArrivalSlider(created),
    };
  }

  async naUpdate(id: number, body: any) {
    const existing = await this.db.query.newArrivalSliders.findFirst({ where: eq(newArrivalSliders.id, id) });
    if (!existing) {
      throw new HttpException(
        { res: 'error', message: 'New Arrival Slider not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    if (body?.status === undefined || body?.status === null) {
      throw new HttpException(
        { res: 'error', message: 'The status field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    await this.db
      .update(newArrivalSliders)
      .set({
        title: body.title !== undefined ? body.title : existing.title,
        image: body.image ?? existing.image,
        link: body.link !== undefined ? body.link : existing.link,
        openInNewTab: body.open_in_new_tab !== undefined ? Boolean(body.open_in_new_tab) : existing.openInNewTab,
        description: body.description !== undefined ? body.description : existing.description,
        status: Boolean(body.status),
        order: body.order !== undefined ? Number(body.order) : existing.order,
      })
      .where(eq(newArrivalSliders.id, id));

    const updated = await this.db.query.newArrivalSliders.findFirst({ where: eq(newArrivalSliders.id, id) });

    return {
      res: 'success',
      message: 'New Arrival Slider updated successfully',
      slider: this.formatNewArrivalSlider(updated),
    };
  }

  async naDestroy(id: number) {
    const existing = await this.db.query.newArrivalSliders.findFirst({ where: eq(newArrivalSliders.id, id) });
    if (!existing) {
      throw new HttpException(
        { res: 'error', message: 'New Arrival Slider not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    await this.db.delete(newArrivalSliders).where(eq(newArrivalSliders.id, id));
    return { res: 'success', message: 'New Arrival Slider deleted successfully' };
  }

  async naChangeStatus(id: number) {
    const item = await this.db.query.newArrivalSliders.findFirst({ where: eq(newArrivalSliders.id, id) });
    if (!item) {
      throw new HttpException(
        { res: 'error', message: 'New Arrival Slider not found.' },
        HttpStatus.NOT_FOUND,
      );
    }

    const newStatus = !item.status;
    await this.db.update(newArrivalSliders).set({ status: newStatus }).where(eq(newArrivalSliders.id, id));
    return { result: 'success', message: 'Status updated successfully', status: newStatus };
  }

  async naUpdateOrder(body: any) {
    let ids: any[] = [];
    if (Array.isArray(body)) {
      ids = body;
    } else if (body && Array.isArray(body.order)) {
      ids = body.order;
    } else if (body && Array.isArray(body.items)) {
      ids = body.items;
    }

    if (ids.length) {
      for (let index = 0; index < ids.length; index++) {
        const sliderId = typeof ids[index] === 'object' ? ids[index].id : ids[index];
        if (sliderId) {
          await this.db.update(newArrivalSliders).set({ order: index + 1 }).where(eq(newArrivalSliders.id, Number(sliderId)));
        }
      }
    }

    return { res: 'success', message: 'Order updated successfully' };
  }

  // ─── HELPERS ─────────────────────────────────────────────────────────────
  private formatSlider(s: any) {
    if (!s) return null;
    return {
      id: Number(s.id),
      title: s.title ?? '',
      image: s.image,
      description: s.description ?? null,
      link: s.link ?? null,
      open_in_new_tab: Boolean(s.openInNewTab ?? s.open_in_new_tab ?? false),
      status: Boolean(s.status),
      order: Number(s.order ?? 1),
      show_buttons: Boolean(s.showButtons ?? s.show_buttons ?? true),
      button1_text: s.button1Text ?? s.button1_text ?? null,
      button1_link: s.button1Link ?? s.button1_link ?? null,
      button2_text: s.button2Text ?? s.button2_text ?? null,
      button2_link: s.button2Link ?? s.button2_link ?? null,
      created_at: s.createdAt ?? s.created_at,
      updated_at: s.updatedAt ?? s.updated_at,
    };
  }

  private formatNewArrivalSlider(s: any) {
    if (!s) return null;
    return {
      id: Number(s.id),
      title: s.title ?? null,
      image: s.image,
      description: s.description ?? null,
      link: s.link ?? null,
      open_in_new_tab: Boolean(s.openInNewTab ?? s.open_in_new_tab ?? false),
      status: Boolean(s.status),
      order: Number(s.order ?? 1),
      created_at: s.createdAt ?? s.created_at,
      updated_at: s.updatedAt ?? s.updated_at,
    };
  }
}
