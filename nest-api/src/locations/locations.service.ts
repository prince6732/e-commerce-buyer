import { Injectable, Inject, HttpException, HttpStatus, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, like, and, asc, desc, sql, count } from 'drizzle-orm';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { states, cities } from '../database/schema/locations';

@Injectable()
export class LocationsService {
  private logger = new Logger(LocationsService.name);

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  // ==========================================
  // PUBLIC LOCATION ENDPOINTS (Active only)
  // ==========================================

  async getStates() {
    try {
      const list = await this.db.query.states.findMany({
        where: eq(states.status, true),
        orderBy: [asc(states.name)],
      });
      return { success: true, data: list };
    } catch (error: any) {
      this.logger.error('Failed to get public states:', error);
      throw new HttpException(
        { success: false, message: 'Failed to fetch states', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCities(query: { state_id?: number; search?: string; limit?: number }) {
    try {
      const conditions: any[] = [eq(cities.status, true)];

      if (query.state_id) {
        // Also check if state is active
        const state = await this.db.query.states.findFirst({
          where: and(eq(states.id, Number(query.state_id)), eq(states.status, true)),
        });
        if (!state) {
          return { success: true, data: [] };
        }
        conditions.push(eq(cities.stateId, Number(query.state_id)));
      }

      if (query.search && query.search.trim()) {
        conditions.push(like(cities.name, `%${query.search.trim()}%`));
      }

      const list = await this.db.query.cities.findMany({
        where: and(...conditions),
        orderBy: [asc(cities.name)],
        limit: query.limit || (query.search ? 50 : 500),
      });

      return { success: true, data: list };
    } catch (error: any) {
      this.logger.error('Failed to get public cities:', error);
      throw new HttpException(
        { success: false, message: 'Failed to fetch cities', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCitiesByState(stateId: number) {
    try {
      // Check if parent state is active
      const state = await this.db.query.states.findFirst({
        where: and(eq(states.id, stateId), eq(states.status, true)),
      });
      if (!state) {
        return { success: true, data: [] };
      }

      const list = await this.db.query.cities.findMany({
        where: and(eq(cities.stateId, stateId), eq(cities.status, true)),
        orderBy: [asc(cities.name)],
      });
      return { success: true, data: list };
    } catch (error: any) {
      this.logger.error(`Failed to get public cities for state ${stateId}:`, error);
      throw new HttpException(
        { success: false, message: 'Failed to fetch cities for specified state', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==========================================
  // ADMIN STATES MANAGEMENT
  // ==========================================

  async getAdminStates(query: { search?: string; status?: string; page?: number; limit?: number }) {
    try {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
      const offset = (page - 1) * limit;

      const conditions: any[] = [];

      if (query.search && query.search.trim()) {
        conditions.push(like(states.name, `%${query.search.trim()}%`));
      }

      if (query.status !== undefined && query.status !== '' && query.status !== 'all') {
        const isTrue = query.status === 'true' || query.status === '1' || query.status === 'active';
        conditions.push(eq(states.status, isTrue));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Fetch states with their cities to get cities_count
      const allMatching = await this.db.query.states.findMany({
        where: whereClause,
        with: {
          cities: true,
        } as any,
        orderBy: [asc(states.name)],
      });

      const totalItems = allMatching.length;
      const paginatedStates = allMatching.slice(offset, offset + limit);

      const items = paginatedStates.map((s: any) => ({
        id: Number(s.id),
        name: s.name,
        status: Boolean(s.status),
        cities_count: Array.isArray(s.cities) ? s.cities.length : 0,
        active_cities_count: Array.isArray(s.cities) ? s.cities.filter((c: any) => Boolean(c.status)).length : 0,
        created_at: s.createdAt,
        updated_at: s.updatedAt,
      }));

      // Calculate overview counts
      const [totalCountRow]: any = await this.db.select({ count: count() }).from(states);
      const [activeCountRow]: any = await this.db.select({ count: count() }).from(states).where(eq(states.status, true));
      const totalAll = Number(totalCountRow?.count || 0);
      const activeAll = Number(activeCountRow?.count || 0);

      return {
        success: true,
        data: items,
        meta: {
          total: totalItems,
          page,
          limit,
          total_pages: Math.ceil(totalItems / limit) || 1,
          has_more: offset + limit < totalItems,
          stats: {
            total: totalAll,
            active: activeAll,
            inactive: totalAll - activeAll,
          },
        },
      };
    } catch (error: any) {
      this.logger.error('Failed to fetch admin states:', error);
      throw new HttpException(
        { success: false, message: 'Failed to fetch admin states', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAllAdminStatesList() {
    try {
      const list = await this.db.query.states.findMany({
        orderBy: [asc(states.name)],
      });
      return {
        success: true,
        data: list.map((s) => ({
          id: Number(s.id),
          name: s.name,
          status: Boolean(s.status),
        })),
      };
    } catch (error: any) {
      this.logger.error('Failed to fetch admin states list:', error);
      throw new HttpException(
        { success: false, message: 'Failed to fetch states list', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getStateById(id: number) {
    try {
      const state: any = await this.db.query.states.findFirst({
        where: eq(states.id, id),
        with: {
          cities: true,
        } as any,
      });

      if (!state) {
        throw new NotFoundException({ success: false, message: `State #${id} not found` });
      }

      return {
        success: true,
        data: {
          id: Number(state.id),
          name: state.name,
          status: Boolean(state.status),
          cities: (state.cities || []).map((c: any) => ({
            id: Number(c.id),
            name: c.name,
            status: Boolean(c.status),
          })),
          created_at: state.createdAt,
          updated_at: state.updatedAt,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, message: `Failed to fetch state #${id}`, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createState(data: { name: string; status?: boolean }) {
    try {
      const name = data?.name?.trim();
      if (!name) {
        throw new BadRequestException({ success: false, message: 'State name is required' });
      }

      // Check duplicate
      const existing = await this.db.query.states.findFirst({
        where: eq(states.name, name),
      });
      if (existing) {
        throw new BadRequestException({ success: false, message: `State with name "${name}" already exists` });
      }

      const status = data.status !== undefined ? Boolean(data.status) : true;

      const insertRes: any = await this.db.insert(states).values({
        name,
        status,
      });

      let stateId = Number(insertRes?.[0]?.insertId || insertRes?.insertId || 0);
      if (!stateId) {
        const found = await this.db.query.states.findFirst({
          where: eq(states.name, name),
          orderBy: [desc(states.id)],
        });
        stateId = Number(found?.id || 0);
      }

      const created = await this.db.query.states.findFirst({
        where: eq(states.id, stateId),
      });

      return {
        success: true,
        message: 'State created successfully',
        data: created,
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to create state:', error);
      throw new HttpException(
        { success: false, message: 'Failed to create state', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateState(id: number, data: { name?: string; status?: boolean }) {
    try {
      const existing = await this.db.query.states.findFirst({
        where: eq(states.id, id),
      });
      if (!existing) {
        throw new NotFoundException({ success: false, message: `State #${id} not found` });
      }

      const updatePayload: any = {};

      if (data.name !== undefined) {
        const name = data.name.trim();
        if (!name) {
          throw new BadRequestException({ success: false, message: 'State name cannot be empty' });
        }
        // If changed, check duplicate
        if (name.toLowerCase() !== existing.name.toLowerCase()) {
          const duplicate = await this.db.query.states.findFirst({
            where: eq(states.name, name),
          });
          if (duplicate && duplicate.id !== id) {
            throw new BadRequestException({ success: false, message: `State "${name}" already exists` });
          }
        }
        updatePayload.name = name;
      }

      if (data.status !== undefined) {
        updatePayload.status = Boolean(data.status);
      }

      if (Object.keys(updatePayload).length > 0) {
        await this.db.update(states).set(updatePayload).where(eq(states.id, id));
      }

      const updated = await this.db.query.states.findFirst({
        where: eq(states.id, id),
      });

      return {
        success: true,
        message: 'State updated successfully',
        data: updated,
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to update state #${id}:`, error);
      throw new HttpException(
        { success: false, message: `Failed to update state #${id}`, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async toggleStateStatus(id: number) {
    try {
      const existing = await this.db.query.states.findFirst({
        where: eq(states.id, id),
      });
      if (!existing) {
        throw new NotFoundException({ success: false, message: `State #${id} not found` });
      }

      const newStatus = !existing.status;
      await this.db.update(states).set({ status: newStatus }).where(eq(states.id, id));

      return {
        success: true,
        message: `State "${existing.name}" is now ${newStatus ? 'active' : 'inactive'}`,
        data: {
          id: Number(existing.id),
          name: existing.name,
          status: newStatus,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to toggle status for state #${id}:`, error);
      throw new HttpException(
        { success: false, message: `Failed to toggle state status`, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteState(id: number) {
    try {
      const existing = await this.db.query.states.findFirst({
        where: eq(states.id, id),
      });
      if (!existing) {
        throw new NotFoundException({ success: false, message: `State #${id} not found` });
      }

      // Cascade delete cities first
      await this.db.delete(cities).where(eq(cities.stateId, id));
      await this.db.delete(states).where(eq(states.id, id));

      return {
        success: true,
        message: `State "${existing.name}" and its associated cities were deleted successfully`,
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to delete state #${id}:`, error);
      throw new HttpException(
        { success: false, message: `Failed to delete state #${id}`, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ==========================================
  // ADMIN CITIES MANAGEMENT
  // ==========================================

  async getAdminCities(query: { state_id?: number; search?: string; status?: string; page?: number; limit?: number }) {
    try {
      const page = Math.max(1, Number(query.page) || 1);
      const limit = Math.max(1, Math.min(200, Number(query.limit) || 30));
      const offset = (page - 1) * limit;

      const conditions: any[] = [];

      if (query.state_id) {
        conditions.push(eq(cities.stateId, Number(query.state_id)));
      }

      if (query.search && query.search.trim()) {
        conditions.push(like(cities.name, `%${query.search.trim()}%`));
      }

      if (query.status !== undefined && query.status !== '' && query.status !== 'all') {
        const isTrue = query.status === 'true' || query.status === '1' || query.status === 'active';
        conditions.push(eq(cities.status, isTrue));
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [totalCountRow]: any = await this.db
        .select({ count: count() })
        .from(cities)
        .where(whereClause);
      const totalItems = Number(totalCountRow?.count || 0);

      const rawCities = await this.db.query.cities.findMany({
        where: whereClause,
        with: {
          state: true,
        } as any,
        orderBy: [asc(cities.name)],
        limit,
        offset,
      });

      const items = rawCities.map((c: any) => ({
        id: Number(c.id),
        name: c.name,
        state_id: Number(c.stateId),
        state_name: c.state?.name || 'Unknown State',
        state_status: c.state?.status !== undefined ? Boolean(c.state.status) : true,
        status: Boolean(c.status),
        created_at: c.createdAt,
        updated_at: c.updatedAt,
      }));

      // Count total active/inactive across cities (or filtered state)
      const countFilter = query.state_id ? eq(cities.stateId, Number(query.state_id)) : undefined;
      const [allTotalRow]: any = await this.db.select({ count: count() }).from(cities).where(countFilter);
      const [allActiveRow]: any = await this.db
        .select({ count: count() })
        .from(cities)
        .where(countFilter ? and(countFilter, eq(cities.status, true)) : eq(cities.status, true));
      const totalAll = Number(allTotalRow?.count || 0);
      const activeAll = Number(allActiveRow?.count || 0);

      return {
        success: true,
        data: items,
        meta: {
          total: totalItems,
          page,
          limit,
          total_pages: Math.ceil(totalItems / limit) || 1,
          has_more: offset + limit < totalItems,
          stats: {
            total: totalAll,
            active: activeAll,
            inactive: totalAll - activeAll,
          },
        },
      };
    } catch (error: any) {
      this.logger.error('Failed to fetch admin cities:', error);
      throw new HttpException(
        { success: false, message: 'Failed to fetch admin cities', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCityById(id: number) {
    try {
      const city: any = await this.db.query.cities.findFirst({
        where: eq(cities.id, id),
        with: {
          state: true,
        } as any,
      });

      if (!city) {
        throw new NotFoundException({ success: false, message: `City #${id} not found` });
      }

      return {
        success: true,
        data: {
          id: Number(city.id),
          name: city.name,
          state_id: Number(city.stateId),
          state_name: city.state?.name || '',
          status: Boolean(city.status),
          created_at: city.createdAt,
          updated_at: city.updatedAt,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, message: `Failed to fetch city #${id}`, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createCity(data: { name: string; state_id: number; status?: boolean }) {
    try {
      const name = data?.name?.trim();
      const stateId = Number(data?.state_id);

      if (!name) {
        throw new BadRequestException({ success: false, message: 'City name is required' });
      }
      if (!stateId) {
        throw new BadRequestException({ success: false, message: 'Valid State ID is required' });
      }

      // Check state exists
      const state = await this.db.query.states.findFirst({
        where: eq(states.id, stateId),
      });
      if (!state) {
        throw new BadRequestException({ success: false, message: `Selected state #${stateId} does not exist` });
      }

      // Check duplicate within same state
      const existing = await this.db.query.cities.findFirst({
        where: and(eq(cities.name, name), eq(cities.stateId, stateId)),
      });
      if (existing) {
        throw new BadRequestException({ success: false, message: `City "${name}" already exists in ${state.name}` });
      }

      const status = data.status !== undefined ? Boolean(data.status) : true;

      const insertRes: any = await this.db.insert(cities).values({
        name,
        stateId,
        status,
      });

      let cityId = Number(insertRes?.[0]?.insertId || insertRes?.insertId || 0);
      if (!cityId) {
        const found = await this.db.query.cities.findFirst({
          where: and(eq(cities.name, name), eq(cities.stateId, stateId)),
          orderBy: [desc(cities.id)],
        });
        cityId = Number(found?.id || 0);
      }

      const created = await this.db.query.cities.findFirst({
        where: eq(cities.id, cityId),
        with: { state: true } as any,
      });

      return {
        success: true,
        message: 'City created successfully',
        data: created,
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Failed to create city:', error);
      throw new HttpException(
        { success: false, message: 'Failed to create city', error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateCity(id: number, data: { name?: string; state_id?: number; status?: boolean }) {
    try {
      const existing = await this.db.query.cities.findFirst({
        where: eq(cities.id, id),
      });
      if (!existing) {
        throw new NotFoundException({ success: false, message: `City #${id} not found` });
      }

      const updatePayload: any = {};
      const targetStateId = data.state_id ? Number(data.state_id) : existing.stateId;

      if (data.state_id !== undefined && data.state_id !== existing.stateId) {
        const state = await this.db.query.states.findFirst({
          where: eq(states.id, targetStateId),
        });
        if (!state) {
          throw new BadRequestException({ success: false, message: `State #${targetStateId} not found` });
        }
        updatePayload.stateId = targetStateId;
      }

      if (data.name !== undefined) {
        const name = data.name.trim();
        if (!name) {
          throw new BadRequestException({ success: false, message: 'City name cannot be empty' });
        }
        // Check duplicate within the target state
        if (name.toLowerCase() !== existing.name.toLowerCase() || targetStateId !== existing.stateId) {
          const duplicate = await this.db.query.cities.findFirst({
            where: and(eq(cities.name, name), eq(cities.stateId, targetStateId)),
          });
          if (duplicate && duplicate.id !== id) {
            throw new BadRequestException({ success: false, message: `City "${name}" already exists in this state` });
          }
        }
        updatePayload.name = name;
      }

      if (data.status !== undefined) {
        updatePayload.status = Boolean(data.status);
      }

      if (Object.keys(updatePayload).length > 0) {
        await this.db.update(cities).set(updatePayload).where(eq(cities.id, id));
      }

      const updated = await this.db.query.cities.findFirst({
        where: eq(cities.id, id),
        with: { state: true } as any,
      });

      return {
        success: true,
        message: 'City updated successfully',
        data: updated,
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to update city #${id}:`, error);
      throw new HttpException(
        { success: false, message: `Failed to update city #${id}`, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async toggleCityStatus(id: number) {
    try {
      const existing = await this.db.query.cities.findFirst({
        where: eq(cities.id, id),
      });
      if (!existing) {
        throw new NotFoundException({ success: false, message: `City #${id} not found` });
      }

      const newStatus = !existing.status;
      await this.db.update(cities).set({ status: newStatus }).where(eq(cities.id, id));

      return {
        success: true,
        message: `City "${existing.name}" is now ${newStatus ? 'active' : 'inactive'}`,
        data: {
          id: Number(existing.id),
          name: existing.name,
          status: newStatus,
        },
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to toggle status for city #${id}:`, error);
      throw new HttpException(
        { success: false, message: `Failed to toggle city status`, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteCity(id: number) {
    try {
      const existing = await this.db.query.cities.findFirst({
        where: eq(cities.id, id),
      });
      if (!existing) {
        throw new NotFoundException({ success: false, message: `City #${id} not found` });
      }

      await this.db.delete(cities).where(eq(cities.id, id));

      return {
        success: true,
        message: `City "${existing.name}" deleted successfully`,
      };
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to delete city #${id}:`, error);
      throw new HttpException(
        { success: false, message: `Failed to delete city #${id}`, error: error.message },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
