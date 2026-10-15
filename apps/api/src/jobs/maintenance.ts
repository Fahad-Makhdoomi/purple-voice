import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { applyCallStatus, finalizeCall } from '../services/calls';
import { applySubscriptionChange } from '../services/subscriptions';

const MIN = 60_000;

/**
 * Safety nets for anything an external callback might have missed:
 * calls the carrier never reported on, calls never finalised, contacts
 * left mid-dial by a restart, manual subscriptions past their end date,
 * and expired auth rows.
 */
export async function maintenanceTick(): Promise<void> {
  const now = Date.now();

  // Calls stuck before answer → no answer; calls "in progress" for hours → completed.
  const stuckRinging = await prisma.call.findMany({
    where: { status: { in: ['QUEUED', 'RINGING'] }, createdAt: { lt: new Date(now - 10 * MIN) } },
    select: { id: true },
  });
  for (const c of stuckRinging) await applyCallStatus(c.id, 'NO_ANSWER');

  const stuckLive = await prisma.call.findMany({
    where: { status: 'IN_PROGRESS', createdAt: { lt: new Date(now - 2 * 60 * MIN) } },
    select: { id: true },
  });
  for (const c of stuckLive) await applyCallStatus(c.id, 'COMPLETED');

  // Terminal calls whose finalisation never ran (process restarted mid-delay).
  const unfinalized = await prisma.call.findMany({
    where: {
      finalizedAt: null,
      status: { in: ['COMPLETED', 'TRANSFERRED', 'NO_ANSWER', 'BUSY', 'FAILED', 'CANCELED'] },
      updatedAt: { lt: new Date(now - MIN) },
    },
    select: { id: true },
    take: 50,
  });
  for (const c of unfinalized) await finalizeCall(c.id);

  // Contacts claimed by a dialer that died before placing the call.
  await prisma.campaignContact.updateMany({
    where: { status: 'CALLING', lastAttemptAt: { lt: new Date(now - 2 * 60 * MIN) } },
    data: { status: 'PENDING' },
  });

  // Manual subscriptions past their end (plus grace) become canceled, so analytics see the churn.
  const lapsed = await prisma.subscription.findMany({
    where: {
      provider: 'MANUAL',
      status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
      currentPeriodEnd: { lt: new Date(now - 3 * 24 * 60 * MIN) },
    },
    select: { workspaceId: true },
  });
  for (const s of lapsed) {
    await applySubscriptionChange(
      s.workspaceId,
      { status: 'CANCELED' },
      { note: 'Manual subscription lapsed' },
    );
  }

  const cutoff = new Date(now - 30 * 24 * 60 * MIN);
  await prisma.session.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: cutoff } }] },
  });
  await prisma.passwordReset.deleteMany({ where: { expiresAt: { lt: cutoff } } });
  await prisma.webhookDelivery.deleteMany({
    where: { createdAt: { lt: new Date(now - 90 * 24 * 60 * MIN) } },
  });

  if (stuckRinging.length || stuckLive.length || unfinalized.length || lapsed.length) {
    logger.info(
      {
        stuckRinging: stuckRinging.length,
        stuckLive: stuckLive.length,
        unfinalized: unfinalized.length,
        lapsed: lapsed.length,
      },
      'Maintenance pass',
    );
  }
}
