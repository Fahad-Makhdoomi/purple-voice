import express, { Router } from 'express';
import {
  PAYMENT_GATEWAY_LABELS,
  checkoutConfirmSchema,
  checkoutSchema,
  type PaymentGateway,
} from '@pv/shared';
import type { SubscriptionStatus } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { audit } from '../lib/audit';
import { HttpError, badRequest, notFound } from '../lib/http-error';
import { authenticate } from '../middleware/auth';
import { resolveWorkspace, wsId } from '../middleware/workspace';
import { applySubscriptionChange } from '../services/subscriptions';
import { ensureRazorpayPlan, inrPrices } from '../services/razorpay-plans';
import { getEntitlements, getUsage } from '../services/entitlements';
import {
  anyGatewayEnabled,
  checkoutOptions,
  gatewayConfig,
  gatewayPlanId,
  planCodeForGatewayId,
} from '../services/payment-gateways';
import {
  currentGatewaySubscription,
  recordPayment,
  syncGatewaySubscription,
  workspaceForGatewaySubscription,
} from '../services/billing-sync';
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
import {
  RAZORPAY_STATUS,
  cancelRazorpaySubscription,
  createRazorpaySubscription,
  upsertRazorpayCustomer,
  fetchRazorpaySubscription,
  razorpayPeriod,
  razorpayWorkspaceId,
  verifyRazorpayWebhook,
  type RazorpaySubscription,
} from '../services/razorpay';
import {
  PAYPAL_STATUS,
  cancelPaypalSubscription,
  createPaypalSubscription,
  fetchPaypalSubscription,
  paypalPeriod,
  verifyPaypalWebhook,
  type PaypalSale,
  type PaypalSubscription,
} from '../services/paypal';

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

// ── Syncing each gateway's subscription object ─────────────────────────────

async function syncStripeSubscription(workspaceId: string, sub: StripeSubscription) {
  const priceId = sub.items.data[0]?.price.id;
  const period = subscriptionPeriod(sub);
  return syncGatewaySubscription(workspaceId, {
    gateway: 'STRIPE',
    subscriptionId: sub.id,
    planCode: priceId ? await planCodeForGatewayId('STRIPE', priceId) : undefined,
    status: STRIPE_STATUS[sub.status] ?? 'INCOMPLETE',
    stripeCustomerId: sub.customer,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  });
}

async function syncRazorpaySubscription(workspaceId: string, sub: RazorpaySubscription) {
  const period = razorpayPeriod(sub);
  return syncGatewaySubscription(workspaceId, {
    gateway: 'RAZORPAY',
    subscriptionId: sub.id,
    planCode: await planCodeForGatewayId('RAZORPAY', sub.plan_id),
    status: RAZORPAY_STATUS[sub.status] ?? 'INCOMPLETE',
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
  });
}

