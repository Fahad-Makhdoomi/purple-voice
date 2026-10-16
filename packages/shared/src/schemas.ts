import { z } from 'zod';
import {
  AGENT_STATUSES,
  AI_PROVIDERS,
  CALL_OUTCOMES,
  CONTENT_STATUSES,
  CREDENTIAL_PROVIDERS,
  INTEGRATION_TYPES,
  SUBSCRIPTION_STATUSES,
  TELEPHONY_PROVIDERS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  VOICE_ENGINES,
  WEBHOOK_EVENTS,
  MIN_CALL_DELAY_SECONDS,
  NOISE_FILTERS,
} from './enums';
import { PLAN_CODES } from './plans';
import { PAYMENT_GATEWAYS } from './payments';

const ROLES_FOR_STAFF = ['ADMIN', 'SUPER_ADMIN'] as const;

/**
 * One schema per request body. The API validates with these; the web app
 * uses the inferred types for its forms so both ends agree on the contract.
 */

const e164 = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, 'Use international format, e.g. +14155550123');

const email = z.string().trim().toLowerCase().email().max(254);
const password = z
  .string()
  .min(10, 'At least 10 characters')
  .max(200)
  .regex(/[A-Za-z]/, 'Include a letter')
  .regex(/\d/, 'Include a number');

const slug = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Lowercase letters, numbers and hyphens');

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24h HH:MM');

// ── Auth ────────────────────────────────────────────────────────────────────

/** Present when the form is captcha-protected; verified server-side. */
const captchaToken = z.string().max(4000).optional();

export const registerSchema = z.object({
  captchaToken,
  name: z.string().trim().min(2).max(120),
  email,
  password,
  company: z.string().trim().max(160).optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  captchaToken,
  email,
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({ email, captchaToken });
export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password,
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  company: z.string().trim().max(160).optional(),
  timezone: z.string().trim().max(64).optional(),
});

export const changePasswordSchema = z.object({
  /** Required by the API unless the account has never had a password (created with Google). */
  currentPassword: z.string().min(1).max(200).optional(),
  newPassword: password,
});

// ── Credentials & telephony ────────────────────────────────────────────────

export const aiCredentialSchema = z.object({
  provider: z.enum(CREDENTIAL_PROVIDERS),
  apiKey: z.string().trim().min(8).max(500),
  label: z.string().trim().max(80).optional(),
});
export type AiCredentialInput = z.infer<typeof aiCredentialSchema>;

/** A vendor named in a URL (`/keys/openai`), case-insensitive. */
export const credentialProviderParamSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .pipe(z.enum(CREDENTIAL_PROVIDERS, { message: 'Unknown provider' }));

/**
 * A subscriber's AI layer, set by staff only. Also the shape of the platform
 * default (Super admin → AI providers) that workspaces without their own
 * settings use. `model` is the realtime/live model for speech-to-speech
 * engines, or the LLM for CASCADED.
 */
export const aiSettingsSchema = z.object({
  voiceEngine: z.enum(VOICE_ENGINES),
  llmProvider: z.enum(AI_PROVIDERS).default('OPENAI'),
  model: z
    .string()
    .trim()
    .min(2)
    .max(100)
    .regex(/^[\w.:/-]+$/, 'Model ids contain only letters, digits and . : / - _'),
});
export type AiSettingsInput = z.infer<typeof aiSettingsSchema>;

export const telephonyAccountSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('TWILIO'),
    label: z.string().trim().max(80).optional(),
    accountSid: z
      .string()
      .trim()
      .regex(/^AC[0-9a-fA-F]{32}$/, 'Twilio Account SID starts with AC'),
    authToken: z.string().trim().min(16).max(200),
  }),
  z.object({
    provider: z.literal('PLIVO'),
    label: z.string().trim().max(80).optional(),
    authId: z.string().trim().min(10).max(64),
    authToken: z.string().trim().min(16).max(200),
  }),
  z.object({
    provider: z.literal('SUPERPHONE'),
    label: z.string().trim().max(80).optional(),
    apiKey: z.string().trim().min(8).max(500),
    sipDomain: z.string().trim().max(255).optional(),
  }),
]);
export type TelephonyAccountInput = z.infer<typeof telephonyAccountSchema>;

export const connectNumberSchema = z.object({
  telephonyAccountId: z.string().min(1),
  e164,
  providerNumberId: z.string().trim().max(120).optional(),
  friendlyName: z.string().trim().max(80).optional(),
  inboundAgentId: z.string().nullable().optional(),
});
export type ConnectNumberInput = z.infer<typeof connectNumberSchema>;

export const updateNumberSchema = z.object({
  friendlyName: z.string().trim().max(80).optional(),
  inboundAgentId: z.string().nullable().optional(),
});

// ── Agents ──────────────────────────────────────────────────────────────────

