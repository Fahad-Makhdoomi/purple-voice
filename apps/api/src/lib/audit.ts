import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { logger } from './logger';

/**
 * Records who did what. Every staff action inside a customer workspace and
 * every billing change goes through here, so support can answer "who changed
 * this?" without guessing. Failures are logged, never thrown: an audit write
 * must not break the action it describes.
 */
export async function audit(
  req: Request | null,
  action: string,
  data: {
    workspaceId?: string | null;
    entity?: string;
    entityId?: string;
    meta?: Prisma.InputJsonValue;
    actorId?: string | null;
  } = {},
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        actorId: data.actorId ?? req?.user?.id ?? null,
        workspaceId: data.workspaceId ?? req?.workspaceId ?? null,
        entity: data.entity,
        entityId: data.entityId,
        meta: data.meta,
        ip: req?.ip,
      },
    });
  } catch (err) {
    logger.warn({ err, action }, 'Audit write failed');
  }
}
