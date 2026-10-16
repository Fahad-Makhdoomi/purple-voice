import crypto from 'node:crypto';
import { HttpError } from '../lib/http-error';
import { gatewayConfig } from './payment-gateways';

/**
 * A deliberately small Stripe client over the REST API: Purple Voice needs
 * Checkout, the billing portal, subscription reads and webhook verification,
 * nothing else. Keeping it to plain fetch avoids SDK type churn across
 * Stripe API versions; the fields read below are stable across them.
 */

const API = 'https://api.stripe.com/v1';

type FormValue =
  string | number | boolean | null | undefined | FormValue[] | { [k: string]: FormValue };

/** Stripe's bracket encoding: a[b][0][c]=d */
function toForm(value: Record<string, FormValue>): URLSearchParams {
  const out = new URLSearchParams();
  const walk = (prefix: string, v: FormValue) => {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach((item, i) => walk(`${prefix}[${i}]`, item));
    else if (typeof v === 'object')
      for (const [k, inner] of Object.entries(v)) walk(`${prefix}[${k}]`, inner);
    else out.append(prefix, String(v));
  };
  for (const [k, v] of Object.entries(value)) walk(k, v);
  return out;
}

async function stripe<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: Record<string, FormValue>,
): Promise<T> {
  const config = await gatewayConfig('STRIPE');
  if (!config) throw new HttpError(503, 'Billing is not configured', 'billing_unavailable');
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? toForm(body) : undefined,
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new HttpError(502, json.error?.message ?? 'Payment provider error', 'stripe_error');
  }
  return json;
}

export interface StripeSubscription {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_start?: number;
  current_period_end?: number;
  metadata?: Record<string, string>;
  items: {
    data: Array<{
      price: { id: string };
      current_period_start?: number;
      current_period_end?: number;
    }>;
  };
}

export interface StripeInvoice {
  id: string;
  customer: string;
  amount_paid: number;
  currency: string;
  status: string;
  period_start?: number;
  period_end?: number;
  status_transitions?: { paid_at?: number | null };
  lines?: { data: Array<{ period?: { start: number; end: number }; description?: string }> };
}

export interface StripeCheckoutSession {
  id: string;
  url: string;
  customer: string | null;
  subscription: string | null;
  client_reference_id: string | null;
  metadata?: Record<string, string>;
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: unknown };
}

export async function createCheckoutSession(input: {
  workspaceId: string;
  priceId: string;
  customerId?: string | null;
  email: string;
  successUrl: string;
  cancelUrl: string;
}) {
  return stripe<StripeCheckoutSession>('POST', '/checkout/sessions', {
    mode: 'subscription',
    client_reference_id: input.workspaceId,
    customer: input.customerId ?? undefined,
    customer_email: input.customerId ? undefined : input.email,
    line_items: [{ price: input.priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    metadata: { workspaceId: input.workspaceId },
    subscription_data: { metadata: { workspaceId: input.workspaceId } },
  });
}

export async function createPortalSession(customerId: string, returnUrl: string) {
  return stripe<{ url: string }>('POST', '/billing_portal/sessions', {
    customer: customerId,
    return_url: returnUrl,
  });
}

export async function retrieveSubscription(id: string) {
  return stripe<StripeSubscription>('GET', `/subscriptions/${encodeURIComponent(id)}`);
}

export async function updateSubscriptionPrice(sub: StripeSubscription, priceId: string) {
  const item = sub.items.data[0] as { id?: string } | undefined;
  return stripe<StripeSubscription>('POST', `/subscriptions/${encodeURIComponent(sub.id)}`, {
    items: [{ id: item?.id, price: priceId }],
    proration_behavior: 'create_prorations',
  });
}

/** Ends a subscription now (used when the workspace moved to another subscription). */
export async function cancelSubscription(id: string) {
  return stripe<StripeSubscription>('DELETE', `/subscriptions/${encodeURIComponent(id)}`);
}

/** Period bounds moved from the subscription onto its items in newer API versions. */
export function subscriptionPeriod(sub: StripeSubscription): {
  start: Date | null;
  end: Date | null;
} {
  const item = sub.items.data[0];
  const start = item?.current_period_start ?? sub.current_period_start;
  const end = item?.current_period_end ?? sub.current_period_end;
  return {
    start: start ? new Date(start * 1000) : null,
    end: end ? new Date(end * 1000) : null,
  };
}

/**
 * Verifies the Stripe-Signature header (t=…,v1=…) over the raw body and
 * returns the parsed event. Rejects signatures older than five minutes.
 */
export function verifyWebhook(
  rawBody: Buffer,
  header: string | undefined,
  secret: string | undefined,
): StripeEvent {
  if (!secret) throw new HttpError(503, 'Webhook secret not configured');
  if (!header) throw new HttpError(400, 'Missing Stripe-Signature');

  const parts = Object.fromEntries(
    header.split(',').map((kv) => {
      const [k, ...rest] = kv.split('=');
      return [k, rest.join('=')];
    }),
  );
  const signatures = header
    .split(',')
    .filter((kv) => kv.startsWith('v1='))
    .map((kv) => kv.slice(3));
  const timestamp = Number(parts.t);
  if (!timestamp || !signatures.length) throw new HttpError(400, 'Malformed Stripe-Signature');
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) throw new HttpError(400, 'Stale webhook');

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex');
  const ok = signatures.some(
    (sig) =>
      sig.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)),
  );
  if (!ok) throw new HttpError(400, 'Invalid webhook signature');
  return JSON.parse(rawBody.toString('utf8')) as StripeEvent;
}
