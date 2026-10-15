import express, { Router } from 'express';
import { checkoutSchema, type PlanCode } from '@pv/shared';
import type { SubscriptionStatus } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { audit } from '../lib/audit';
import { HttpError, badRequest, notFound } from '../lib/http-error';
import { authenticate } from '../middleware/auth';
import { resolveWorkspace, wsId } from '../middleware/workspace';
import { applySubscriptionChange } from '../services/subscriptions';
import { getEntitlements, getUsage } from '../services/entitlements';
import {
  createCheckoutSession,
  createPortalSession,
  retrieveSubscription,
  subscriptionPeriod,
  updateSubscriptionPrice,
  verifyWebhook,
  type StripeCheckoutSession,
  type StripeInvoice,
  type StripeSubscription,
} from '../services/stripe';

export const billingRouter = Router();

const STRIPE_STATUS: Record<string, SubscriptionStatus> = {
  active: 'ACTIVE',
  trialing: 'TRIALING',
  past_due: 'PAST_DUE',
  canceled: 'CANCELED',
  unpaid: 'UNPAID',
  incomplete: 'INCOMPLETE',
  incomplete_expired: 'CANCELED',
  paused: 'UNPAID',
};

async function priceIdFor(code: PlanCode): Promise<string> {
  const plan = await prisma.plan.findUnique({ where: { code } });
  const fromEnv =
    code === 'BASIC' ? env.STRIPE_PRICE_BASIC : code === 'PRO' ? env.STRIPE_PRICE_PRO : undefined;
  const id = plan?.stripePriceId ?? fromEnv;
  if (!id)
    throw new HttpError(
      503,
      `No Stripe price configured for the ${code} plan`,
      'billing_unavailable',
    );
  return id;
}

async function planCodeForPrice(priceId: string): Promise<PlanCode | undefined> {
  const plan = await prisma.plan.findFirst({ where: { stripePriceId: priceId } });
  if (plan) return plan.code;
  if (priceId === env.STRIPE_PRICE_BASIC) return 'BASIC';
  if (priceId === env.STRIPE_PRICE_PRO) return 'PRO';
  return undefined;
}

async function syncStripeSubscription(workspaceId: string, sub: StripeSubscription) {
  const priceId = sub.items.data[0]?.price.id;
  const planCode = priceId ? await planCodeForPrice(priceId) : undefined;
  const period = subscriptionPeriod(sub);
  await applySubscriptionChange(workspaceId, {
    planCode,
    status: STRIPE_STATUS[sub.status] ?? 'INCOMPLETE',
    provider: 'STRIPE',
    stripeCustomerId: sub.customer,
    stripeSubscriptionId: sub.id,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  });
}

async function workspaceForStripe(customerId?: string, subscriptionId?: string, hinted?: string) {
  if (hinted) return hinted;
  const sub = await prisma.subscription.findFirst({
    where: {
      OR: [
        ...(subscriptionId ? [{ stripeSubscriptionId: subscriptionId }] : []),
        ...(customerId ? [{ stripeCustomerId: customerId }] : []),
      ],
    },
    select: { workspaceId: true },
  });
  return sub?.workspaceId;
}

// ── Stripe webhook: raw body, no auth, verified by signature ───────────────

billingRouter.post(
  '/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req, res) => {
    const event = verifyWebhook(req.body as Buffer, req.header('stripe-signature'));
    const obj = event.data.object;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = obj as StripeCheckoutSession;
        const workspaceId = session.client_reference_id ?? session.metadata?.workspaceId;
        if (workspaceId && session.subscription) {
          await syncStripeSubscription(
            workspaceId,
            await retrieveSubscription(session.subscription),
          );
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = obj as StripeSubscription;
        const workspaceId = await workspaceForStripe(
          sub.customer,
          sub.id,
          sub.metadata?.workspaceId,
        );
        if (workspaceId) await syncStripeSubscription(workspaceId, sub);
        else logger.warn({ subscription: sub.id }, 'Stripe subscription for unknown workspace');
        break;
      }
      case 'invoice.paid': {
        const invoice = obj as StripeInvoice;
        const workspaceId = await workspaceForStripe(invoice.customer);
        if (!workspaceId) break;
        const line = invoice.lines?.data[0];
        const paidAt = invoice.status_transitions?.paid_at;
        await prisma.payment.upsert({
          where: { providerInvoiceId: invoice.id },
          create: {
            workspaceId,
            amountCents: invoice.amount_paid,
            currency: invoice.currency,
            status: 'paid',
            provider: 'STRIPE',
            providerInvoiceId: invoice.id,
            description: line?.description,
            periodStart: line?.period ? new Date(line.period.start * 1000) : null,
            periodEnd: line?.period ? new Date(line.period.end * 1000) : null,
            paidAt: paidAt ? new Date(paidAt * 1000) : new Date(),
          },
          update: { status: 'paid' },
        });
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  },
);

