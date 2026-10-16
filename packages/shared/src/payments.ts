import { z } from 'zod';

/**
 * Payment gateways a subscriber can pay through. Super admins add each
 * gateway's keys in the admin panel (Super admin → Payment gateways); staff
 * never need a deploy to switch one on or off.
 */
export const PAYMENT_GATEWAYS = ['STRIPE', 'RAZORPAY', 'PAYPAL'] as const;
export type PaymentGateway = (typeof PAYMENT_GATEWAYS)[number];

export const PAYMENT_GATEWAY_LABELS: Record<PaymentGateway, string> = {
  STRIPE: 'Stripe',
  RAZORPAY: 'Razorpay',
  PAYPAL: 'PayPal',
};

/** What a subscriber sees on the pay button. */
export const PAYMENT_GATEWAY_METHODS: Record<PaymentGateway, string> = {
  STRIPE: 'Card, Apple Pay, Google Pay',
  RAZORPAY: 'UPI, RuPay and Indian cards (INR)',
  PAYPAL: 'PayPal balance or card',
};

export const GATEWAY_MODES = ['test', 'live'] as const;
export type GatewayMode = (typeof GATEWAY_MODES)[number];

const secret = z.string().trim().min(8).max(500);
const optionalSecret = secret.optional().or(z.literal('').transform(() => undefined));

/**
 * Saving a gateway. Secrets may be left blank on an update to keep the saved
 * ones (they're never sent back to the browser); the API insists on them the
 * first time.
 */
export const paymentGatewaySchema = z.discriminatedUnion('gateway', [
  z.object({
    gateway: z.literal('STRIPE'),
    enabled: z.boolean().default(true),
    /** sk_test_… / sk_live_… (or a restricted rk_ key). */
    secretKey: optionalSecret,
    /** whsec_… from the webhook endpoint. */
    webhookSecret: optionalSecret,
  }),
  z.object({
    gateway: z.literal('RAZORPAY'),
    enabled: z.boolean().default(true),
    keyId: z
      .string()
      .trim()
      .regex(
        /^rzp_(test|live)_[A-Za-z0-9]+$/,
        'Razorpay key ids start with rzp_test_ or rzp_live_',
      ),
    keySecret: optionalSecret,
    webhookSecret: optionalSecret,
  }),
  z.object({
    gateway: z.literal('PAYPAL'),
    enabled: z.boolean().default(true),
    mode: z.enum(GATEWAY_MODES),
    clientId: z.string().trim().min(8).max(200),
    clientSecret: optionalSecret,
    /** The id PayPal shows for the webhook (not a secret). */
    webhookId: z.string().trim().min(4).max(80),
  }),
]);
export type PaymentGatewayInput = z.infer<typeof paymentGatewaySchema>;

/** A gateway named in a URL (`/gateways/razorpay`), case-insensitive. */
export const paymentGatewayParamSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.enum(PAYMENT_GATEWAYS, { message: 'Unknown payment gateway' }));

/** Super admin → Payment gateways. Secrets are summarised, never returned. */
export interface PaymentGatewayView {
  gateway: PaymentGateway;
  configured: boolean;
  enabled: boolean;
  mode: GatewayMode | null;
  /** Razorpay key id or PayPal client id. */
  publicId: string | null;
  /** Last four characters of the secret key. */
  last4: string | null;
  hasWebhookSecret: boolean;
  webhookId: string | null;
  verifiedAt: string | null;
  /** Stripe only: keys come from STRIPE_* in the server environment. */
  fromEnv: boolean;
  /** Absolute URL to register with the gateway for webhooks. */
  webhookUrl: string;
  /** Webhook events to subscribe the endpoint to. */
  webhookEvents: string[];
  /** Plans that can be bought through this gateway (have its plan/price id). */
  plansReady: string[];
}

/** One way to pay, offered on the subscriber billing page. */
export interface CheckoutOption {
  gateway: PaymentGateway;
  label: string;
  methods: string;
  /** Plans with this gateway's price/plan id set. */
  planCodes: string[];
}
