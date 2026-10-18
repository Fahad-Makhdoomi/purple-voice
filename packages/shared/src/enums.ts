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
 * How a workspace's agents turn audio into conversation. Chosen per
 * subscriber by staff (Admin → Subscribers → AI), never by the subscriber.
 *
 *  REALTIME     OpenAI Realtime speech-to-speech. Needs an OpenAI key.
 *  GEMINI_LIVE  Gemini Live speech-to-speech. Needs a Gemini key only.
 *  CASCADED     speech-to-text -> any LLM (OpenAI, Claude, Gemini) -> text-to-speech.
 *               Needs the LLM vendor's key plus a Deepgram key for speech.
 */
export const VOICE_ENGINES = ['REALTIME', 'GEMINI_LIVE', 'CASCADED'] as const;
export type VoiceEngine = (typeof VOICE_ENGINES)[number];

export const VOICE_ENGINE_LABELS: Record<VoiceEngine, string> = {
  REALTIME: 'OpenAI Realtime',
  GEMINI_LIVE: 'Gemini Live',
  CASCADED: 'Cascaded (speech → LLM → speech)',
};

export const VOICE_ENGINE_DESCRIPTIONS: Record<VoiceEngine, string> = {
  REALTIME: 'Speech-to-speech on OpenAI. Lowest latency. Needs an OpenAI key.',
  GEMINI_LIVE: 'Speech-to-speech on Google Gemini. Needs a Gemini key only, no Deepgram.',
  CASCADED:
    'Deepgram hears and speaks; OpenAI, Claude or Gemini thinks. Needs that vendor’s key and a Deepgram key.',
};

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  OPENAI: 'OpenAI',
  ANTHROPIC: 'Claude (Anthropic)',
  GEMINI: 'Google Gemini',
};

export const AGENT_STATUSES = ['DRAFT', 'ACTIVE', 'PAUSED'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

/** How hard an agent filters background noise before it decides the caller is speaking. */
export const NOISE_FILTERS = ['OFF', 'STANDARD', 'STRONG'] as const;
export type NoiseFilter = (typeof NOISE_FILTERS)[number];

export const NOISE_FILTER_LABELS: Record<NoiseFilter, string> = {
  OFF: 'Off — any sound can interrupt',
  STANDARD: 'Standard — ignores most background noise',
  STRONG: 'Strong — noisy places; only clear, close speech interrupts',
};

/** Shortest pause a campaign can leave between calls. */
export const MIN_CALL_DELAY_SECONDS = 20;

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

/**
 * Whether a campaign call reached the person, and if not, why. SILENT means
 * the line connected but nobody spoke, which is usually a voicemail box.
 */
export const DIAL_RESULTS = [
  'REACHED',
  'NO_ANSWER',
  'BUSY',
  'VOICEMAIL',
  'FAILED',
  'SILENT',
] as const;
export type DialResult = (typeof DIAL_RESULTS)[number];

/** Results a campaign can call again. Reached people are never re-dialled automatically. */
export const RETRYABLE_RESULTS = ['NO_ANSWER', 'BUSY', 'VOICEMAIL', 'SILENT', 'FAILED'] as const;
export type RetryableResult = (typeof RETRYABLE_RESULTS)[number];

export const DIAL_RESULT_LABELS: Record<DialResult, string> = {
  REACHED: 'Reached',
  NO_ANSWER: 'No answer',
  BUSY: 'Line busy',
  VOICEMAIL: 'Voicemail',
  FAILED: "Couldn't connect",
  SILENT: 'Picked up, nobody spoke',
};

/** When a campaign calls unanswered numbers again. */
export const RETRY_STRATEGIES = ['END_OF_LIST', 'AFTER_DELAY', 'NEXT_DAY'] as const;
export type RetryStrategy = (typeof RETRY_STRATEGIES)[number];

export const RETRY_STRATEGY_INFO: Record<RetryStrategy, { label: string; description: string }> = {
  END_OF_LIST: {
    label: 'After the whole list',
    description:
      'Call everyone once first, then go round again for the numbers that did not pick up.',
  },
  AFTER_DELAY: {
    label: 'After a set time',
    description: 'Call back once the wait below has passed, ahead of numbers not tried yet.',
  },
  NEXT_DAY: {
    label: 'Next calling day',
    description: 'Try again when calling opens on the next calling day.',
  },
};

/** Retries a campaign may make per number, on top of the first call. */
export const MAX_CAMPAIGN_RETRIES = 5;

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
  'SMTP',
  'WHATSAPP',
] as const;
export type IntegrationType = (typeof INTEGRATION_TYPES)[number];

export const INTEGRATION_LABELS: Record<IntegrationType, string> = {
  GOOGLE_CALENDAR: 'Google Calendar',
  SLACK: 'Slack',
  HUBSPOT: 'HubSpot',
  ZAPIER: 'Zapier',
  CALENDLY: 'Calendly',
  SMTP: 'Email (SMTP)',
  WHATSAPP: 'WhatsApp',
};

export const MESSAGE_CHANNELS = ['EMAIL', 'WHATSAPP'] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

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
