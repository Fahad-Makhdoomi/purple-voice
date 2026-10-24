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
  RETRY_STRATEGIES,
  RETRYABLE_RESULTS,
  MAX_CAMPAIGN_RETRIES,
} from './enums';
import { PAID_PLAN_CODES, PLAN_CODES } from './plans';
import { pageBlocksSchema } from './page-blocks';
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

/**
 * Bumped when the Terms or Privacy Policy change materially; users who
 * accepted an older version are asked again (GDPR: informed, recorded consent).
 */
export const LEGAL_VERSION = '2026-10-18';

export const registerSchema = z.object({
  captchaToken,
  name: z.string().trim().min(2).max(120),
  email,
  password,
  company: z.string().trim().max(160).optional(),
  /** Ticked "I agree to the Terms and Privacy Policy". */
  acceptTerms: z
    .boolean()
    .refine((v) => v, 'Please agree to the Terms of Service and Privacy Policy'),
  /** Product news by email. Never pre-ticked. */
  marketingOptIn: z.boolean().default(false),
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
  marketingOptIn: z.boolean().optional(),
});

/** Re-accepting the current Terms and Privacy Policy (after they change). */
export const acceptTermsSchema = z.object({ version: z.literal(LEGAL_VERSION) });

/**
 * Erasing an account and its workspace for good (GDPR art. 17, UK GDPR, CCPA
 * right to delete). Needs the password, when the account has one, and the
 * word DELETE typed out.
 */
export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(200).optional(),
  confirm: z.literal('DELETE', { errorMap: () => ({ message: 'Type DELETE to confirm' }) }),
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
  /** Text-to-speech model for the ElevenLabs and Sarvam engines (e.g. bulbul:v3). */
  speechModel: z
    .string()
    .trim()
    .max(60)
    .regex(/^[\w.:/-]*$/, 'Model ids contain only letters, digits and . : / - _')
    .nullish(),
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
  /** Email information during the call through the workspace's SMTP integration. */
  emailEnabled: z.boolean().default(false),
  /** Send information on WhatsApp during the call through the WhatsApp integration. */
  whatsappEnabled: z.boolean().default(false),
  /** What the agent may send when asked: links, prices, brochure text, address. */
  shareInfo: z.string().max(10000).default(''),
});
export type AgentInput = z.infer<typeof agentSchema>;
export const updateAgentSchema = agentSchema.partial();

/**
 * The numbers an agent answers, set from the agent's own settings. Numbers
 * left out stop answering through this agent. A number another active agent
 * answers is only moved when `move` is true.
 */
export const agentNumbersSchema = z.object({
  phoneNumberIds: z.array(z.string().min(1)).max(500),
  move: z.boolean().default(false),
});
export type AgentNumbersInput = z.infer<typeof agentNumbersSchema>;

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

/** Calls per contact in all: the first call plus up to MAX_CAMPAIGN_RETRIES retries. */
const maxAttempts = z
  .number()
  .int()
  .min(1)
  .max(MAX_CAMPAIGN_RETRIES + 1, `A number can be retried at most ${MAX_CAMPAIGN_RETRIES} times`);
const retryDelay = z.number().int().min(5).max(10080);
const retryOn = z.array(z.enum(RETRYABLE_RESULTS)).max(RETRYABLE_RESULTS.length);
const retryWindowTime = hhmm.nullable().optional();

const retryWindowOk = (v: { retryWindowStart?: string | null; retryWindowEnd?: string | null }) =>
  (!v.retryWindowStart && !v.retryWindowEnd) ||
  (!!v.retryWindowStart && !!v.retryWindowEnd && v.retryWindowStart < v.retryWindowEnd);
const retryWindowIssue = {
  message: 'Give both retry times, ending after they start, or leave both empty',
  path: ['retryWindowEnd'],
};

