import {
  Prisma,
  type BillingProvider,
  type PlanCode,
  type SubscriptionEventType,
  type SubscriptionStatus,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import { notFound } from '../lib/http-error';

/** Statuses that count as paying revenue in MRR. */
const PAYING: SubscriptionStatus[] = ['ACTIVE', 'PAST_DUE'];

export function mrrCents(sub: {
  status: SubscriptionStatus;
  customPriceCents: number | null;
  plan: { priceMonthlyCents: number | null };
}): number {
  if (!PAYING.includes(sub.status)) return 0;
  return sub.customPriceCents ?? sub.plan.priceMonthlyCents ?? 0;
}

export interface SubscriptionChange {
  planCode?: PlanCode;
  status?: SubscriptionStatus;
  provider?: BillingProvider;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  razorpaySubscriptionId?: string | null;
  paypalSubscriptionId?: string | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  cancelAtPeriodEnd?: boolean;
  customPriceCents?: number | null;
  customMinutes?: number | null;
  customLimits?: Prisma.InputJsonValue | null;
}

/**
 * The single write path for subscriptions — gateway webhooks, the dev billing
 * bypass and admin edits all come through here, so every change lands in
 * SubscriptionEvent with its MRR delta. Churn and revenue analytics read that
 * table rather than reconstructing history from the current state.
 */
export async function applySubscriptionChange(
  workspaceId: string,
  change: SubscriptionChange,
  opts: { forceEventType?: SubscriptionEventType; note?: string } = {},
) {
  const before = await prisma.subscription.findUnique({
    where: { workspaceId },
    include: { plan: true },
  });

  let planId = before?.planId;
  if (change.planCode) {
    const plan = await prisma.plan.findUnique({ where: { code: change.planCode } });
    if (!plan) throw notFound('Plan');
    planId = plan.id;
  }
  if (!planId) throw notFound('Plan');

  const data = {
    planId,
    status: change.status,
    provider: change.provider,
    stripeCustomerId: change.stripeCustomerId,
    stripeSubscriptionId: change.stripeSubscriptionId,
    razorpaySubscriptionId: change.razorpaySubscriptionId,
    paypalSubscriptionId: change.paypalSubscriptionId,
    currentPeriodStart: change.currentPeriodStart,
    currentPeriodEnd: change.currentPeriodEnd,
    cancelAtPeriodEnd: change.cancelAtPeriodEnd,
    customPriceCents: change.customPriceCents,
    customMinutes: change.customMinutes,
    customLimits: change.customLimits === null ? Prisma.DbNull : change.customLimits,
    canceledAt:
      change.status === 'CANCELED' && before?.status !== 'CANCELED'
        ? new Date()
        : change.status && change.status !== 'CANCELED'
          ? null
          : undefined,
  };

  const after = await prisma.subscription.upsert({
    where: { workspaceId },
    create: { workspaceId, ...data, status: change.status ?? 'INCOMPLETE' },
    update: data,
    include: { plan: true },
  });

  const oldMrr = before ? mrrCents(before) : 0;
  const newMrr = mrrCents(after);
  const type = opts.forceEventType ?? inferEventType(before, after, oldMrr, newMrr);

  if (type) {
    await prisma.subscriptionEvent.create({
      data: {
        workspaceId,
        type,
        fromPlan: before?.plan.code ?? null,
        toPlan: after.plan.code,
        mrrDeltaCents: newMrr - oldMrr,
        note: opts.note,
      },
    });
  }

  return after;
}

function inferEventType(
  before: { status: SubscriptionStatus; plan: { code: PlanCode } } | null,
  after: { status: SubscriptionStatus; plan: { code: PlanCode } },
  oldMrr: number,
  newMrr: number,
): SubscriptionEventType | null {
  const wasLive = !!before && PAYING.concat('TRIALING').includes(before.status);
  const isLive = PAYING.concat('TRIALING').includes(after.status);

  if (!wasLive && isLive) return before && before.status === 'CANCELED' ? 'REACTIVATED' : 'CREATED';
  if (wasLive && after.status === 'CANCELED') return 'CANCELED';
  if (before?.status !== 'PAST_DUE' && after.status === 'PAST_DUE') return 'PAYMENT_FAILED';
  if (wasLive && isLive && newMrr > oldMrr) return 'UPGRADED';
  if (wasLive && isLive && newMrr < oldMrr) return 'DOWNGRADED';
  return null;
}
