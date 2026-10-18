import type { PaymentGatewayConfig } from '@prisma/client';
import {
  PAYMENT_GATEWAYS,
  PAYMENT_GATEWAY_LABELS,
  PAYMENT_GATEWAY_METHODS,
  type CheckoutOption,
  type GatewayMode,
  type PaymentGateway,
  type PaymentGatewayInput,
  type PaymentGatewayView,
} from '@pv/shared';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { decrypt, encrypt, last4 } from '../lib/crypto';
import { badRequest } from '../lib/http-error';
import { razorpayCanSell } from './razorpay-plans';

/**
 * Payment gateway credentials. A super admin saves them in the admin panel
 * (Super admin → Payment gateways); they're verified with the gateway, then
 * encrypted. Stripe also keeps working from STRIPE_* in api.env, which a
 * saved Stripe row overrides.
 */

export interface StripeConfig {
  secretKey: string;
  webhookSecret?: string;
}
export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}
export interface PaypalConfig {
  mode: GatewayMode;
  clientId: string;
  clientSecret: string;
  webhookId?: string;
}
interface Configs {
  STRIPE: StripeConfig;
  RAZORPAY: RazorpayConfig;
  PAYPAL: PaypalConfig;
}

function fromRow<G extends PaymentGateway>(gateway: G, row: PaymentGatewayConfig): Configs[G] {
  const secret = decrypt(row.secretEnc);
  const webhookSecret = row.webhookSecretEnc ? decrypt(row.webhookSecretEnc) : undefined;
  const byGateway: { [K in PaymentGateway]: () => Configs[K] } = {
    STRIPE: () => ({ secretKey: secret, webhookSecret }),
    RAZORPAY: () => ({ keyId: row.publicId ?? '', keySecret: secret, webhookSecret }),
    PAYPAL: () => ({
      mode: row.mode === 'live' ? 'live' : 'test',
      clientId: row.publicId ?? '',
      clientSecret: secret,
      webhookId: row.webhookId ?? undefined,
    }),
  };
  return byGateway[gateway]() as Configs[G];
}

/** The gateway's credentials if it's set up and switched on, else null. */
export async function gatewayConfig<G extends PaymentGateway>(
  gateway: G,
): Promise<Configs[G] | null> {
  const row = await prisma.paymentGatewayConfig.findUnique({ where: { gateway } });
  if (row) return row.enabled ? fromRow(gateway, row) : null;
  if (gateway === 'STRIPE' && env.STRIPE_SECRET_KEY) {
    return {
      secretKey: env.STRIPE_SECRET_KEY,
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    } as Configs[G];
  }
  return null;
}

/** Plan ids each gateway sells, from Admin → Plans & pricing (Stripe also from env). */
function planIdFor(
  gateway: PaymentGateway,
  plan: {
    code: string;
    stripePriceId: string | null;
    razorpayPlanId: string | null;
    paypalPlanId: string | null;
  },
): string | null {
  if (gateway === 'RAZORPAY') return plan.razorpayPlanId;
  if (gateway === 'PAYPAL') return plan.paypalPlanId;
  return (
    plan.stripePriceId ??
    (plan.code === 'BASIC'
      ? env.STRIPE_PRICE_BASIC
      : plan.code === 'PRO'
        ? env.STRIPE_PRICE_PRO
        : undefined) ??
    null
  );
}

/** Razorpay plans are created in INR when first needed (razorpay-plans.ts). */
function canSell(
  gateway: PaymentGateway,
  plan: Parameters<typeof planIdFor>[1] & Parameters<typeof razorpayCanSell>[0],
) {
  return gateway === 'RAZORPAY' ? razorpayCanSell(plan) : !!planIdFor(gateway, plan);
}

export async function gatewayPlanId(
  gateway: PaymentGateway,
  planCode: string,
): Promise<string | null> {
  const plan = await prisma.plan.findFirst({ where: { code: planCode as never } });
  return plan ? planIdFor(gateway, plan) : null;
}

/** The plan a gateway's price/plan id belongs to. */
export async function planCodeForGatewayId(gateway: PaymentGateway, id: string) {
  const plans = await prisma.plan.findMany();
  return plans.find((p) => planIdFor(gateway, p) === id)?.code;
}