export const campaignSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    agentId: z.string().min(1),
    phoneNumberId: z.string().min(1),
    goal: z.string().trim().max(1000).default(''),
    /** How the agent should tailor each call to the contact's sheet details. */
    personalization: z.string().trim().max(2000).default(''),
    timezone: z.string().trim().max(64).default('UTC'),
    callWindowStart: hhmm.default('09:00'),
    callWindowEnd: hhmm.default('18:00'),
    /** 0 = Sunday … 6 = Saturday. */
    callDays: z.array(z.number().int().min(0).max(6)).min(1).default([1, 2, 3, 4, 5]),
    maxAttempts: maxAttempts.default(3),
    /** Least time before the same number is called again. */
    retryDelayMinutes: retryDelay.default(120),
    /** When numbers that did not pick up are called again. */
    retryStrategy: z.enum(RETRY_STRATEGIES).default('END_OF_LIST'),
    /** Which results get another call. */
    retryOn: retryOn.default([...RETRYABLE_RESULTS]),
    /** Optional hours for retries only (e.g. evenings), in the campaign time zone. */
    retryWindowStart: retryWindowTime,
    retryWindowEnd: retryWindowTime,
    concurrency: z.number().int().min(1).max(50).default(1),
    /** Pause between calls; at least 20 seconds. */
    callDelaySeconds: callDelay.default(MIN_CALL_DELAY_SECONDS),
    /** The subscriber confirms they have consent to call these people (TCPA, PECR, GDPR). */
    consentConfirmed: z.boolean().optional(),
  })
  .refine((v) => v.callWindowStart < v.callWindowEnd, {
    message: 'Call window must end after it starts',
    path: ['callWindowEnd'],
  })
  .refine(retryWindowOk, retryWindowIssue);
export type CampaignInput = z.infer<typeof campaignSchema>;
export const updateCampaignSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    agentId: z.string().min(1).optional(),
    phoneNumberId: z.string().min(1).optional(),
    goal: z.string().trim().max(1000).optional(),
    personalization: z.string().trim().max(2000).optional(),
    timezone: z.string().trim().max(64).optional(),
    callWindowStart: hhmm.optional(),
    callWindowEnd: hhmm.optional(),
    callDays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
    maxAttempts: maxAttempts.optional(),
    retryDelayMinutes: retryDelay.optional(),
    retryStrategy: z.enum(RETRY_STRATEGIES).optional(),
    retryOn: retryOn.optional(),
    retryWindowStart: retryWindowTime,
    retryWindowEnd: retryWindowTime,
    concurrency: z.number().int().min(1).max(50).optional(),
    callDelaySeconds: callDelay.optional(),
  })
  .refine(
    (v) => (v.retryWindowStart === undefined && v.retryWindowEnd === undefined) || retryWindowOk(v),
    retryWindowIssue,
  );

/** Starting or resuming a campaign; consent is confirmed once per campaign. */
export const startCampaignSchema = z.object({ consentConfirmed: z.boolean().optional() });

export const contactSchema = z.object({
  phone: e164,
  name: z.string().trim().max(160).optional(),
  email: z.string().trim().toLowerCase().email().max(254).optional().or(z.literal('')),
  company: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
});
export type ContactInput = z.infer<typeof contactSchema>;

export const previewContactsSchema = z.object({ csv: z.string().min(1).max(5_000_000) });

export const addContactsSchema = z.object({
  contacts: z.array(z.record(z.string(), z.unknown())).max(50000).optional(),
  /** Raw CSV with a header row containing at least `phone`. */
  csv: z.string().max(5_000_000).optional(),
  /** Labels put on every contact of this upload, on top of any `tags` column. */
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
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

/** Ports a mail server may be reached on: SMTP, submission (TLS and STARTTLS) and the common alternative. */
export const SMTP_PORTS = [25, 465, 587, 2525] as const;

/**
 * The workspace's own mail server, so agents can email people what they asked
 * for during a call. The password is optional on update (blank keeps it).
 */
export const smtpIntegrationSchema = z.object({
  host: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(255)
    .regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Use the server name, e.g. smtp.gmail.com'),
  port: z
    .number()
    .int()
    .refine((p) => (SMTP_PORTS as readonly number[]).includes(p), 'Use port 465, 587, 2525 or 25'),
  /** TLS from the first byte (port 465). Otherwise STARTTLS is required. */
  secure: z.boolean(),
  username: z.string().trim().max(254).optional().or(z.literal('')),
  password: z.string().max(500).optional().or(z.literal('')),
  fromEmail: email,
  fromName: z.string().trim().max(120).optional().or(z.literal('')),
  replyTo: email.optional().or(z.literal('')),
});
export type SmtpIntegrationInput = z.infer<typeof smtpIntegrationSchema>;

/**
 * WhatsApp Business. Meta's Cloud API (a phone number id and a permanent
 * access token) or Twilio (a connected Twilio account and its WhatsApp
 * sender). Business-initiated messages need an approved template; free text
 * only reaches people who messaged the business in the last 24 hours.
 */
export const whatsappIntegrationSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('META'),
    phoneNumberId: z
      .string()
      .trim()
      .regex(/^\d{5,30}$/, 'The phone number ID is digits only'),
    /** Blank on update keeps the saved token. */
    accessToken: z.string().trim().max(1000).optional().or(z.literal('')),
    /** Approved template with one body variable ({{1}}) for the message text. */
    templateName: z
      .string()
      .trim()
      .regex(/^[a-z0-9_]{1,512}$/, 'Template names are lowercase letters, digits and _')
      .optional()
      .or(z.literal('')),
    templateLanguage: z.string().trim().max(15).default('en_US'),
  }),
  z.object({
    provider: z.literal('TWILIO'),
    /** One of the workspace's connected Twilio accounts. */
    telephonyAccountId: z.string().min(1),
    /** The WhatsApp-enabled sender, e.g. +14155238886. */
    from: e164,
    /** Approved Content template (HX…) with variable {{1}} for the message text. */
    contentSid: z
      .string()
      .trim()
      .regex(/^HX[0-9a-fA-F]{32}$/, 'Content SIDs start with HX')
      .optional()
      .or(z.literal('')),
  }),
]);
export type WhatsappIntegrationInput = z.infer<typeof whatsappIntegrationSchema>;

