import { z } from 'zod';
import { CALL_OUTCOMES, type CallOutcome } from './enums';

/**
 * CRM (Pro and up): a lead pipeline per workspace. People land in it by hand,
 * from campaign calls that went well (interested, appointment booked), from
 * people who call in, and as new leads from WhatsApp or the lead webhook —
 * which an agent can call straight away.
 */

export const CRM_STAGE_KINDS = ['OPEN', 'WON', 'LOST'] as const;
export type CrmStageKind = (typeof CRM_STAGE_KINDS)[number];

export const CRM_STAGE_COLORS = [
  'slate',
  'sky',
  'violet',
  'amber',
  'brand',
  'emerald',
  'rose',
] as const;
export type CrmStageColor = (typeof CRM_STAGE_COLORS)[number];

/**
 * The stages a pipeline starts with. `key` marks them so automatic moves
 * (an interested call → Interested) still find them after a rename.
 */
export const DEFAULT_CRM_STAGES = [
  { key: 'new', name: 'New', kind: 'OPEN', color: 'sky' },
  { key: 'contacted', name: 'Contacted', kind: 'OPEN', color: 'violet' },
  { key: 'interested', name: 'Interested', kind: 'OPEN', color: 'amber' },
  { key: 'appointment', name: 'Appointment', kind: 'OPEN', color: 'brand' },
  { key: 'won', name: 'Won', kind: 'WON', color: 'emerald' },
  { key: 'lost', name: 'Lost', kind: 'LOST', color: 'slate' },
] as const satisfies ReadonlyArray<{
  key: string;
  name: string;
  kind: CrmStageKind;
  color: CrmStageColor;
}>;
export type CrmStageKey = (typeof DEFAULT_CRM_STAGES)[number]['key'];

export const LEAD_SOURCES = [
  'manual',
  'campaign',
  'inbound_call',
  'whatsapp',
  'webhook',
  'dialer',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  manual: 'Added by hand',
  campaign: 'Campaign',
  inbound_call: 'Called in',
  whatsapp: 'WhatsApp',
  webhook: 'Lead webhook',
  dialer: 'Dialer',
};

export const CRM_ACTIVITY_TYPES = [
  'created',
  'note',
  'call',
  'stage',
  'appointment',
  'whatsapp',
  'campaign',
  'edit',
] as const;
export type CrmActivityType = (typeof CRM_ACTIVITY_TYPES)[number];

/** Call outcomes that put a person into the pipeline unless the workspace changes it. */
export const CRM_AUTO_ADD_DEFAULT: CallOutcome[] = [
  'INTERESTED',
  'APPOINTMENT_BOOKED',
  'CALLBACK_REQUESTED',
];

/**
 * The built-in stage a call moves a lead to: an appointment beats interest,
 * and any conversation at all moves a new lead to Contacted.
 */
export function stageKeyForOutcome(
  outcome: CallOutcome | null,
  hadAppointment: boolean,
  reached: boolean,
): CrmStageKey | null {
  if (hadAppointment || outcome === 'APPOINTMENT_BOOKED') return 'appointment';
  if (outcome === 'INTERESTED' || outcome === 'CALLBACK_REQUESTED') return 'interested';
  if (reached) return 'contacted';
  return null;
}

/**
 * Automatic moves only go forward through open stages: a lead in Won or Lost,
 * or already further along, stays where the team put it.
 */
export function shouldAdvance(
  current: { kind: CrmStageKind; position: number },
  target: { kind: CrmStageKind; position: number },
): boolean {
  return current.kind === 'OPEN' && target.kind === 'OPEN' && target.position > current.position;
}

/** "18:00" style times for the new-lead call hours. */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24h HH:MM');
const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''));
const tag = z.string().trim().min(1).max(40);

// ── Leads ───────────────────────────────────────────────────────────────────

export const crmLeadSchema = z.object({
  /** Any common format; the API stores it as +E.164. */
  phone: z.string().trim().min(5, 'Enter a phone number').max(32),
  name: optionalText(120),
  email: z.string().trim().toLowerCase().email().max(254).optional().or(z.literal('')),
  company: optionalText(160),
  notes: z.string().trim().max(5000).optional(),
  /** Deal value in cents. */
  valueCents: z.number().int().min(0).max(100_000_000_000).nullable().optional(),
  tags: z.array(tag).max(20).optional(),
  stageId: z.string().min(1).optional(),
  ownerId: z.string().min(1).nullable().optional(),
});
export type CrmLeadInput = z.infer<typeof crmLeadSchema>;
export const updateCrmLeadSchema = crmLeadSchema.partial();

export const crmNoteSchema = z.object({ text: z.string().trim().min(1).max(5000) });

export const crmBulkSchema = z.object({
  leadIds: z.array(z.string().min(1)).min(1).max(5000),
});
export const crmMoveSchema = crmBulkSchema.extend({ stageId: z.string().min(1) });

// ── Stages ──────────────────────────────────────────────────────────────────

export const crmStageSchema = z.object({
  name: z.string().trim().min(1).max(40),
  kind: z.enum(CRM_STAGE_KINDS).default('OPEN'),
  color: z.enum(CRM_STAGE_COLORS).default('slate'),
});
export const updateCrmStageSchema = crmStageSchema.partial();
export const reorderCrmStagesSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(30),
});

// ── Campaigns ───────────────────────────────────────────────────────────────