export const agentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  status: z.enum(AGENT_STATUSES).default('DRAFT'),
  /** One of the voices of the workspace's engine (staff choose the engine). */
  voice: z.string().trim().min(2).max(100),
  language: z.string().trim().min(2).max(16).default('en-US'),
  /** Who the agent is and how it should talk. */
  systemPrompt: z.string().trim().min(20).max(20000),
  /** First sentence spoken when the call connects. */
  greeting: z.string().trim().max(500).default(''),
  /** What counts as success on this call, e.g. "book a demo". */
  goal: z.string().trim().max(1000).default(''),
  /** Product facts, pricing, objection handling. */
  knowledge: z.string().max(50000).default(''),
  transferEnabled: z.boolean().default(false),
  transferNumber: e164.nullable().optional(),
  appointmentBookingEnabled: z.boolean().default(false),
  calendarIntegrationId: z.string().nullable().optional(),
  appointmentDurationMin: z.number().int().min(10).max(240).default(30),
  timezone: z.string().trim().max(64).default('UTC'),
  maxCallDurationSec: z.number().int().min(60).max(3600).default(900),
  recordCalls: z.boolean().default(false),
  /** Inbound calls to the agent's numbers: first sentence and how to handle them. */
  inboundGreeting: z.string().trim().max(500).default(''),
  inboundInstructions: z.string().trim().max(10000).default(''),
  /** Someone the agent called earlier calls back. */
  callbackGreeting: z.string().trim().max(500).default(''),
  callbackInstructions: z.string().trim().max(10000).default(''),
  noiseFilter: z.enum(NOISE_FILTERS).default('STANDARD'),
});
export type AgentInput = z.infer<typeof agentSchema>;
export const updateAgentSchema = agentSchema.partial();

export const testCallSchema = z.object({
  to: e164,
  phoneNumberId: z.string().min(1),
});

// ── Campaigns ───────────────────────────────────────────────────────────────

const callDelay = z
  .number()
  .int()
  .min(MIN_CALL_DELAY_SECONDS, `Wait at least ${MIN_CALL_DELAY_SECONDS} seconds between calls`)
  .max(3600);

export const campaignSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    agentId: z.string().min(1),
    phoneNumberId: z.string().min(1),
    goal: z.string().trim().max(1000).default(''),
    timezone: z.string().trim().max(64).default('UTC'),
    callWindowStart: hhmm.default('09:00'),
    callWindowEnd: hhmm.default('18:00'),
    /** 0 = Sunday … 6 = Saturday. */
    callDays: z.array(z.number().int().min(0).max(6)).min(1).default([1, 2, 3, 4, 5]),
    maxAttempts: z.number().int().min(1).max(5).default(2),
    retryDelayMinutes: z.number().int().min(5).max(10080).default(240),
    concurrency: z.number().int().min(1).max(50).default(1),
    /** Pause between calls; at least 20 seconds. */
    callDelaySeconds: callDelay.default(MIN_CALL_DELAY_SECONDS),
  })
  .refine((v) => v.callWindowStart < v.callWindowEnd, {
    message: 'Call window must end after it starts',
    path: ['callWindowEnd'],
  });
export type CampaignInput = z.infer<typeof campaignSchema>;
export const updateCampaignSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  agentId: z.string().min(1).optional(),
  phoneNumberId: z.string().min(1).optional(),
  goal: z.string().trim().max(1000).optional(),
  timezone: z.string().trim().max(64).optional(),
  callWindowStart: hhmm.optional(),
  callWindowEnd: hhmm.optional(),
  callDays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  maxAttempts: z.number().int().min(1).max(5).optional(),
  retryDelayMinutes: z.number().int().min(5).max(10080).optional(),
  concurrency: z.number().int().min(1).max(50).optional(),
  callDelaySeconds: callDelay.optional(),
});

export const contactSchema = z.object({
  phone: e164,
  name: z.string().trim().max(160).optional(),
  email: z.string().trim().toLowerCase().email().max(254).optional().or(z.literal('')),
  company: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const addContactsSchema = z.object({
  contacts: z.array(z.record(z.string(), z.unknown())).max(50000).optional(),
  /** Raw CSV with a header row containing at least `phone`. */
  csv: z.string().max(5_000_000).optional(),
});

// ── Calls & appointments ───────────────────────────────────────────────────

export const callFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  agentId: z.string().optional(),
  campaignId: z.string().optional(),
  direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
  outcome: z.enum(CALL_OUTCOMES).optional(),
  q: z.string().trim().max(100).optional(),
});

export const updateAppointmentSchema = z.object({
  status: z.enum(['SCHEDULED', 'CANCELED', 'COMPLETED', 'NO_SHOW']).optional(),
  notes: z.string().max(2000).optional(),
});