async function syncPaypalSubscription(workspaceId: string, sub: PaypalSubscription) {
  let status = PAYPAL_STATUS[sub.status] ?? 'INCOMPLETE';
  let { start, end } = paypalPeriod(sub);
  let cancelAtPeriodEnd: boolean | undefined;

  // PayPal cancels immediately; the customer keeps the period they paid for.
  if (status === 'CANCELED') {
    const row = await prisma.subscription.findUnique({ where: { workspaceId } });
    if (
      row?.paypalSubscriptionId === sub.id &&
      row.currentPeriodEnd &&
      row.currentPeriodEnd.getTime() > Date.now()
    ) {
      status = 'ACTIVE';
      start = row.currentPeriodStart;
      end = row.currentPeriodEnd;
      cancelAtPeriodEnd = true;
    }
  }
  return syncGatewaySubscription(workspaceId, {
    gateway: 'PAYPAL',
    subscriptionId: sub.id,
    planCode: await planCodeForGatewayId('PAYPAL', sub.plan_id),
    status,
    currentPeriodStart: start,
    currentPeriodEnd: end,
    cancelAtPeriodEnd,
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

// ── Webhooks: raw body, no auth, verified per gateway ──────────────────────

const rawJson = express.raw({ type: 'application/json', limit: '1mb' });

billingRouter.post('/webhook', rawJson, async (req, res) => {
  const config = await gatewayConfig('STRIPE');
  const event = verifyWebhook(
    req.body as Buffer,
    req.header('stripe-signature'),
    config?.webhookSecret,
  );
  const obj = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = obj as StripeCheckoutSession;
      const workspaceId = session.client_reference_id ?? session.metadata?.workspaceId;
      if (workspaceId && session.subscription) {
        await syncStripeSubscription(workspaceId, await retrieveSubscription(session.subscription));
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = obj as StripeSubscription;
      const workspaceId = await workspaceForStripe(sub.customer, sub.id, sub.metadata?.workspaceId);
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
      await recordPayment({
        workspaceId,
        gateway: 'STRIPE',
        providerPaymentId: invoice.id,
        amountMinor: invoice.amount_paid,
        currency: invoice.currency,
        description: line?.description,
        periodStart: line?.period ? new Date(line.period.start * 1000) : null,
        periodEnd: line?.period ? new Date(line.period.end * 1000) : null,
        paidAt: paidAt ? new Date(paidAt * 1000) : new Date(),
      });
      break;
    }
    default:
      break;
  }
  res.json({ received: true });
});

billingRouter.post('/webhook/razorpay', rawJson, async (req, res) => {
  const config = await gatewayConfig('RAZORPAY');
  const event = verifyRazorpayWebhook(
    req.body as Buffer,
    req.header('x-razorpay-signature'),
    config?.webhookSecret,
  );
  const sub = event.payload.subscription?.entity;
  if (event.event.startsWith('subscription.') && sub) {
    const workspaceId =
      razorpayWorkspaceId(sub) ?? (await workspaceForGatewaySubscription('RAZORPAY', sub.id));
    if (!workspaceId) {
      logger.warn({ subscription: sub.id }, 'Razorpay subscription for unknown workspace');
    } else {
      const result = await syncRazorpaySubscription(workspaceId, sub);
      const payment = event.payload.payment?.entity;
      if (event.event === 'subscription.charged' && payment && result !== 'ignored') {
        const period = razorpayPeriod(sub);
        await recordPayment({
          workspaceId,
          gateway: 'RAZORPAY',
          providerPaymentId: payment.id,
          amountMinor: payment.amount,
          currency: payment.currency,
          description: payment.description,
          periodStart: period.start,
          periodEnd: period.end,
          paidAt: new Date(payment.created_at * 1000),
        });
      }
    }
  }
  res.json({ received: true });
});

billingRouter.post('/webhook/paypal', rawJson, async (req, res) => {
  const event = await verifyPaypalWebhook(
    req.headers as Record<string, string | undefined>,
    req.body as Buffer,
  );

  if (event.event_type.startsWith('BILLING.SUBSCRIPTION.')) {
    // Re-read rather than trust the event: deliveries can arrive out of order.
    const id = (event.resource as PaypalSubscription).id;
    const sub = await fetchPaypalSubscription(id);
    const workspaceId = sub.custom_id ?? (await workspaceForGatewaySubscription('PAYPAL', id));
    if (workspaceId) await syncPaypalSubscription(workspaceId, sub);
    else logger.warn({ subscription: id }, 'PayPal subscription for unknown workspace');
  } else if (event.event_type === 'PAYMENT.SALE.COMPLETED') {
    const sale = event.resource as PaypalSale;
    if (sale.billing_agreement_id) {
      const sub = await fetchPaypalSubscription(sale.billing_agreement_id);
      const workspaceId =
        sub.custom_id ?? (await workspaceForGatewaySubscription('PAYPAL', sub.id));
      if (workspaceId) {
        const result = await syncPaypalSubscription(workspaceId, sub);
        if (result !== 'ignored') {
          const period = paypalPeriod(sub);
          await recordPayment({
            workspaceId,
            gateway: 'PAYPAL',
            providerPaymentId: sale.id,
            amountMinor: Math.round(Number(sale.amount.total) * 100),
            currency: sale.amount.currency,
            description: 'Purple Voice subscription',
            periodStart: period.start,
            periodEnd: period.end,
            paidAt: sale.create_time ? new Date(sale.create_time) : new Date(),
          });
        }
      }
    }
  }
  res.json({ received: true });
});

// ── Workspace billing ───────────────────────────────────────────────────────
// This router is mounted ahead of the global JSON parser (the webhooks need
// the raw body), so it parses JSON itself for everything after them.

billingRouter.use(express.json({ limit: '100kb' }), authenticate, resolveWorkspace);

async function devBypass(): Promise<boolean> {
  return !env.isProd && env.BILLING_DEV_BYPASS && !(await anyGatewayEnabled());
}

billingRouter.get('/', async (req, res) => {
  const workspaceId = wsId(req);
  const [entitlements, subscription, plans, payments, options, bypass, ws] = await Promise.all([
    getEntitlements(workspaceId),
    prisma.subscription.findUnique({ where: { workspaceId }, include: { plan: true } }),
    prisma.plan.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.payment.findMany({ where: { workspaceId }, orderBy: { createdAt: 'desc' }, take: 24 }),
    checkoutOptions(),
    devBypass(),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { gstin: true, billingName: true },
    }),
  ]);
  const inr = options.some((o) => o.gateway === 'RAZORPAY') ? await inrPrices(plans) : {};
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
      /** What Razorpay charges, in paise (rupees × 100). */
      priceMonthlyInrPaise: inr[p.code] ?? null,
      includedMinutes: p.includedMinutes,
      highlights: p.highlights,
      featured: p.featured,
      selfServe: p.selfServe,
    })),
    payments: payments.map((p) => ({
      id: p.id,
      amountCents: p.amountCents,
      currency: p.currency,
      status: p.status,
      provider: p.provider,
      paidAt: p.paidAt,
      description: p.description,
    })),
    checkoutOptions: options,
    billingDetails: { gstin: ws?.gstin ?? null, billingName: ws?.billingName ?? null },
    billingMode: options.length ? 'live' : bypass ? 'dev' : 'unavailable',
  });
});

