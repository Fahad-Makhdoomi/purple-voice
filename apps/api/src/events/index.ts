import type { Prisma } from '@prisma/client';
import type { WebhookEvent } from '@pv/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { randomToken } from '../lib/crypto';
import { getEntitlements } from '../services/entitlements';
import { runAutomations } from './automations';

/**
 * The one place domain events leave the system. Call this after the database
 * write it describes; it fans the event out to the workspace's webhook
 * endpoints (queued, delivered with retries by the worker) and its
 * automation rules. Plan gates are applied here, so callers don't repeat them.
 */
export async function emitEvent(
  workspaceId: string,
  type: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const ent = await getEntitlements(workspaceId);
    if (!ent.active) return;

    const payload = {
      id: `evt_${randomToken(12)}`,
      type,
      createdAt: new Date().toISOString(),
      workspaceId,
      data,
    } satisfies Record<string, unknown>;

    if (ent.features.webhooks) {
      const endpoints = await prisma.webhookEndpoint.findMany({
        where: { workspaceId, active: true, events: { has: type } },
        select: { id: true },
      });
      if (endpoints.length) {
        await prisma.webhookDelivery.createMany({
          data: endpoints.map((e) => ({
            endpointId: e.id,
            event: type,
            payload: payload as unknown as Prisma.InputJsonValue,
          })),
        });
      }
    }

    if (ent.features.advancedAutomations) await runAutomations(workspaceId, type, data);
  } catch (err) {
    logger.error({ err, workspaceId, type }, 'Failed to emit event');
  }
}
