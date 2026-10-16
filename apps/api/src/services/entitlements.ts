import {
  LIMIT_LABELS,
  isEntitledStatus,
  mergeFeatures,
  mergeLimits,
  withinLimit,
  type Entitlements,
  type LimitKey,
  type PlanFeatures,
  type PlanLimits,
  type UsageSnapshot,
} from '@pv/shared';
import { prisma } from '../lib/prisma';
import { planLimit } from '../lib/http-error';

const ZERO_LIMITS: PlanLimits = {
  agents: 0,
  phoneNumbers: 0,
  campaigns: 0,
  contactsPerCampaign: 0,
  integrations: 0,
  concurrentCalls: 0,
  webhooks: 0,
  apiKeys: 0,
  automations: 0,
};

const NO_FEATURES: PlanFeatures = {
  personalizedPrompts: false,
  appointmentBooking: false,
  callSummary: false,
  callTransfer: false,
  googleCalendar: false,
  multipleIntegrations: false,
  webhooks: false,
  developerApi: false,
  detailedInsights: false,
  aiSupportAssistant: false,
  prioritySupport: false,
  advancedAutomations: false,
};

/**
 * Manual (admin-granted) subscriptions lapse at their period end, as do
 * Razorpay and PayPal ones cancelled at period end (PayPal stops billing at
 * once and never sends a later event). Live gateway subscriptions follow
 * their webhooks.
 */
const MANUAL_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

export async function getEntitlements(workspaceId: string): Promise<Entitlements> {
  const sub = await prisma.subscription.findUnique({
    where: { workspaceId },
    include: { plan: true },
  });

  if (!sub) {
    return {
      planCode: null,
      planName: null,
      status: null,
      active: false,
      includedMinutes: 0,
      limits: ZERO_LIMITS,
      features: NO_FEATURES,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    };
  }

  const manualLapsed =
    (sub.provider === 'MANUAL' ||
      (sub.cancelAtPeriodEnd && (sub.provider === 'RAZORPAY' || sub.provider === 'PAYPAL'))) &&
    !!sub.currentPeriodEnd &&
    sub.currentPeriodEnd.getTime() + MANUAL_GRACE_MS < Date.now();

  return {
    planCode: sub.plan.code,
    planName: sub.plan.name,
    status: sub.status,
    active: isEntitledStatus(sub.status) && !manualLapsed,
    includedMinutes: sub.customMinutes ?? sub.plan.includedMinutes,
    limits: mergeLimits(
      sub.plan.limits as unknown as PlanLimits,
      sub.customLimits as Partial<PlanLimits> | null,
    ),
    features: mergeFeatures(sub.plan.features as unknown as PlanFeatures),
    currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  };
}

/**
 * The usage window minutes are counted in: the subscription's billing period
 * when we know it, otherwise the current calendar month (UTC).
 */