billingRouter.post('/checkout', async (req, res) => {
  const { planCode, gateway: requested, gstin, billingName } = checkoutSchema.parse(req.body);
  const workspaceId = wsId(req);
  const user = req.user!;
  const current = await prisma.subscription.findUnique({ where: { workspaceId } });
  const options = await checkoutOptions();

  if (!options.length) {
    if (!(await devBypass()))
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

  const live = !!current && ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(current.status);
  const paying = live ? currentGatewaySubscription(current) : null;
  const gateway: PaymentGateway =
    requested ??
    (paying && options.some((o) => o.gateway === paying.gateway)
      ? paying.gateway
      : options[0]!.gateway);
  const option = options.find((o) => o.gateway === gateway);
  if (!option) throw badRequest(`${PAYMENT_GATEWAY_LABELS[gateway]} isn't available`);
  if (!option.planCodes.includes(planCode))
    throw badRequest(`The ${planCode} plan can't be bought through ${option.label} yet`);
  const planId =
    gateway === 'RAZORPAY'
      ? await ensureRazorpayPlan(await prisma.plan.findUniqueOrThrow({ where: { code: planCode } }))
      : (await gatewayPlanId(gateway, planCode))!;
  if (gstin !== undefined || billingName !== undefined) {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { gstin: gstin || null, billingName: billingName || null },
    });
  }

  // Already on Stripe: switch the price in place (prorated).
  if (gateway === 'STRIPE' && paying?.gateway === 'STRIPE') {
    const sub = await retrieveSubscription(paying.id);
    const updated = await updateSubscriptionPrice(sub, planId);
    await syncStripeSubscription(workspaceId, updated);
    await audit(req, 'billing.plan_changed', { meta: { planCode, gateway } });
    return res.json({ activated: true });
  }

  // Everything else starts a new subscription; once it's paid it replaces the
  // current one, which is then cancelled (see billing-sync.ts).
  const returnUrl = `${env.appUrl}/dashboard/billing`;
  await audit(req, 'billing.checkout_started', { meta: { planCode, gateway } });

  if (gateway === 'STRIPE') {
    const session = await createCheckoutSession({
      workspaceId,
      priceId: planId,
      customerId: current?.stripeCustomerId,
      email: user.email,
      successUrl: `${returnUrl}?checkout=success`,
      cancelUrl: `${returnUrl}?checkout=canceled`,
    });
    return res.json({ url: session.url });
  }
  if (gateway === 'RAZORPAY') {
    const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
    const customer = await upsertRazorpayCustomer({
      name: ws.billingName || ws.name,
      email: user.email,
      gstin: ws.gstin,
    });
    const sub = await createRazorpaySubscription({
      planId,
      workspaceId,
      customerId: customer.id,
      notes: {
        ...(ws.gstin ? { gstin: ws.gstin } : {}),
        ...(ws.billingName ? { business: ws.billingName } : {}),
      },
    });
    if (!sub.short_url) throw new HttpError(502, 'Razorpay did not return a payment link');
    // Razorpay's hosted page doesn't redirect back: the billing page opens it
    // in a new tab and confirms the subscription when the customer returns.
    return res.json({ url: sub.short_url, gateway, subscriptionId: sub.id, newTab: true });
  }
  const { subscription, approveUrl } = await createPaypalSubscription({
    planId,
    workspaceId,
    email: user.email,
    returnUrl: `${returnUrl}?checkout=success&gateway=PAYPAL`,
    cancelUrl: `${returnUrl}?checkout=canceled`,
  });
  res.json({ url: approveUrl, gateway, subscriptionId: subscription.id });
});

