import { prisma } from '../lib/prisma';
import { applySubscriptionChange } from './subscriptions';

/**
 * The platform's own workspace. Super admins open it from the admin panel
 * (Our workspace) to build agents, run campaigns and make calls for Purple
 * Voice itself, through the same dashboard customers use. It is on the
 * Enterprise plan with no end date, uses the platform's AI keys, is never
 * billed and is left out of the subscriber list and revenue analytics.
 */

const NAME = 'Purple Voice (our workspace)';
/** A manual subscription lapses at its period end; this one effectively never does. */
const FOREVER = new Date(Date.UTC(2125, 0, 1));

export async function ensureInternalWorkspace(): Promise<{ id: string; name: string }> {
  const existing = await prisma.workspace.findFirst({
    where: { internal: true },
    orderBy: { createdAt: 'asc' },
    include: { subscription: { include: { plan: true } } },
  });
  const workspace =
    existing ?? (await prisma.workspace.create({ data: { name: NAME, internal: true } }));

  const sub = existing?.subscription;
  const healthy =
    sub?.plan.code === 'ENTERPRISE' &&
    sub.status === 'ACTIVE' &&
    sub.provider === 'MANUAL' &&
    (sub.currentPeriodEnd?.getTime() ?? 0) >= FOREVER.getTime();
  if (!healthy) {
    await applySubscriptionChange(
      workspace.id,
      {
        planCode: 'ENTERPRISE',
        status: 'ACTIVE',
        provider: 'MANUAL',
        currentPeriodStart: new Date(),
        currentPeriodEnd: FOREVER,
        cancelAtPeriodEnd: false,
      },
      { forceEventType: 'ADMIN_CHANGE', note: 'Platform workspace' },
    );
  }
  return { id: workspace.id, name: workspace.name };
}
