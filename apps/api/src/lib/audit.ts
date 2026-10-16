import type { Request } from 'express';
import type { Types } from 'mongoose';
import { AuditLog } from '../models/AuditLog';
import { logger } from './logger';

interface AuditInput {
  action: string;
  actorId?: Types.ObjectId | string | null;
  entityType?: string;
  entityId?: Types.ObjectId | string | null;
  meta?: Record<string, unknown>;
  req?: Request;
}

/** Writes an audit record. Never throws: auditing must not break the primary action. */
export async function audit({ action, actorId, entityType, entityId, meta, req }: AuditInput): Promise<void> {
  try {
    await AuditLog.create({
      action,
      actorId: actorId ?? req?.auth?.user._id ?? null,
      entity: entityType ? { type: entityType, id: entityId ?? null } : undefined,
      meta,
      ip: req?.ip,
      userAgent: req?.get('user-agent')?.slice(0, 300),
    });
  } catch (err) {
    logger.error({ err, action }, 'Failed to write audit log');
  }
}