/**
 * Called by the billing page after a Razorpay or PayPal checkout, so the plan
 * goes live without waiting for the webhook. Only the workspace that started
 * the subscription can confirm it.
 */
billingRouter.post('/confirm', async (req, res) => {
  const { gateway, subscriptionId } = checkoutConfirmSchema.parse(req.body);
  const workspaceId = wsId(req);
  let result;
  if (gateway === 'RAZORPAY') {
    const sub = await fetchRazorpaySubscription(subscriptionId);
    if (razorpayWorkspaceId(sub) !== workspaceId) throw notFound('Subscription');
    result = await syncRazorpaySubscription(workspaceId, sub);
  } else {
    const sub = await fetchPaypalSubscription(subscriptionId);
    if (sub.custom_id !== workspaceId) throw notFound('Subscription');
    result = await syncPaypalSubscription(workspaceId, sub);
  }
  const entitlements = await getEntitlements(workspaceId);
  res.json({ result, active: result !== 'ignored' && entitlements.active });
});

billingRouter.post('/portal', async (req, res) => {
  const sub = await prisma.subscription.findUnique({ where: { workspaceId: wsId(req) } });
  if (!sub?.stripeCustomerId) throw badRequest('No billing account yet. Choose a plan first.');
  const portal = await createPortalSession(sub.stripeCustomerId, `${env.appUrl}/dashboard/billing`);
  res.json({ url: portal.url });
});

/** Stop renewing at period end. Stripe customers use the Stripe portal instead. */
billingRouter.post('/cancel', async (req, res) => {
  const workspaceId = wsId(req);
  const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (!sub) throw notFound('Subscription');
  if (sub.provider === 'STRIPE')
    throw badRequest('Manage your Stripe subscription from the billing portal');
  // The gateway first: if it fails, nothing claims the plan is ending. A
  // PayPal cancellation webhook keeps the paid period (syncPaypalSubscription).
  if (sub.provider === 'RAZORPAY' && sub.razorpaySubscriptionId) {
    await cancelRazorpaySubscription(sub.razorpaySubscriptionId, true);
  } else if (sub.provider === 'PAYPAL' && sub.paypalSubscriptionId) {
    await cancelPaypalSubscription(sub.paypalSubscriptionId, 'Cancelled from the billing page');
  }
  await applySubscriptionChange(workspaceId, { cancelAtPeriodEnd: true });
  await audit(req, 'billing.cancel_requested', { meta: { provider: sub.provider } });
  res.json({ ok: true });
});
