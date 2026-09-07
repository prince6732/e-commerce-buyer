import { Injectable, Inject, Logger } from '@nestjs/common';
import { DRIZZLE } from '../database/database.provider';
import type { DrizzleDB } from '../database/database.provider';
import { adminAuditLogs } from '../database/schema/audit';

export interface AuditLogOptions {
  entityType: string;
  entityId: number | string;
  action: string;
  performedBy?: string;
  performedById?: number | null;
  previousState?: any;
  newState?: any;
  oldValue?: any;
  newValue?: any;
  reason?: string;
  ipAddress?: string;
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async logAction(
    optionsOrAdminId: AuditLogOptions | number | null | undefined,
    action?: string,
    entityType?: string,
    entityId?: number,
    oldValue?: any,
    newValue?: any,
    reason?: string,
    ipAddress?: string,
  ): Promise<void> {
    try {
      if (typeof optionsOrAdminId === 'object' && optionsOrAdminId !== null) {
        const opts = optionsOrAdminId as AuditLogOptions;
        await this.db.insert(adminAuditLogs).values({
          adminId: opts.performedById ? Number(opts.performedById) : null,
          action: opts.action,
          entityType: opts.entityType,
          entityId: Number(opts.entityId),
          oldValue: (opts.previousState || opts.oldValue) ? JSON.stringify(opts.previousState || opts.oldValue) : null,
          newValue: (opts.newState || opts.newValue) ? JSON.stringify(opts.newState || opts.newValue) : null,
          reason: opts.reason || null,
          ipAddress: opts.ipAddress || null,
          createdAt: new Date(),
        });
      } else {
        const adminId = optionsOrAdminId as number | null | undefined;
        await this.db.insert(adminAuditLogs).values({
          adminId: adminId ? Number(adminId) : null,
          action: action || 'UNKNOWN',
          entityType: entityType || 'unknown',
          entityId: Number(entityId || 0),
          oldValue: oldValue ? JSON.stringify(oldValue) : null,
          newValue: newValue ? JSON.stringify(newValue) : null,
          reason: reason || null,
          ipAddress: ipAddress || null,
          createdAt: new Date(),
        });
      }
    } catch (err: any) {
      this.logger.error(`Failed to record admin audit log: ${err.message}`);
    }
  }
}
