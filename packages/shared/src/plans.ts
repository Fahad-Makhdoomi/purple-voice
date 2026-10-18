/**
 * The plan catalogue.
 *
 * This is the *default* definition. The API seeds it into the `Plan` table,
 * after which a super admin can edit prices, minutes and limits from the
 * admin panel without a deploy. Enterprise workspaces additionally carry
 * per-subscription overrides (`Subscription.customLimits`).
 *
 * `null` in a limit means unlimited. Phone-number rental is billed by the
 * telephony provider on the subscriber's own account and is never part of a
 * Purple Voice plan.
 */

export const PLAN_CODES = ['FREE', 'BASIC', 'PRO', 'ENTERPRISE'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

/** Plans bought through a payment gateway. Free needs no checkout. */
export const PAID_PLAN_CODES = ['BASIC', 'PRO'] as const;

/**
 * The plan every workspace is on when it has no live paid subscription: at
 * sign-up, and after a paid plan ends. See services/entitlements.ts.
 */
export const FREE_PLAN_CODE = 'FREE' satisfies PlanCode;

export interface PlanLimits {
  /** AI call agents. */
  agents: number | null;
  /** Phone numbers connected to the workspace. */
  phoneNumbers: number | null;
  /** Calling campaigns that exist at once (any status except CANCELED). */
  campaigns: number | null;
  /** Contacts in a single campaign. */
  contactsPerCampaign: number | null;
  /** Connected third-party apps (Google Calendar counts as one). */
  integrations: number | null;
  /** Calls running at the same moment. Protects the shared VPS. */
  concurrentCalls: number;
  /** Outbound webhook endpoints. 0 = feature off. */
  webhooks: number | null;
  /** Developer API keys. 0 = feature off. */
  apiKeys: number | null;
  /** Automation rules. 0 = feature off. */
  automations: number | null;
}

export interface PlanFeatures {
  personalizedPrompts: boolean;
  appointmentBooking: boolean;
  callSummary: boolean;
  callTransfer: boolean;
  googleCalendar: boolean;
  multipleIntegrations: boolean;
  webhooks: boolean;
  developerApi: boolean;
  detailedInsights: boolean;
  aiSupportAssistant: boolean;
  prioritySupport: boolean;
  advancedAutomations: boolean;
}

export type FeatureKey = keyof PlanFeatures;
export type LimitKey = keyof PlanLimits;

export interface PlanDefinition {
  code: PlanCode;
  name: string;
  tagline: string;
  /** Monthly price in US cents. `null` = custom / contact sales. */
  priceMonthlyCents: number | null;
  /** Call minutes included per billing period. `null` = custom. */
  includedMinutes: number | null;
  limits: PlanLimits;
  features: PlanFeatures;
  /** Bullet points for the pricing page, in display order. */
  highlights: string[];
  /** Shown as the recommended plan on the pricing page. */
  featured: boolean;
  /** Self-serve checkout. Enterprise is sold by the team. */
  selfServe: boolean;
}

const NO_FEATURES: PlanFeatures = {
  personalizedPrompts: false,
  appointmentBooking: false,
  callSummary: false,
  callTransfer: false,
  googleCalendar: false,
  multipleIntegrations: false,
  webhooks: false,
  developerApi: false,
  detailedInsights: false,
  aiSupportAssistant: false,
  prioritySupport: false,
  advancedAutomations: false,
};

const ALL_FEATURES: PlanFeatures = Object.fromEntries(
  Object.keys(NO_FEATURES).map((k) => [k, true]),
) as unknown as PlanFeatures;

export const PLAN_CATALOG: Record<PlanCode, PlanDefinition> = {
  FREE: {
    code: 'FREE',
    name: 'Free',
    tagline: 'Try a real AI calling agent on your own number, free.',
    priceMonthlyCents: 0,
    includedMinutes: 100,
    limits: {
      agents: 1,
      phoneNumbers: 1,
      campaigns: 1,
      contactsPerCampaign: 100,
      // Google Calendar, email or WhatsApp: one of them.
      integrations: 1,
      concurrentCalls: 1,
      webhooks: 0,
      apiKeys: 0,
      automations: 0,
    },
    features: {
      ...NO_FEATURES,
      personalizedPrompts: true,
      appointmentBooking: true,
      callSummary: true,
      googleCalendar: true,
    },
    highlights: [
      'One AI call agent',
      'Connect one phone number',
      '1 calling campaign',
      '100 free AI call minutes / month',
      'Appointment booking and call summaries',
      'One app integration',
      'No card needed',
    ],
    featured: false,
    selfServe: true,
  },
  BASIC: {
    code: 'BASIC',
    name: 'Basic',
    tagline: 'One AI assistant working one number.',
    priceMonthlyCents: 1900,
    includedMinutes: 1000,
    limits: {
      agents: 1,
      phoneNumbers: 1,
      campaigns: 1,
      contactsPerCampaign: 100,
      // Google Calendar plus one more app.
      integrations: 2,
      concurrentCalls: 2,
      webhooks: 0,
      apiKeys: 0,
      automations: 0,
    },
    features: {
      ...NO_FEATURES,
      personalizedPrompts: true,
      appointmentBooking: true,
      callSummary: true,
      callTransfer: true,
      googleCalendar: true,
    },
    highlights: [
      'One AI call assistant',
      'Personalised prompts',
      'Connect one phone number',
      '1 calling campaign',
      '100 contacts per campaign',
      'Appointment booking',
      'Call summaries',
      'Live call transfer',
      'Google Calendar and app integrations',
      'Up to 1,000 call minutes / month',
    ],
    featured: false,
    selfServe: true,
  },
  PRO: {
    code: 'PRO',
    name: 'Pro',
    tagline: 'A full AI sales floor with the tools to wire it in.',
    priceMonthlyCents: 29900,
    includedMinutes: 20000,
    limits: {
      agents: null,
      phoneNumbers: null,
      campaigns: null,
      contactsPerCampaign: null,
      integrations: null,
      concurrentCalls: 10,
      webhooks: 20,
      apiKeys: 10,
      automations: 50,
    },
    features: { ...ALL_FEATURES },
    highlights: [
      'Multiple AI call agents',
      'Connect multiple numbers',
      'Multiple app integrations',
      'Webhooks and developer API',
      'Detailed calling insights',
      'AI support assistant',
      'Priority support',
      'Advanced automations',
      'Unlimited calling campaigns',
      'Unlimited contacts per campaign',
      'Up to 20,000 call minutes / month',
    ],
    featured: true,
    selfServe: true,
  },
  ENTERPRISE: {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    tagline: 'The whole system custom designed and maintained for you.',
    priceMonthlyCents: null,
    includedMinutes: null,
    limits: {
      agents: null,
      phoneNumbers: null,
      campaigns: null,
      contactsPerCampaign: null,
      integrations: null,
      concurrentCalls: 50,
      webhooks: null,
      apiKeys: null,
      automations: null,
    },
    features: { ...ALL_FEATURES },
    highlights: [
      'Everything in Pro',
      'Custom-designed call flows and agents',
      'Dedicated infrastructure and SLAs',
      'Custom integrations with your stack',
      'Managed and maintained by our team',
      'Volume minute pricing',
    ],
    featured: false,
    selfServe: false,
  },
};

export const PLAN_LIST: PlanDefinition[] = PLAN_CODES.map((c) => PLAN_CATALOG[c]);

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  personalizedPrompts: 'Personalised prompts',
  appointmentBooking: 'Appointment booking',
  callSummary: 'Call summaries',
  callTransfer: 'Call transfer',
  googleCalendar: 'Google Calendar',
  multipleIntegrations: 'Multiple app integrations',
  webhooks: 'Webhooks',
  developerApi: 'Developer API',
  detailedInsights: 'Detailed calling insights',
  aiSupportAssistant: 'AI support assistant',
  prioritySupport: 'Priority support',
  advancedAutomations: 'Advanced automations',
};

export const LIMIT_LABELS: Record<LimitKey, string> = {
  agents: 'AI agents',
  phoneNumbers: 'Phone numbers',
  campaigns: 'Calling campaigns',
  contactsPerCampaign: 'Contacts per campaign',
  integrations: 'App integrations',
  concurrentCalls: 'Concurrent calls',
  webhooks: 'Webhook endpoints',
  apiKeys: 'API keys',
  automations: 'Automations',
};

export function isFreePlan(plan: { code: string }): boolean {
  return plan.code === FREE_PLAN_CODE;
}

export function formatPrice(cents: number | null): string {
  if (cents === null) return 'Custom';
  if (cents === 0) return 'Free';
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars.toLocaleString('en-US') : dollars.toFixed(2)}`;
}