/** Sends one test message through an integration. */
export const integrationTestSchema = z.object({ to: z.string().trim().min(3).max(254) });

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

/** GSTIN: 2-digit state, PAN (5 letters, 4 digits, letter), entity, Z, check character. */
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const gstin = z
  .string()
  .trim()
  .toUpperCase()
  .regex(GSTIN_PATTERN, 'Enter a valid 15-character GST number, e.g. 29ABCDE1234F1Z5');

export const checkoutSchema = z.object({
  planCode: z.enum(PAID_PLAN_CODES),
  /** Which gateway to pay through; defaults to the first one offered. */
  gateway: z.enum(PAYMENT_GATEWAYS).optional(),
  /** India: GST registration, printed on Razorpay invoices. Empty clears it. */
  gstin: gstin.optional().or(z.literal('')),
  billingName: z.string().trim().max(120).optional(),
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
  /** Another URL that is the original of this content (rel=canonical). */
  canonicalUrl: z.string().trim().url().max(2000).optional().nullable().or(z.literal('')),
  noindex: z.boolean().default(false),
};

export const PAGE_LAYOUTS = ['markdown', 'builder'] as const;

/** Page slugs the website itself uses; a CMS page can't take them. */
export const RESERVED_SLUGS = [
  'admin',
  'api',
  'blog',
  'contact',
  'dashboard',
  'faq',
  'forgot-password',
  'internal',
  'login',
  'pricing',
  'privacy-choices',
  'reset-password',
  'signup',
  'uploads',
  'ws',
] as const;

const pageSlug = slug.refine((s) => !(RESERVED_SLUGS as readonly string[]).includes(s), {
  message: 'That address is used by the website itself. Pick another.',
});

export const pageSchema = z.object({
  slug: pageSlug,
  title: z.string().trim().min(2).max(200),
  /** Markdown, for the "markdown" layout. */
  body: z.string().max(200000).default(''),
  /** "builder": the page is the blocks below, built in the page builder. */
  layout: z.enum(PAGE_LAYOUTS).default('markdown'),
  blocks: pageBlocksSchema.default([]),
  status: z.enum(CONTENT_STATUSES).default('DRAFT'),
  showInFooter: z.boolean().default(false),
  showInHeader: z.boolean().default(false),
  navLabel: z.string().trim().max(40).optional().nullable(),
  navOrder: z.number().int().min(0).max(1000).default(0),
  ...seoFields,
});
export const updatePageSchema = pageSchema.partial();

/** Posts in these categories are listed under /resources instead of /blog. */
export const RESOURCE_CATEGORIES = [
  'Templates',
  'Checklists',
  'Scripts',
  'Glossary',
  'Calculators',
  'Frameworks',
] as const;

export const POST_SCHEMA_TYPES = [
  'BlogPosting',
  'Article',
  'NewsArticle',
  'TechArticle',
  'HowTo',
] as const;

const faqItem = z.object({
  question: z.string().trim().min(3).max(300),
  answer: z.string().trim().min(1).max(3000),
});
const howToStep = z.object({
  name: z.string().trim().min(2).max(200),
  text: z.string().trim().min(2).max(2000),
});

export const postSchema = z.object({
  slug,
  title: z.string().trim().min(2).max(200),
  excerpt: z.string().trim().max(400).default(''),
  /** Markdown. */
  body: z.string().max(200000).default(''),
  coverImageUrl: z.string().trim().url().max(2000).optional().nullable().or(z.literal('')),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  status: z.enum(CONTENT_STATUSES).default('DRAFT'),
  /** In the future: published automatically at that time. */
  publishedAt: z.coerce.date().optional().nullable(),
  ...seoFields,
  focusKeyword: z.string().trim().max(100).optional().nullable(),
  secondaryKeywords: z.array(z.string().trim().min(1).max(100)).max(10).default([]),
  ogTitle: z.string().trim().max(95).optional().nullable(),
  ogDescription: z.string().trim().max(200).optional().nullable(),
  nofollow: z.boolean().default(false),
  schemaType: z.enum(POST_SCHEMA_TYPES).default('BlogPosting'),
  faq: z.array(faqItem).max(30).default([]),
  howToSteps: z.array(howToStep).max(40).default([]),
  category: z.string().trim().max(60).optional().nullable(),
  authorName: z.string().trim().max(120).optional().nullable(),
  authorBio: z.string().trim().max(600).optional().nullable(),
  showToc: z.boolean().default(true),
});
export const updatePostSchema = postSchema.partial();

/** A moved URL. Paths start with "/"; the target may also be a full https URL. */
export const redirectSchema = z.object({
  fromPath: z
    .string()
    .trim()
    .max(500)
    .regex(/^\/[^\s?#]*$/, 'Start with / and leave out ?query and #anchor'),
  toPath: z
    .string()
    .trim()
    .max(2000)
    .regex(/^(\/[^\s]*|https:\/\/\S+)$/, 'A path like /blog/new-post or a full https:// URL'),
  permanent: z.boolean().default(true),
});

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
  /** Fixed INR price for Razorpay, in paise; null = today's rate. */
  priceMonthlyInrPaise: z.number().int().min(100).max(1_000_000_000).nullable().optional(),
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

// ── Site settings: appearance (website themes) ─────────────────────────────

/**
 * Website themes. A theme changes only the look of the public website and
 * sign-in pages — colours, type, shapes, imagery, decoration — never the
 * content, which every theme renders from the same components.
 */
export const SITE_THEMES = ['default', 'kawaii', 'minimal'] as const;
export type SiteTheme = (typeof SITE_THEMES)[number];

export const SITE_THEME_INFO: Record<SiteTheme, { name: string; description: string }> = {
  default: {
    name: 'Purple Voice',
    description: 'Night sky, a glowing violet orb and neon buttons. The original brand look.',
  },
  kawaii: {
    name: 'Kawaii',
    description:
      'A lone tree in a pastel sea, fluffy clouds, candy-coloured pills and Plus Jakarta Sans, with optional background music.',
  },
  minimal: {
    name: 'Minimal',
    description:
      'Airy lavender-white with purple shades, a violet sun rising through clouds, light Inter Tight type, yellow call-to-action pills and scroll-driven motion.',
  },
};

/** Super admin → Website theme. Changes go live within seconds, no deploy. */
export const appearanceSettingsSchema = z.object({
  theme: z.enum(SITE_THEMES).default('default'),
  /** Offer visitors a play button for the theme's background music (never autoplays). */
  music: z.boolean().default(true),
});
export type AppearanceSettings = z.infer<typeof appearanceSettingsSchema>;

// ── Site settings: website content (Admin → Content → Site content) ────────

const optionalUrl = z.string().trim().url().max(500).optional().nullable().or(z.literal(''));
const linkHref = z
  .string()
  .trim()
  .max(500)
  .regex(/^(\/(?!\/)|#|https:\/\/|mailto:)/, 'A site path like /pricing or a full https:// link');

/** Words on the home page and around the site that staff edit without a deploy. */
export const contentSettingsSchema = z.object({
  announcement: z
    .object({
      enabled: z.boolean().default(false),
      text: z.string().trim().max(160).default(''),
      linkLabel: z.string().trim().max(40).default(''),
      href: linkHref.or(z.literal('')).default(''),
    })
    .default({}),
  hero: z
    .object({
      badge: z.string().trim().max(80).default('Now with natural, human-sounding voices'),
      title: z.string().trim().min(4).max(120).default('Turn every lead into a booked meeting.'),
      subtitle: z
        .string()
        .trim()
        .max(400)
        .default(
          'Purple Voice builds AI agents that phone your leads, answer their questions and put appointments straight into your calendar — on your own phone numbers, around the clock.',
        ),
      primaryLabel: z.string().trim().max(40).default('Start free'),
      primaryHref: linkHref.default('/signup?plan=FREE'),
      secondaryLabel: z.string().trim().max(40).default('Hear a sample call'),
      secondaryHref: linkHref.default('/#demo'),
    })
    .default({}),
  footerTagline: z
    .string()
    .trim()
    .max(300)
    .default('AI voice agents that call, qualify and book — on your own phone numbers.'),
  social: z
    .object({
      linkedin: optionalUrl,
      x: optionalUrl,
      youtube: optionalUrl,
      instagram: optionalUrl,
      facebook: optionalUrl,
    })
    .default({}),
});
export type ContentSettings = z.infer<typeof contentSettingsSchema>;

/**
 * Who runs the site, as the legal pages and cookie banner state it (GDPR
 * art. 13: identity and contact details of the controller and DPO; UK GDPR;
 * CCPA notice at collection). Filled into {{placeholders}} in the legal pages.
 */
export const legalSettingsSchema = z.object({
  companyName: z.string().trim().max(160).default('Purple Rocket'),
  address: z.string().trim().max(400).default(''),
  country: z.string().trim().max(80).default(''),
  registrationNumber: z.string().trim().max(80).default(''),
  vatNumber: z.string().trim().max(80).default(''),
  privacyEmail: z.string().trim().max(254).default(''),
  dpoName: z.string().trim().max(160).default(''),
  dpoEmail: z.string().trim().max(254).default(''),
  /** GDPR art. 27 representative in the EU, if the company is outside the EU. */
  euRepresentative: z.string().trim().max(400).default(''),
  /** UK GDPR art. 27 representative in the UK, if the company is outside the UK. */
  ukRepresentative: z.string().trim().max(400).default(''),
  /** ICO registration (UK data protection fee) number. */
  icoNumber: z.string().trim().max(40).default(''),
  /** Where the platform is hosted, for the sub-processors list. */
  hostingProvider: z.string().trim().max(120).default(''),
  hostingRegion: z.string().trim().max(120).default(''),
  governingLaw: z.string().trim().max(120).default('England and Wales'),
  effectiveDate: z.string().trim().max(40).default('18 October 2026'),
});
export type LegalSettings = z.infer<typeof legalSettingsSchema>;

// ── Cookie consent and privacy requests (public) ───────────────────────────

/** Bumped when the cookie list changes; visitors are asked again. */
export const COOKIE_POLICY_VERSION = '2026-10-18';

export const COOKIE_CATEGORIES = ['necessary', 'preferences', 'analytics', 'marketing'] as const;
export type CookieCategory = (typeof COOKIE_CATEGORIES)[number];

export const consentSchema = z.object({
  consentId: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  preferences: z.boolean(),
  analytics: z.boolean(),
  marketing: z.boolean(),
  gpc: z.boolean().default(false),
  policyVersion: z.string().trim().max(40),
});
export type ConsentInput = z.infer<typeof consentSchema>;

export const PRIVACY_REQUEST_TYPES = [
  'ACCESS',
  'DELETE',
  'CORRECT',
  'PORTABILITY',
  'OPT_OUT_SALE',
  'OBJECT',
  'WITHDRAW_CONSENT',
  'OTHER',
] as const;
export type PrivacyRequestType = (typeof PRIVACY_REQUEST_TYPES)[number];

export const PRIVACY_REQUEST_LABELS: Record<PrivacyRequestType, string> = {
  ACCESS: 'Get a copy of my personal data',
  DELETE: 'Delete my personal data',
  CORRECT: 'Correct my personal data',
  PORTABILITY: 'Send my data to me in a portable format',
  OPT_OUT_SALE: 'Do not sell or share my personal information',
  OBJECT: 'Object to or restrict processing',
  WITHDRAW_CONSENT: 'Withdraw my consent',
  OTHER: 'Something else',
};

export const PRIVACY_REGIONS = ['EU_EEA', 'UK', 'US_CA', 'US_OTHER', 'OTHER'] as const;
export const PRIVACY_REGION_LABELS: Record<(typeof PRIVACY_REGIONS)[number], string> = {
  EU_EEA: 'European Union / EEA',
  UK: 'United Kingdom',
  US_CA: 'California, USA',
  US_OTHER: 'Another US state',
  OTHER: 'Somewhere else',
};

/** A data-subject / consumer rights request from the public site. */
export const privacyRequestSchema = z.object({
  captchaToken,
  name: z.string().trim().min(2).max(120),
  email,
  type: z.enum(PRIVACY_REQUEST_TYPES),
  region: z.enum(PRIVACY_REGIONS),
  /** "I am an authorised agent acting for someone else" (CCPA). */
  onBehalf: z.boolean().default(false),
  details: z.string().trim().max(5000).optional(),
  /** Honeypot. */
  website: z.string().max(500).optional(),
});

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
