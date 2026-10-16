import crypto from 'node:crypto';
import type { SubscriptionStatus } from '@prisma/client';
import { HttpError } from '../lib/http-error';
import { gatewayConfig } from './payment-gateways';

/**
 * Razorpay Subscriptions over the REST API: Indian subscribers pay in INR by
 * UPI Autopay, RuPay or any other card. The customer authorises the mandate
 * on Razorpay's hosted page (the subscription's `short_url`); webhooks and
 * the billing page's confirm call keep the plan in sync.
 */

const API = 'https://api.razorpay.com/v1';

async function razorpay<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const config = await gatewayConfig('RAZORPAY');
  if (!config) throw new HttpError(503, 'Razorpay is not configured', 'billing_unavailable');
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) {
    throw new HttpError(502, json.error?.description ?? 'Razorpay error', 'razorpay_error');
  }
  return json;
}

export interface RazorpaySubscription {
  id: string;
  plan_id: string;
  status: string;
  current_start: number | null;
  current_end: number | null;
  short_url?: string;
  notes?: Record<string, string> | [];
}

export interface RazorpayPayment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description?: string | null;
  created_at: number;
}

export interface RazorpayWebhook {
  event: string;
  payload: {
    subscription?: { entity: RazorpaySubscription };
    payment?: { entity: RazorpayPayment };
  };
}

/** Razorpay's statuses → ours. `authenticated` is a mandate not yet charged. */
export const RAZORPAY_STATUS: Record<string, SubscriptionStatus> = {
  created: 'INCOMPLETE',
  authenticated: 'INCOMPLETE',
  active: 'ACTIVE',
  pending: 'PAST_DUE',
  halted: 'UNPAID',
  paused: 'UNPAID',
  cancelled: 'CANCELED',
  completed: 'CANCELED',
  expired: 'CANCELED',
};

/** `notes` is an object when set and an empty array when not. */
export function razorpayWorkspaceId(sub: RazorpaySubscription): string | undefined {
  return Array.isArray(sub.notes) ? undefined : sub.notes?.workspaceId;
}

export function razorpayPeriod(sub: RazorpaySubscription) {
  return {
    start: sub.current_start ? new Date(sub.current_start * 1000) : null,
    end: sub.current_end ? new Date(sub.current_end * 1000) : null,
  };
}

/** A monthly plan billed in rupees. */
export async function createRazorpayPlan(input: {
  name: string;
  amountPaise: number;
  description: string;
}) {
  return razorpay<{ id: string }>('POST', '/plans', {
    period: 'monthly',
    interval: 1,
    item: {
      name: input.name,
      amount: input.amountPaise,
      currency: 'INR',
      description: input.description,
    },
  });
}

/**
 * The customer the subscription bills, carrying the GSTIN so Razorpay's
 * invoices show it. Razorpay returns the existing customer for a known email.
 */
export async function upsertRazorpayCustomer(input: {
  name: string;
  email: string;
  gstin?: string | null;
}) {
  return razorpay<{ id: string }>('POST', '/customers', {
    name: input.name.slice(0, 50),
    email: input.email,
    ...(input.gstin ? { gstin: input.gstin } : {}),
    fail_existing: '0',
  });
}

export async function createRazorpaySubscription(input: {
  planId: string;
  workspaceId: string;
  customerId?: string;
  notes?: Record<string, string>;
}) {
  return razorpay<RazorpaySubscription>('POST', '/subscriptions', {
    plan_id: input.planId,
    // Razorpay requires an end; 120 monthly cycles is ten years.
    total_count: 120,
    quantity: 1,
    customer_notify: 1,
    ...(input.customerId ? { customer_id: input.customerId } : {}),
    notes: { ...input.notes, workspaceId: input.workspaceId },
  });
}

export async function fetchRazorpaySubscription(id: string) {
  return razorpay<RazorpaySubscription>('GET', `/subscriptions/${encodeURIComponent(id)}`);
}

/** At cycle end the customer keeps what they paid for; otherwise it ends now. */
export async function cancelRazorpaySubscription(id: string, atCycleEnd: boolean) {
  return razorpay<RazorpaySubscription>('POST', `/subscriptions/${encodeURIComponent(id)}/cancel`, {
    cancel_at_cycle_end: atCycleEnd ? 1 : 0,
  });
}

/** X-Razorpay-Signature is hex HMAC-SHA256 of the raw body with the webhook secret. */
export function verifyRazorpayWebhook(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string | undefined,
): RazorpayWebhook {
  if (!secret) throw new HttpError(503, 'Webhook secret not configured');
  if (!signature) throw new HttpError(400, 'Missing X-Razorpay-Signature');
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const ok =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!ok) throw new HttpError(400, 'Invalid webhook signature');
  return JSON.parse(rawBody.toString('utf8')) as RazorpayWebhook;
}