export function usageWindow(
  ent: Pick<Entitlements, 'currentPeriodStart' | 'currentPeriodEnd'>,
  now = new Date(),
) {
  if (ent.currentPeriodStart && ent.currentPeriodEnd) {
    const start = new Date(ent.currentPeriodStart);
    const end = new Date(ent.currentPeriodEnd);
    if (start <= now && now < end) return { start, end };
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

export async function minutesUsed(workspaceId: string, ent: Entitlements): Promise<number> {
  const { start } = usageWindow(ent);
  const row = await prisma.usagePeriod.findUnique({
    where: { workspaceId_periodStart: { workspaceId, periodStart: start } },
    select: { minutesUsed: true },
  });
  return row?.minutesUsed ?? 0;
}

/** Atomically adds a finished call's minutes to the current period. */
export async function recordUsage(workspaceId: string, minutes: number): Promise<void> {
  const ent = await getEntitlements(workspaceId);
  const { start, end } = usageWindow(ent);
  await prisma.usagePeriod.upsert({
    where: { workspaceId_periodStart: { workspaceId, periodStart: start } },
    create: { workspaceId, periodStart: start, periodEnd: end, minutesUsed: minutes, callCount: 1 },
    update: { minutesUsed: { increment: minutes }, callCount: { increment: 1 } },
  });
}

type Counter = (workspaceId: string) => Promise<number>;

const COUNTERS: Partial<Record<LimitKey, Counter>> = {
  agents: (workspaceId) => prisma.agent.count({ where: { workspaceId } }),
  phoneNumbers: (workspaceId) => prisma.phoneNumber.count({ where: { workspaceId } }),
  campaigns: (workspaceId) =>
    prisma.campaign.count({ where: { workspaceId, status: { not: 'CANCELED' } } }),
  integrations: (workspaceId) => prisma.integration.count({ where: { workspaceId } }),
  webhooks: (workspaceId) => prisma.webhookEndpoint.count({ where: { workspaceId } }),
  apiKeys: (workspaceId) => prisma.apiKey.count({ where: { workspaceId, revokedAt: null } }),
  automations: (workspaceId) => prisma.automation.count({ where: { workspaceId } }),
  concurrentCalls: (workspaceId) =>
    prisma.call.count({
      where: { workspaceId, status: { in: ['QUEUED', 'RINGING', 'IN_PROGRESS'] } },
    }),
};

/**
 * Throws a 403 `plan_limit` when adding `adding` more of `key` would exceed
 * the plan. Pass `current` when the caller already knows the count (e.g.
 * contacts in one campaign), otherwise it is counted here.
 */
export async function assertWithinLimit(
  workspaceId: string,
  ent: Entitlements,
  key: LimitKey,
  opts: { adding?: number; current?: number } = {},
): Promise<void> {
  const limit = ent.limits[key];
  const adding = opts.adding ?? 1;
  if (limit === null) return;
  const counter = COUNTERS[key];
  const current = opts.current ?? (counter ? await counter(workspaceId) : 0);
  if (!withinLimit(limit, current, adding)) {
    const label = LIMIT_LABELS[key];
    throw planLimit(
      limit === 0
        ? `${label} are not included in your plan. Upgrade to Pro to unlock them.`
        : `You've reached your plan's limit for ${label} (${limit}). Upgrade to add more.`,
      { limit: key, max: limit, current },
    );
  }
}

export async function getUsage(workspaceId: string, ent?: Entitlements): Promise<UsageSnapshot> {
  const e = ent ?? (await getEntitlements(workspaceId));
  const [minutes, agents, phoneNumbers, campaigns, integrations, webhooks, apiKeys, automations] =
    await Promise.all([
      minutesUsed(workspaceId, e),
      COUNTERS.agents!(workspaceId),
      COUNTERS.phoneNumbers!(workspaceId),
      COUNTERS.campaigns!(workspaceId),
      COUNTERS.integrations!(workspaceId),
      COUNTERS.webhooks!(workspaceId),
      COUNTERS.apiKeys!(workspaceId),
      COUNTERS.automations!(workspaceId),
    ]);
  return {
    minutesUsed: minutes,
    minutesIncluded: e.includedMinutes,
    agents,
    phoneNumbers,
    campaigns,
    integrations,
    webhooks,
    apiKeys,
    automations,
  };
}

/** Whether the workspace may start another call right now (minutes + concurrency). */
export async function canStartCall(
  workspaceId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const ent = await getEntitlements(workspaceId);
  if (!ent.active) return { ok: false, reason: 'No active subscription' };
  if (ent.includedMinutes !== null) {
    const used = await minutesUsed(workspaceId, ent);
    if (used >= ent.includedMinutes) return { ok: false, reason: 'Monthly call minutes used up' };
  }
  const live = await COUNTERS.concurrentCalls!(workspaceId);
  if (live >= ent.limits.concurrentCalls)
    return { ok: false, reason: 'Concurrent call limit reached' };
  return { ok: true };
}
