import { beforeEach, describe, expect, it, vi } from 'vitest';
import crypto from 'node:crypto';
import { paymentGatewaySchema } from '@pv/shared';
// vi.mock calls below are hoisted above these imports.
import { syncGatewaySubscription } from '../src/services/billing-sync';
import {
  RAZORPAY_STATUS,
  razorpayWorkspaceId,
  verifyRazorpayWebhook,
} from '../src/services/razorpay';

const { findUnique, applySubscriptionChange, cancelStripe, cancelRazorpay, cancelPaypal } =
  vi.hoisted(() => ({
    findUnique: vi.fn(),
    applySubscriptionChange: vi.fn(),
    cancelStripe: vi.fn(),
    cancelRazorpay: vi.fn(),
    cancelPaypal: vi.fn(),
  }));

vi.mock('../src/lib/prisma', () => ({ prisma: { subscription: { findUnique } } }));
vi.mock('../src/services/subscriptions', () => ({ applySubscriptionChange }));
vi.mock('../src/services/stripe', () => ({ cancelSubscription: cancelStripe }));
vi.mock('../src/services/paypal', () => ({ cancelPaypalSubscription: cancelPaypal }));
vi.mock('../src/services/razorpay', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  cancelRazorpaySubscription: cancelRazorpay,
}));

const period = { currentPeriodStart: new Date(), currentPeriodEnd: new Date(Date.now() + 1e9) };
const row = (over: object) => ({
  provider: 'MANUAL',
  status: 'ACTIVE',
  stripeSubscriptionId: null,
  razorpaySubscriptionId: null,
  paypalSubscriptionId: null,
  ...over,
});

describe('gateway subscription sync', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies updates to the current subscription', async () => {
    findUnique.mockResolvedValue(row({ provider: 'RAZORPAY', razorpaySubscriptionId: 'sub_1' }));
    const r = await syncGatewaySubscription('ws', {
      gateway: 'RAZORPAY',
      subscriptionId: 'sub_1',
      status: 'PAST_DUE',
      ...period,
    });
    expect(r).toBe('applied');
    expect(applySubscriptionChange).toHaveBeenCalledWith(
      'ws',
      expect.objectContaining({ status: 'PAST_DUE', razorpaySubscriptionId: 'sub_1' }),
    );
    expect(cancelRazorpay).not.toHaveBeenCalled();
  });

  it("ignores a superseded subscription's cancellation", async () => {
    findUnique.mockResolvedValue(row({ provider: 'PAYPAL', paypalSubscriptionId: 'I-NEW' }));
    const r = await syncGatewaySubscription('ws', {
      gateway: 'STRIPE',
      subscriptionId: 'sub_old',
      status: 'CANCELED',
      ...period,
    });
    expect(r).toBe('ignored');
    expect(applySubscriptionChange).not.toHaveBeenCalled();
  });

  it('ignores an abandoned checkout', async () => {
    findUnique.mockResolvedValue(null);
    const r = await syncGatewaySubscription('ws', {
      gateway: 'RAZORPAY',
      subscriptionId: 'sub_new',
      status: 'INCOMPLETE',
      ...period,
    });
    expect(r).toBe('ignored');
  });

  it('lets a paid subscription take over and cancels the one it replaced', async () => {
    findUnique.mockResolvedValue(row({ provider: 'STRIPE', stripeSubscriptionId: 'sub_stripe' }));
    const r = await syncGatewaySubscription('ws', {
      gateway: 'RAZORPAY',
      subscriptionId: 'sub_rzp',
      status: 'ACTIVE',
      ...period,
    });
    expect(r).toBe('took_over');
    expect(applySubscriptionChange).toHaveBeenCalledWith(
      'ws',
      expect.objectContaining({
        provider: 'RAZORPAY',
        razorpaySubscriptionId: 'sub_rzp',
        cancelAtPeriodEnd: false,
      }),
    );
    expect(cancelStripe).toHaveBeenCalledWith('sub_stripe');
  });

  it('does not cancel anything when replacing a manual plan', async () => {
    findUnique.mockResolvedValue(row({ provider: 'MANUAL' }));
    await syncGatewaySubscription('ws', {
      gateway: 'PAYPAL',
      subscriptionId: 'I-1',
      status: 'ACTIVE',
      ...period,
    });
    expect(cancelStripe).not.toHaveBeenCalled();
    expect(cancelRazorpay).not.toHaveBeenCalled();
    expect(cancelPaypal).not.toHaveBeenCalled();
  });

  it('still succeeds when the old subscription cannot be cancelled', async () => {
    findUnique.mockResolvedValue(row({ provider: 'PAYPAL', paypalSubscriptionId: 'I-OLD' }));
    cancelPaypal.mockRejectedValueOnce(new Error('PayPal down'));
    await expect(
      syncGatewaySubscription('ws', {
        gateway: 'PAYPAL',
        subscriptionId: 'I-NEW',
        status: 'ACTIVE',
        ...period,
      }),
    ).resolves.toBe('took_over');
  });
});

describe('Razorpay', () => {
  it('accepts correctly signed webhooks and rejects the rest', () => {
    const body = Buffer.from(JSON.stringify({ event: 'subscription.activated', payload: {} }));
    const sig = crypto.createHmac('sha256', 'rzp_whsec').update(body).digest('hex');
    expect(verifyRazorpayWebhook(body, sig, 'rzp_whsec').event).toBe('subscription.activated');
    expect(() => verifyRazorpayWebhook(body, undefined, 'rzp_whsec')).toThrow();
    expect(() => verifyRazorpayWebhook(body, '0'.repeat(64), 'rzp_whsec')).toThrow();
    expect(() => verifyRazorpayWebhook(body, sig, undefined)).toThrow();
  });

  it('only unlocks the plan once the mandate is charged', () => {
    expect(RAZORPAY_STATUS.authenticated).toBe('INCOMPLETE');
    expect(RAZORPAY_STATUS.active).toBe('ACTIVE');
    expect(RAZORPAY_STATUS.halted).toBe('UNPAID');
    expect(RAZORPAY_STATUS.cancelled).toBe('CANCELED');
  });

  it('reads the workspace from notes, which is [] when empty', () => {
    const base = {
      id: 's',
      plan_id: 'p',
      status: 'active',
      current_start: null,
      current_end: null,
    };
    expect(razorpayWorkspaceId({ ...base, notes: { workspaceId: 'ws1' } })).toBe('ws1');
    expect(razorpayWorkspaceId({ ...base, notes: [] })).toBeUndefined();
  });
});

describe('gateway settings validation', () => {
  it('checks Razorpay key ids and PayPal modes', () => {
    expect(
      paymentGatewaySchema.safeParse({ gateway: 'RAZORPAY', keyId: 'rzp_test_abc123' }).success,
    ).toBe(true);
    expect(paymentGatewaySchema.safeParse({ gateway: 'RAZORPAY', keyId: 'abc' }).success).toBe(
      false,
    );
    expect(
      paymentGatewaySchema.safeParse({
        gateway: 'PAYPAL',
        mode: 'sandbox',
        clientId: 'client-id-123',
        webhookId: 'WH-1',
      }).success,
    ).toBe(false);
  });

  it('treats blank secrets as "keep the saved one"', () => {
    const parsed = paymentGatewaySchema.parse({
      gateway: 'STRIPE',
      secretKey: '',
      webhookSecret: '',
    });
    expect(parsed).toMatchObject({ gateway: 'STRIPE', enabled: true });
    expect('secretKey' in parsed && parsed.secretKey).toBeFalsy();
  });
});
