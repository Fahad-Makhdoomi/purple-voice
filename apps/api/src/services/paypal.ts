import type { SubscriptionStatus } from '@prisma/client';
import { HttpError } from '../lib/http-error';
import { gatewayConfig, paypalBase, type PaypalConfig } from './payment-gateways';

/**
 * PayPal Subscriptions over the REST API. The subscriber approves on PayPal
 * and comes back to the billing page, which confirms the subscription
 * straight away; webhooks (verified by PayPal's own API) keep it in sync.
 */

let token: { key: string; value: string; expiresAt: number } | null = null;

async function accessToken(config: PaypalConfig): Promise<string> {
  const key = `${config.mode}:${config.clientId}:${config.clientSecret}`;
  if (token && token.key === key && token.expiresAt > Date.now() + 60_000) return token.value;
  const res = await fetch(`${paypalBase(config.mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new HttpError(502, 'PayPal rejected the platform credentials', 'paypal_error');
  const json = (await res.json()) as { access_token: string; expires_in: number };
  token = { key, value: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return token.value;
}

async function paypal<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<{ data: T; config: PaypalConfig }> {
  const config = await gatewayConfig('PAYPAL');
  if (!config) throw new HttpError(503, 'PayPal is not configured', 'billing_unavailable');
  const res = await fetch(`${paypalBase(config.mode)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken(config)}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  const json = (text ? JSON.parse(text) : {}) as T & { message?: string };
  if (!res.ok) throw new HttpError(502, json.message ?? 'PayPal error', 'paypal_error');
  return { data: json, config };
}

export interface PaypalSubscription {
  id: string;
  plan_id: string;
  status: string;
  custom_id?: string;
  start_time?: string;
  billing_info?: {
    next_billing_time?: string;
    last_payment?: { time?: string };
  };
  links?: Array<{ href: string; rel: string }>;
}

export interface PaypalSale {
  id: string;
  state?: string;
  amount: { total: string; currency: string };
  billing_agreement_id?: string;
  create_time?: string;
}

export interface PaypalEvent {
  id: string;
  event_type: string;
  resource: unknown;
}

export const PAYPAL_STATUS: Record<string, SubscriptionStatus> = {
  APPROVAL_PENDING: 'INCOMPLETE',
  APPROVED: 'INCOMPLETE',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'UNPAID',
  CANCELLED: 'CANCELED',
  EXPIRED: 'CANCELED',
};

export function paypalPeriod(sub: PaypalSubscription) {
  const start = sub.billing_info?.last_payment?.time ?? sub.start_time;
  const end = sub.billing_info?.next_billing_time;
  return { start: start ? new Date(start) : null, end: end ? new Date(end) : null };
}

export async function createPaypalSubscription(input: {
  planId: string;
  workspaceId: string;
  email: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const { data } = await paypal<PaypalSubscription>('POST', '/v1/billing/subscriptions', {
    plan_id: input.planId,
    custom_id: input.workspaceId,
    subscriber: { email_address: input.email },
    application_context: {
      brand_name: 'Purple Voice',
      user_action: 'SUBSCRIBE_NOW',
      shipping_preference: 'NO_SHIPPING',
      return_url: input.returnUrl,
      cancel_url: input.cancelUrl,
    },
  });
  const approve = data.links?.find((l) => l.rel === 'approve')?.href;
  if (!approve) throw new HttpError(502, 'PayPal did not return an approval link', 'paypal_error');
  return { subscription: data, approveUrl: approve };
}

export async function fetchPaypalSubscription(id: string) {
  const { data } = await paypal<PaypalSubscription>(
    'GET',
    `/v1/billing/subscriptions/${encodeURIComponent(id)}`,
  );
  return data;
}

/** PayPal has no "at period end": billing stops now; we keep access until the paid period ends. */
export async function cancelPaypalSubscription(id: string, reason: string) {
  await paypal('POST', `/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, { reason });
}

/** Asks PayPal whether a webhook delivery is genuine (PayPal's recommended check). */
export async function verifyPaypalWebhook(
  headers: Record<string, string | undefined>,
  rawBody: Buffer,
): Promise<PaypalEvent> {
  const config = await gatewayConfig('PAYPAL');
  if (!config?.webhookId) throw new HttpError(503, 'PayPal webhook not configured');
  const event = JSON.parse(rawBody.toString('utf8')) as PaypalEvent;
  const required = [
    'paypal-auth-algo',
    'paypal-cert-url',
    'paypal-transmission-id',
    'paypal-transmission-sig',
    'paypal-transmission-time',
  ];
  if (required.some((h) => !headers[h])) throw new HttpError(400, 'Missing PayPal signature');
  const { data } = await paypal<{ verification_status: string }>(
    'POST',
    '/v1/notifications/verify-webhook-signature',
    {
      auth_algo: headers['paypal-auth-algo'],
      cert_url: headers['paypal-cert-url'],
      transmission_id: headers['paypal-transmission-id'],
      transmission_sig: headers['paypal-transmission-sig'],
      transmission_time: headers['paypal-transmission-time'],
      webhook_id: config.webhookId,
      webhook_event: event,
    },
  );
  if (data.verification_status !== 'SUCCESS') throw new HttpError(400, 'Invalid webhook signature');
  return event;
}
