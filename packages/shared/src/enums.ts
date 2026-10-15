/**
 * String unions mirrored by Prisma enums in apps/api/prisma/schema.prisma.
 * Keep both in step: the API validates input against these, the web app
 * renders labels from them.
 */

export const TELEPHONY_PROVIDERS = ['TWILIO', 'PLIVO', 'SUPERPHONE'] as const;
export type TelephonyProvider = (typeof TELEPHONY_PROVIDERS)[number];

export const TELEPHONY_PROVIDER_LABELS: Record<TelephonyProvider, string> = {
  TWILIO: 'Twilio',
  PLIVO: 'Plivo',
  SUPERPHONE: 'SuperPhone',
};

/** Language-model vendors a workspace can bring its own key for. */
export const AI_PROVIDERS = ['OPENAI', 'ANTHROPIC', 'GEMINI'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Speech vendors used by the cascaded voice engine (speech-to-text + text-to-speech). */
export const SPEECH_PROVIDERS = ['DEEPGRAM'] as const;
export type SpeechProvider = (typeof SPEECH_PROVIDERS)[number];

export const CREDENTIAL_PROVIDERS = [...AI_PROVIDERS, ...SPEECH_PROVIDERS] as const;
export type CredentialProvider = (typeof CREDENTIAL_PROVIDERS)[number];

export const CREDENTIAL_PROVIDER_LABELS: Record<CredentialProvider, string> = {
  OPENAI: 'OpenAI',
  ANTHROPIC: 'Claude (Anthropic)',
  GEMINI: 'Google Gemini',
  DEEPGRAM: 'Deepgram (speech)',
};

/**
 * How an agent turns audio into conversation.
 *
 *  REALTIME  OpenAI Realtime speech-to-speech. Lowest latency, one vendor.
 *  CASCADED  speech-to-text -> any LLM (OpenAI, Claude, Gemini) -> text-to-speech.
 *            Lets the subscriber pick the model; needs a speech key as well.
 */
export const VOICE_ENGINES = ['REALTIME', 'CASCADED'] as const;
export type VoiceEngine = (typeof VOICE_ENGINES)[number];

export const AGENT_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const CAMPAIGN_STATUSES = ['DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELED'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CONTACT_STATUSES = [
  'PENDING',
  'CALLING',
  'COMPLETED',
  'FAILED',
  'NO_ANSWER',
  'DO_NOT_CALL',
] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CALL_DIRECTIONS = ['INBOUND', 'OUTBOUND'] as const;
export type CallDirection = (typeof CALL_DIRECTIONS)[number];

export const CALL_STATUSES = [
  'QUEUED',
  'RINGING',
  'IN_PROGRESS',
  'COMPLETED',
  'TRANSFERRED',
  'NO_ANSWER',
  'BUSY',
  'FAILED',
  'CANCELED',
] as const;
export type CallStatus = (typeof CALL_STATUSES)[number];

/** Calls in these states still hold a concurrency slot. */
export const LIVE_CALL_STATUSES: readonly CallStatus[] = ['QUEUED', 'RINGING', 'IN_PROGRESS'];

export const CALL_OUTCOMES = [
  'INTERESTED',
  'NOT_INTERESTED',
  'APPOINTMENT_BOOKED',
  'CALLBACK_REQUESTED',
  'TRANSFERRED',
  'VOICEMAIL',
  'WRONG_NUMBER',
  'DO_NOT_CALL',
  'OTHER',
] as const;
export type CallOutcome = (typeof CALL_OUTCOMES)[number];

export const SUBSCRIPTION_STATUSES = [
  'INCOMPLETE',
  'TRIALING',
  'ACTIVE',
  'PAST_DUE',
  'CANCELED',
  'UNPAID',
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Statuses that unlock the product. PAST_DUE keeps access during Stripe's retry window. */
export const ENTITLED_SUBSCRIPTION_STATUSES: readonly SubscriptionStatus[] = [
  'ACTIVE',
  'TRIALING',
  'PAST_DUE',
];

export const INTEGRATION_TYPES = [
  'GOOGLE_CALENDAR',
  'SLACK',
  'HUBSPOT',
  'ZAPIER',
  'CALENDLY',
] as const;
export type IntegrationType = (typeof INTEGRATION_TYPES)[number];

export const INTEGRATION_LABELS: Record<IntegrationType, string> = {
  GOOGLE_CALENDAR: 'Google Calendar',
  SLACK: 'Slack',
  HUBSPOT: 'HubSpot',
  ZAPIER: 'Zapier',
  CALENDLY: 'Calendly',
};

/** Events a workspace can subscribe a webhook or automation to. */
export const WEBHOOK_EVENTS = [
  'call.started',
  'call.completed',
  'call.transferred',
  'appointment.booked',
  'campaign.completed',
  'contact.updated',
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const TICKET_STATUSES = ['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['NORMAL', 'HIGH', 'URGENT'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const CONTENT_STATUSES = ['DRAFT', 'PUBLISHED'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