// ── Integrations, webhooks, API keys, automations ──────────────────────────

export const integrationSchema = z.object({
  type: z.enum(INTEGRATION_TYPES),
  /** Webhook URL (Slack/Zapier) or API token (HubSpot/Calendly). */
  secret: z.string().trim().min(8).max(2000).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

export const webhookEndpointSchema = z.object({
  url: z.string().trim().url().max(2000),
  description: z.string().trim().max(200).optional(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  active: z.boolean().default(true),
});
export const updateWebhookEndpointSchema = webhookEndpointSchema.partial();

export const apiKeySchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const automationConditionSchema = z.object({
  field: z.enum(['outcome', 'sentiment', 'durationSec', 'direction', 'agentId', 'campaignId']),
  op: z.enum(['eq', 'neq', 'gt', 'lt', 'in']),
  value: z.union([z.string(), z.number(), z.array(z.string())]),
});

export const automationActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('webhook'), url: z.string().url() }),
  z.object({ type: z.literal('email'), to: z.string().email(), subject: z.string().max(200) }),
  z.object({ type: z.literal('slack'), integrationId: z.string().min(1) }),
  z.object({
    type: z.literal('add_to_campaign'),
    campaignId: z.string().min(1),
  }),
  z.object({ type: z.literal('mark_do_not_call') }),
]);

export const automationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  trigger: z.enum(WEBHOOK_EVENTS),
  conditions: z.array(automationConditionSchema).max(10).default([]),
  actions: z.array(automationActionSchema).min(1).max(10),
  active: z.boolean().default(true),
});
export type AutomationInput = z.infer<typeof automationSchema>;
export const updateAutomationSchema = automationSchema.partial();

// ── Billing ─────────────────────────────────────────────────────────────────

export const checkoutSchema = z.object({
  planCode: z.enum(['BASIC', 'PRO']),
  /** Which gateway to pay through; defaults to the first one offered. */
  gateway: z.enum(PAYMENT_GATEWAYS).optional(),
});

/** Sync a just-approved Razorpay or PayPal subscription without waiting for its webhook. */
export const checkoutConfirmSchema = z.object({
  gateway: z.enum(['RAZORPAY', 'PAYPAL']),
  subscriptionId: z.string().trim().min(4).max(80),
});

// ── Support ────────────────────────────────────────────────────────────────

export const ticketSchema = z.object({
  subject: z.string().trim().min(4).max(200),
  body: z.string().trim().min(10).max(10000),
});
export const ticketReplySchema = z.object({
  body: z.string().trim().min(1).max(10000),
});
export const ticketUpdateSchema = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assigneeId: z.string().nullable().optional(),
});
export const assistantMessageSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
});

// ── Public website ─────────────────────────────────────────────────────────

export const contactRequestSchema = z.object({
  captchaToken,
  name: z.string().trim().min(2).max(120),
  email,
  company: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  message: z.string().trim().min(10).max(5000),
  plan: z.enum(PLAN_CODES).optional(),
  /** Honeypot: hidden from people, so anything here came from a bot. */
  website: z.string().max(500).optional(),
});

// ── CMS (admin) ─────────────────────────────────────────────────────────────

const seoFields = {
  seoTitle: z.string().trim().max(70).optional().nullable(),
  seoDescription: z.string().trim().max(170).optional().nullable(),
  ogImageUrl: z.string().trim().url().max(2000).optional().nullable().or(z.literal('')),
  noindex: z.boolean().default(false),
};

export const pageSchema = z.object({
  slug,
  title: z.string().trim().min(2).max(200),
  /** Markdown. */
  body: z.string().max(200000).default(''),
  status: z.enum(CONTENT_STATUSES).default('DRAFT'),
  showInFooter: z.boolean().default(false),
  ...seoFields,
});
export const updatePageSchema = pageSchema.partial();

export const postSchema = z.object({
  slug,
  title: z.string().trim().min(2).max(200),
  excerpt: z.string().trim().max(400).default(''),
  /** Markdown. */
  body: z.string().max(200000).default(''),
  coverImageUrl: z.string().trim().url().max(2000).optional().nullable().or(z.literal('')),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  status: z.enum(CONTENT_STATUSES).default('DRAFT'),
  publishedAt: z.coerce.date().optional().nullable(),
  ...seoFields,
});
export const updatePostSchema = postSchema.partial();

export const faqSchema = z.object({
  question: z.string().trim().min(4).max(300),
  answer: z.string().trim().min(2).max(5000),
  category: z.string().trim().max(60).default('General'),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  published: z.boolean().default(true),
});
export const updateFaqSchema = faqSchema.partial();