/** Ways to pay a subscriber is offered: enabled gateways with at least one self-serve plan priced. */
export async function checkoutOptions(): Promise<CheckoutOption[]> {
  const [rows, plans] = await Promise.all([
    prisma.paymentGatewayConfig.findMany(),
    prisma.plan.findMany({
      where: { active: true, selfServe: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);
  const enabled = PAYMENT_GATEWAYS.filter((g) => {
    const row = rows.find((r) => r.gateway === g);
    return row ? row.enabled : g === 'STRIPE' && !!env.STRIPE_SECRET_KEY;
  });
  return enabled
    .map((gateway) => ({
      gateway,
      label: PAYMENT_GATEWAY_LABELS[gateway],
      methods: PAYMENT_GATEWAY_METHODS[gateway],
      planCodes: plans.filter((p) => canSell(gateway, p)).map((p) => p.code),
    }))
    .filter((o) => o.planCodes.length > 0);
}

/** True when any gateway is switched on, priced or not (disables the dev billing bypass). */
export async function anyGatewayEnabled(): Promise<boolean> {
  if (await prisma.paymentGatewayConfig.count({ where: { enabled: true } })) return true;
  if (!env.STRIPE_SECRET_KEY) return false;
  // A saved-but-disabled Stripe row switches the env keys off too.
  return !(await prisma.paymentGatewayConfig.findUnique({ where: { gateway: 'STRIPE' } }));
}

// ── Super admin view and saving ─────────────────────────────────────────────

export const WEBHOOK_PATHS: Record<PaymentGateway, string> = {
  STRIPE: '/api/billing/webhook',
  RAZORPAY: '/api/billing/webhook/razorpay',
  PAYPAL: '/api/billing/webhook/paypal',
};

export const WEBHOOK_EVENTS: Record<PaymentGateway, string[]> = {
  STRIPE: [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.paid',
  ],
  RAZORPAY: [
    'subscription.authenticated',
    'subscription.activated',
    'subscription.charged',
    'subscription.pending',
    'subscription.halted',
    'subscription.cancelled',
    'subscription.completed',
    'subscription.paused',
    'subscription.resumed',
    'subscription.updated',
  ],
  PAYPAL: [
    'BILLING.SUBSCRIPTION.ACTIVATED',
    'BILLING.SUBSCRIPTION.UPDATED',
    'BILLING.SUBSCRIPTION.RE-ACTIVATED',
    'BILLING.SUBSCRIPTION.SUSPENDED',
    'BILLING.SUBSCRIPTION.CANCELLED',
    'BILLING.SUBSCRIPTION.EXPIRED',
    'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
    'PAYMENT.SALE.COMPLETED',
  ],
};

export async function paymentGatewayViews(): Promise<PaymentGatewayView[]> {
  const [rows, plans] = await Promise.all([
    prisma.paymentGatewayConfig.findMany(),
    prisma.plan.findMany({
      where: { selfServe: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);
  return PAYMENT_GATEWAYS.map((gateway) => {
    const row = rows.find((r) => r.gateway === gateway);
    const fromEnv = !row && gateway === 'STRIPE' && !!env.STRIPE_SECRET_KEY;
    return {
      gateway,
      configured: !!row || fromEnv,
      enabled: row ? row.enabled : fromEnv,
      mode: row
        ? (row.mode as GatewayMode)
        : fromEnv
          ? env.STRIPE_SECRET_KEY!.includes('_live_')
            ? 'live'
            : 'test'
          : null,
      publicId: row?.publicId ?? null,
      last4: row?.last4 ?? (fromEnv ? last4(env.STRIPE_SECRET_KEY!) : null),
      hasWebhookSecret: row ? !!row.webhookSecretEnc : fromEnv && !!env.STRIPE_WEBHOOK_SECRET,
      webhookId: row?.webhookId ?? null,
      verifiedAt: row?.verifiedAt?.toISOString() ?? null,
      fromEnv,
      webhookUrl: `${env.publicApiUrl}${WEBHOOK_PATHS[gateway]}`,
      webhookEvents: WEBHOOK_EVENTS[gateway],
      plansReady: plans.filter((p) => canSell(gateway, p)).map((p) => p.code),
    };
  });
}

const GATEWAY_HOSTS = {
  stripe: 'https://api.stripe.com/v1',
  razorpay: 'https://api.razorpay.com/v1',
  paypal: { test: 'https://api-m.sandbox.paypal.com', live: 'https://api-m.paypal.com' },
};

export function paypalBase(mode: GatewayMode): string {
  return GATEWAY_HOSTS.paypal[mode];
}

function basic(user: string, pass: string) {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

/** One cheap authenticated request per gateway, so a typo is caught on save. */
async function verify(
  input: Required<Pick<PaymentGatewayInput, 'gateway'>> & {
    secret: string;
    publicId?: string;
    mode?: GatewayMode;
  },
) {
  const label = PAYMENT_GATEWAY_LABELS[input.gateway];
  let res: Response;
  try {
    if (input.gateway === 'STRIPE') {
      res = await fetch(`${GATEWAY_HOSTS.stripe}/prices?limit=1`, {
        headers: { Authorization: `Bearer ${input.secret}` },
        signal: AbortSignal.timeout(10_000),
      });
    } else if (input.gateway === 'RAZORPAY') {
      res = await fetch(`${GATEWAY_HOSTS.razorpay}/plans?count=1`, {
        headers: { Authorization: basic(input.publicId!, input.secret) },
        signal: AbortSignal.timeout(10_000),
      });
    } else {
      res = await fetch(`${paypalBase(input.mode!)}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: basic(input.publicId!, input.secret),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(10_000),
      });
    }
  } catch (err) {
    throw badRequest(`Couldn't reach ${label} (${(err as Error).message}). Try again.`);
  }
  if (!res.ok) {
    throw badRequest(
      `${label} rejected those credentials (HTTP ${res.status}). Check them${
        input.gateway === 'PAYPAL' ? ' and the sandbox/live setting' : ''
      } and try again.`,
    );
  }
}

/**
 * Verifies and saves a gateway. Blank secrets keep the saved ones, so staff
 * can flip `enabled` or rotate one value without re-entering the rest.
 */
export async function saveGateway(input: PaymentGatewayInput) {
  const existing = await prisma.paymentGatewayConfig.findUnique({
    where: { gateway: input.gateway },
  });
  const keep = (enc: string | null | undefined) => (enc ? decrypt(enc) : undefined);

  let secret: string | undefined;
  let webhookSecret: string | undefined;
  let publicId: string | null = null;
  let webhookId: string | null = null;
  let mode: GatewayMode;

  if (input.gateway === 'STRIPE') {
    secret = input.secretKey ?? keep(existing?.secretEnc) ?? env.STRIPE_SECRET_KEY;
    webhookSecret =
      input.webhookSecret ?? keep(existing?.webhookSecretEnc) ?? env.STRIPE_WEBHOOK_SECRET;
    if (secret && !/^(sk|rk)_(test|live)_/.test(secret))
      throw badRequest('Stripe secret keys start with sk_test_, sk_live_ or rk_');
    if (webhookSecret && !webhookSecret.startsWith('whsec_'))
      throw badRequest('Stripe webhook signing secrets start with whsec_');
    mode = secret?.includes('_live_') ? 'live' : 'test';
  } else if (input.gateway === 'RAZORPAY') {
    // A new key id needs its own secret.
    const sameKey = existing?.publicId === input.keyId;
    secret = input.keySecret ?? (sameKey ? keep(existing?.secretEnc) : undefined);
    webhookSecret = input.webhookSecret ?? keep(existing?.webhookSecretEnc);
    publicId = input.keyId;
    mode = input.keyId.startsWith('rzp_live_') ? 'live' : 'test';
  } else {
    const sameClient = existing?.publicId === input.clientId && existing?.mode === input.mode;
    secret = input.clientSecret ?? (sameClient ? keep(existing?.secretEnc) : undefined);
    publicId = input.clientId;
    webhookId = input.webhookId;
    mode = input.mode;
  }

  if (!secret) throw badRequest(`Enter the ${PAYMENT_GATEWAY_LABELS[input.gateway]} secret key`);
  if (input.gateway !== 'PAYPAL' && !webhookSecret)
    throw badRequest('Enter the webhook signing secret, or payments will never activate plans');

  await verify({ gateway: input.gateway, secret, publicId: publicId ?? undefined, mode });

  const data = {
    enabled: input.enabled,
    mode,
    publicId,
    secretEnc: encrypt(secret),
    webhookSecretEnc: webhookSecret ? encrypt(webhookSecret) : null,
    webhookId,
    last4: last4(secret),
    verifiedAt: new Date(),
  };
  await prisma.paymentGatewayConfig.upsert({
    where: { gateway: input.gateway },
    create: { gateway: input.gateway, ...data },
    update: data,
  });
}