/** Calls CRM leads: picked ones or a whole stage, in a campaign that exists or a new draft. */
export const crmToCampaignSchema = z
  .object({
    leadIds: z.array(z.string().min(1)).min(1).max(5000).optional(),
    stageId: z.string().min(1).optional(),
    campaignId: z.string().min(1).optional(),
    newCampaign: z
      .object({
        name: z.string().trim().min(2).max(120),
        agentId: z.string().min(1),
        phoneNumberId: z.string().min(1),
        goal: z.string().trim().max(1000).default(''),
      })
      .optional(),
  })
  .refine((v) => !!v.leadIds !== !!v.stageId, {
    message: 'Choose leads or a stage',
    path: ['leadIds'],
  })
  .refine((v) => !!v.campaignId !== !!v.newCampaign, {
    message: 'Choose a campaign or create a new one',
    path: ['campaignId'],
  });
export type CrmToCampaignInput = z.infer<typeof crmToCampaignSchema>;

/** Adds a campaign's contacts to the pipeline: picked ones, or every one whose last call ended a given way. */
export const crmFromCampaignSchema = z
  .object({
    campaignId: z.string().min(1),
    contactIds: z.array(z.string().min(1)).min(1).max(5000).optional(),
    outcomes: z.array(z.enum(CALL_OUTCOMES)).min(1).optional(),
    stageId: z.string().min(1).optional(),
  })
  .refine((v) => !!v.contactIds || !!v.outcomes, {
    message: 'Choose contacts or call outcomes',
    path: ['contactIds'],
  });
export type CrmFromCampaignInput = z.infer<typeof crmFromCampaignSchema>;

// ── Settings ────────────────────────────────────────────────────────────────

export const crmSettingsSchema = z
  .object({
    /** Campaign call outcomes that add the person to the pipeline. */
    autoAddOutcomes: z.array(z.enum(CALL_OUTCOMES)).max(CALL_OUTCOMES.length),
    /** People who call in and show interest or book are added too. */
    autoAddInbound: z.boolean(),
    /** New leads from WhatsApp or the lead webhook: an agent calls them right away. */
    instantCallEnabled: z.boolean(),
    instantAgentId: z.string().min(1).nullable(),
    instantNumberId: z.string().min(1).nullable(),
    /** Only call between these hours (workspace time zone); blank = any time. */
    instantWindowStart: hhmm.nullable().or(z.literal('')),
    instantWindowEnd: hhmm.nullable().or(z.literal('')),
    /** WhatsApp messages from numbers not in the CRM yet become leads. */
    whatsappLeads: z.boolean(),
    /** Sent back on WhatsApp to a new lead. Blank: no reply. */
    whatsappReply: z.string().trim().max(1000),
    /** Meta app secret, to check webhook signatures. Blank keeps the saved one. */
    metaAppSecret: optionalText(200),
  })
  .partial()
  .refine(
    (v) =>
      !v.instantWindowStart ||
      !v.instantWindowEnd ||
      v.instantWindowStart < v.instantWindowEnd,
    { message: 'The calling hours must end after they start', path: ['instantWindowEnd'] },
  );
export type CrmSettingsInput = z.infer<typeof crmSettingsSchema>;

/**
 * What a website form, a Facebook lead ad (through Zapier or Make) or any
 * other tool posts to the lead webhook. Extra fields are kept on the lead and
 * the agent can use them on the call.
 */
export const inboundLeadSchema = z
  .object({
    phone: z.coerce.string().trim().min(5).max(32),
    name: z.coerce.string().trim().max(120).optional(),
    first_name: z.coerce.string().trim().max(60).optional(),
    last_name: z.coerce.string().trim().max(60).optional(),
    email: z.coerce.string().trim().max(254).optional(),
    company: z.coerce.string().trim().max(160).optional(),
    notes: z.coerce.string().trim().max(5000).optional(),
    message: z.coerce.string().trim().max(5000).optional(),
    tags: z.union([z.string().max(400), z.array(z.string().max(40)).max(20)]).optional(),
  })
  .passthrough();
export type InboundLeadInput = z.infer<typeof inboundLeadSchema>;

// ── Views ───────────────────────────────────────────────────────────────────

export interface CrmStageView {
  id: string;
  key: string | null;
  name: string;
  kind: CrmStageKind;
  color: CrmStageColor;
  position: number;
  leadCount: number;
  valueCents: number;
}

export interface CrmLeadView {
  id: string;
  stageId: string;
  phone: string;
  name: string | null;
  email: string | null;
  company: string | null;
  notes: string;
  valueCents: number | null;
  tags: string[];
  source: LeadSource;
  owner: { id: string; name: string } | null;
  campaign: { id: string; name: string } | null;
  lastOutcome: CallOutcome | null;
  lastCallAt: string | null;
  callDueAt: string | null;
  lastActivityAt: string;
  createdAt: string;
}

export interface CrmActivityView {
  id: string;
  type: CrmActivityType;
  text: string;
  callId: string | null;
  actor: { id: string; name: string } | null;
  createdAt: string;
}

export interface CrmSettingsView {
  autoAddOutcomes: CallOutcome[];
  autoAddInbound: boolean;
  instantCallEnabled: boolean;
  instantAgentId: string | null;
  instantNumberId: string | null;
  instantWindowStart: string | null;
  instantWindowEnd: string | null;
  whatsappLeads: boolean;
  whatsappReply: string;
  metaAppSecretSet: boolean;
  /** Where forms and tools post new leads. */
  leadWebhookUrl: string;
  /** The callback URL for Meta or Twilio WhatsApp; for Meta the verify token is `hookToken`. */
  whatsappWebhookUrl: string;
  verifyToken: string;
  timezone: string;
}