export const seoSettingsSchema = z.object({
  siteName: z.string().trim().min(2).max(80),
  defaultTitle: z.string().trim().max(70),
  titleTemplate: z.string().trim().max(80),
  defaultDescription: z.string().trim().max(170),
  ogImageUrl: z.string().trim().url().max(2000).optional().nullable().or(z.literal('')),
  twitterHandle: z.string().trim().max(40).optional().nullable(),
  contactEmail: z.string().trim().email().max(254),
  googleSiteVerification: z.string().trim().max(200).optional().nullable(),
});
export type SeoSettings = z.infer<typeof seoSettingsSchema>;

// ── Admin: subscriptions & staff ───────────────────────────────────────────

const limitOverride = z.number().int().min(0).max(1_000_000).nullable();

export const adminSubscriptionSchema = z.object({
  planCode: z.enum(PLAN_CODES).optional(),
  status: z.enum(SUBSCRIPTION_STATUSES).optional(),
  currentPeriodEnd: z.coerce.date().optional(),
  cancelAtPeriodEnd: z.boolean().optional(),
  /** Enterprise price in cents, used for MRR. */
  customPriceCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  customMinutes: z.number().int().min(0).max(10_000_000).nullable().optional(),
  customLimits: z
    .object({
      agents: limitOverride.optional(),
      phoneNumbers: limitOverride.optional(),
      campaigns: limitOverride.optional(),
      contactsPerCampaign: limitOverride.optional(),
      integrations: limitOverride.optional(),
      concurrentCalls: z.number().int().min(1).max(500).optional(),
      webhooks: limitOverride.optional(),
      apiKeys: limitOverride.optional(),
      automations: limitOverride.optional(),
    })
    .nullable()
    .optional(),
  note: z.string().trim().max(500).optional(),
});

export const adminWorkspaceSchema = z.object({
  suspended: z.boolean().optional(),
  notes: z.string().max(5000).optional(),
});

export const staffSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email,
  role: z.enum(ROLES_FOR_STAFF),
  password,
});
export const updateStaffSchema = z.object({
  role: z.enum(ROLES_FOR_STAFF).optional(),
  suspended: z.boolean().optional(),
});

export const planUpdateSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  tagline: z.string().trim().max(200).optional(),
  priceMonthlyCents: z.number().int().min(0).max(100_000_000).nullable().optional(),
  includedMinutes: z.number().int().min(0).max(10_000_000).nullable().optional(),
  stripePriceId: z.string().trim().max(120).nullable().optional(),
  razorpayPlanId: z.string().trim().max(120).nullable().optional(),
  paypalPlanId: z.string().trim().max(120).nullable().optional(),
  limits: z.record(z.string(), z.number().int().min(0).nullable()).optional(),
  highlights: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  active: z.boolean().optional(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(100).optional(),
});

// ── Site settings: security & analytics ────────────────────────────────────

export const CAPTCHA_PROVIDERS = ['none', 'turnstile', 'recaptcha', 'hcaptcha'] as const;
export type CaptchaProvider = (typeof CAPTCHA_PROVIDERS)[number];

/** Forms that can be protected by a captcha. */
export const CAPTCHA_FORMS = ['signup', 'login', 'forgotPassword', 'contact'] as const;
export type CaptchaForm = (typeof CAPTCHA_FORMS)[number];

/**
 * Which public forms demand a captcha. The provider and its keys come from
 * the environment (CAPTCHA_PROVIDER, CAPTCHA_SECRET_KEY,
 * NEXT_PUBLIC_CAPTCHA_SITE_KEY); a super admin flips these toggles from the
 * admin panel without a deploy.
 */
export const securitySettingsSchema = z.object({
  captcha: z.object({
    signup: z.boolean().default(true),
    login: z.boolean().default(false),
    forgotPassword: z.boolean().default(true),
    contact: z.boolean().default(true),
  }),
});
export type SecuritySettings = z.infer<typeof securitySettingsSchema>;

export const analyticsSettingsSchema = z.object({
  /** Plausible domain, e.g. purplevoice.ai. Loaded lazily, cookie-free. */
  plausibleDomain: z.string().trim().max(200).optional().nullable(),
  /** Google Analytics 4 measurement id, e.g. G-XXXXXXX. */
  ga4MeasurementId: z
    .string()
    .trim()
    .regex(/^G-[A-Z0-9]+$/, 'Looks like G-XXXXXXX')
    .optional()
    .nullable()
    .or(z.literal('')),
});
export type AnalyticsSettings = z.infer<typeof analyticsSettingsSchema>;

export const leadUpdateSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST']).optional(),
  notes: z.string().max(10000).optional(),
  ownerId: z.string().nullable().optional(),
});

/** Only alt text is editable: an image's folder is part of its URL, which content already links to. */
export const mediaUpdateSchema = z.object({
  alt: z.string().trim().max(300),
});

export const seoSuggestSchema = z.object({
  title: z.string().trim().min(2).max(200),
  body: z.string().max(200000),
});