// ── Workspace billing ───────────────────────────────────────────────────────
// This router is mounted ahead of the global JSON parser (the webhook needs
// the raw body), so it parses JSON itself for everything after the webhook.

billingRouter.use(express.json({ limit: '100kb' }), authenticate, resolveWorkspace);

billingRouter.get('/', async (req, res) => {
  const workspaceId = wsId(req);
  const [entitlements, subscription, plans, payments] = await Promise.all([
    getEntitlements(workspaceId),
    prisma.subscription.findUnique({ where: { workspaceId }, include: { plan: true } }),
    prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.payment.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 24 }),
  ]);
  const usage = await getUsage(workspaceId, entitlements);
  res.json({
    entitlements,
    usage,
    subscription: subscription && {
      planCode: subscription.plan.code,
      status: subscription.status,
      provider: subscription.provider,
      currentPeriodEnd: subscription.currentPeriodEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      hasStripeCustomer: !!subscription.stripeCustomerId,
    },
    plans: plans.map((p) => ({
      code: p.code,
      name: p.name,
      tagline: p.tagline,
      priceMonthlyCents: p.priceMonthlyCents,
      includedMinutes: p.includedMinutes,
      highlights: p.highlights,
      featured: p.featured,
      selfServe: p.selfServe,
    })),
    payments,
    billingMode: env.stripeEnabled ? 'stripe' : env.billingBypass ? 'dev' : 'unavailable',
  });
});

billingRouter.post('/checkout', async (req, res) => {
  const { planCode } = checkoutSchema.parse(req.body);
  const workspaceId = wsId(req);
  const user = req.user!;
  const current = await prisma.subscription.findUnique({ where: { workspaceId } });

  if (!env.stripeEnabled) {
    if (!env.billingBypass)
      throw new HttpError(503, 'Billing is not configured yet', 'billing_unavailable');
    const now = new Date();
    const end = new Date(now);
    end.setUTCMonth(end.getUTCMonth() + 1);
    await applySubscriptionChange(
      workspaceId,
      {
        planCode,
        status: 'ACTIVE',
        provider: 'MANUAL',
        currentPeriodStart: now,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: false,
      },
      { note: 'Development billing bypass' },
    );
    await audit(req, 'billing.dev_activate', { meta: { planCode } });
    return res.json({ activated: true });
  }

  const priceId = await priceIdFor(planCode);

  // Already subscribed through Stripe: switch the price in place (prorated).
  if (
    current?.stripeSubscriptionId &&
    ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(current.status)
  ) {
    const sub = await retrieveSubscription(current.stripeSubscriptionId);
    const updated = await updateSubscriptionPrice(sub, priceId);
    await syncStripeSubscription(workspaceId, updated);
    await audit(req, 'billing.plan_changed', { meta: { planCode } });
    return res.json({ activated: true });
  }

  const session = await createCheckoutSession({
    workspaceId,
    priceId,
    customerId: current?.stripeCustomerId,
    email: user.email,
    successUrl: `${env.appUrl}/dashboard/billing?checkout=success`,
    cancelUrl: `${env.appUrl}/dashboard/billing?checkout=canceled`,
  });
  res.json({ url: session.url });
});

billingRouter.post('/portal', async (req, res) => {
  const sub = await prisma.subscription.findUnique({ where: { workspaceId: wsId(req) } });
  if (!sub?.stripeCustomerId) throw badRequest('No billing account yet. Choose a plan first.');
  const portal = await createPortalSession(sub.stripeCustomerId, `${env.appUrl}/dashboard/billing`);
  res.json({ url: portal.url });
});

/** Manual (non-Stripe) subscriptions: stop renewing at period end. Stripe customers use the portal. */
billingRouter.post('/cancel', async (req, res) => {
  const workspaceId = wsId(req);
  const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (!sub) throw notFound('Subscription');
  if (sub.provider === 'STRIPE')
    throw badRequest('Manage your Stripe subscription from the billing portal');
  await applySubscriptionChange(workspaceId, { cancelAtPeriodEnd: true });
  await audit(req, 'billing.cancel_requested');
  res.json({ ok: true });
});
