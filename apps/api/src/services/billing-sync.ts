import type { PaymentGateway, PlanCode } from '@pv/shared';
import type { Subscription, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { applySubscriptionChange } from './subscriptions';
import { cancelSubscription as cancelStripe } from './stripe';
import { cancelRazorpaySubscription } from './razorpay';
import { cancelPaypalSubscription } from './paypal';

/**
 * Keeps a workspace's subscription in step with whichever gateway it pays
 * through. A workspace has one current subscription; the rules:
 *
 *  - events for the current subscription always apply;
 *  - another subscription takes over only once it's live (paid), e.g. after
 *    a plan switch on Razorpay/PayPal or a move between gateways — and the
 *    one it replaced is then cancelled at the gateway so nobody pays twice;
 *  - anything else (a superseded subscription's "cancelled", an abandoned
 *    checkout's "created") is ignored.
 */

const LIVE: SubscriptionStatus[] = ['ACTIVE', 'TRIALING', 'PAST_DUE'];

const ID_FIELD = {
  STRIPE: 'stripeSubscriptionId',
  RAZORPAY: 'razorpaySubscriptionId',
  PAYPAL: 'paypalSubscriptionId',
} as const satisfies Record<PaymentGateway, keyof Subscription>;

/** The gateway subscription a workspace currently pays through, if any. */
export function currentGatewaySubscription(
  sub: Subscription | null,
): { gateway: PaymentGateway; id: string } | null {
  if (!sub || sub.provider === 'MANUAL') return null;
  const id = sub[ID_FIELD[sub.provider]];
  return id ? { gateway: sub.provider, id } : null;
}

export interface GatewaySubscriptionState {
  gateway: PaymentGateway;
  subscriptionId: string;
  status: SubscriptionStatus;
  planCode?: PlanCode;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  /** Leave undefined when the gateway doesn't report it, to keep ours. */
  cancelAtPeriodEnd?: boolean;
  stripeCustomerId?: string;
}

export type SyncResult = 'applied' | 'took_over' | 'ignored';

export async function syncGatewaySubscription(
  workspaceId: string,
  state: GatewaySubscriptionState,
): Promise<SyncResult> {
  const before = await prisma.subscription.findUnique({ where: { workspaceId } });
  const current = currentGatewaySubscription(before);
  const isCurrent = current?.gateway === state.gateway && current.id === state.subscriptionId;
  const live = LIVE.includes(state.status);

  if (!isCurrent && !live) {
    logger.info(
      {
        workspaceId,
        gateway: state.gateway,
        subscription: state.subscriptionId,
        status: state.status,
      },
      'Ignoring update for a subscription that is not the workspace’s current one',
    );
    return 'ignored';
  }

  await applySubscriptionChange(workspaceId, {
    planCode: state.planCode,
    status: state.status,
    provider: state.gateway,
    [ID_FIELD[state.gateway]]: state.subscriptionId,
    ...(state.stripeCustomerId ? { stripeCustomerId: state.stripeCustomerId } : {}),
    currentPeriodStart: state.currentPeriodStart,
    currentPeriodEnd: state.currentPeriodEnd,
    cancelAtPeriodEnd: isCurrent ? state.cancelAtPeriodEnd : (state.cancelAtPeriodEnd ?? false),
  });
  if (isCurrent) return 'applied';

  // A new subscription took over: stop billing the one it replaced.
  if (current && before && LIVE.includes(before.status)) {
    await cancelSuperseded(workspaceId, current);
  }
  return 'took_over';
}

async function cancelSuperseded(workspaceId: string, old: { gateway: PaymentGateway; id: string }) {
  try {
    if (old.gateway === 'STRIPE') await cancelStripe(old.id);
    else if (old.gateway === 'RAZORPAY') await cancelRazorpaySubscription(old.id, false);
    else await cancelPaypalSubscription(old.id, 'Replaced by a new Purple Voice subscription');
    logger.info({ workspaceId, ...old }, 'Cancelled superseded subscription');
  } catch (err) {
    // Never fail the webhook over this; staff can cancel it at the gateway.
    logger.error(
      { err, workspaceId, ...old },
      'Could not cancel superseded subscription — cancel it at the gateway to avoid double billing',
    );
  }
}

/** Workspace for a gateway subscription id we already know about. */
export async function workspaceForGatewaySubscription(
  gateway: PaymentGateway,
  subscriptionId: string,
): Promise<string | undefined> {
  const row = await prisma.subscription.findFirst({
    where: { [ID_FIELD[gateway]]: subscriptionId },
    select: { workspaceId: true },
  });
  return row?.workspaceId;
}

/** Records a successful charge once (gateway payment ids are unique). */
export async function recordPayment(input: {
  workspaceId: string;
  gateway: PaymentGateway;
  providerPaymentId: string;
  amountMinor: number;
  currency: string;
  description?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  paidAt: Date;
}) {
  await prisma.payment.upsert({
    where: { providerInvoiceId: input.providerPaymentId },
    create: {
      workspaceId: input.workspaceId,
      amountCents: input.amountMinor,
      currency: input.currency.toLowerCase(),
      status: 'paid',
      provider: input.gateway,
      providerInvoiceId: input.providerPaymentId,
      description: input.description ?? null,
      periodStart: input.periodStart ?? null,
      periodEnd: input.periodEnd ?? null,
      paidAt: input.paidAt,
    },
    update: { status: 'paid' },
  });
}
