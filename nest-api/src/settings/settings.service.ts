import { Injectable, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { settings } from '../database/schema';

@Injectable()
export class SettingsService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async index(): Promise<any> {
    const list = await this.db.query.settings.findMany();
    return list.map((s) => this.formatSetting(s));
  }

  async getByKey(key: string): Promise<any> {
    const s = await this.db.query.settings.findFirst({ where: eq(settings.key, key) });
    if (!s) {
      return { value: null };
    }
    return this.formatSetting(s);
  }

  async store(body: any): Promise<any> {
    if (!body?.key) {
      throw new HttpException(
        { res: 'error', message: 'The key field is required.' },
        HttpStatus.UNPROCESSABLE_ENTITY, // 422
      );
    }

    const keyStr = String(body.key);
    const valStr = body.value !== undefined && body.value !== null ? String(body.value) : '';

    const existing = await this.db.query.settings.findFirst({ where: eq(settings.key, keyStr) });
    if (existing) {
      await this.db.update(settings).set({ value: valStr }).where(eq(settings.id, existing.id));
    } else {
      await this.db.insert(settings).values({ key: keyStr, value: valStr });
    }

    const updated = await this.db.query.settings.findFirst({ where: eq(settings.key, keyStr) });

    return {
      result: 'success',
      message: 'Setting saved successfully',
      setting: this.formatSetting(updated),
    };
  }

  async update(settingParam: string, body: any): Promise<any> {
    let lastSetting: any = null;

    if (body && typeof body === 'object') {
      for (const [key, value] of Object.entries(body)) {
        if (key.startsWith('_')) continue;
        const valStr = value !== undefined && value !== null ? String(value) : '';
        const existing = await this.db.query.settings.findFirst({ where: eq(settings.key, key) });
        if (existing) {
          await this.db.update(settings).set({ value: valStr }).where(eq(settings.id, existing.id));
        } else {
          await this.db.insert(settings).values({ key, value: valStr });
        }
        lastSetting = await this.db.query.settings.findFirst({ where: eq(settings.key, key) });
      }
    }

    return {
      result: 'success',
      message: 'Setting updated successfully',
      setting: this.formatSetting(lastSetting),
    };
  }

  private formatSetting(s: any) {
    if (!s) return null;
    return {
      id: Number(s.id),
      key: s.key,
      value: s.value,
      created_at: s.createdAt ?? s.created_at,
      updated_at: s.updatedAt ?? s.updated_at,
    };
  }
}
