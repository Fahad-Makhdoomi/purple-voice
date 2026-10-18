import { z } from 'zod';
import { MAX_CAMPAIGN_RETRIES, type CallOutcome, type ContactStatus } from './enums';

/**
 * Follow-up campaigns: once a campaign has finished, the people on its list are
 * sorted into groups by what happened on their calls, and any group (plus
 * hand-added tags) can become the contact list of a new campaign — re-call
 * those who never picked up, confirm booked appointments, chase interested
 * leads. Do-not-call and wrong-number contacts are in no group, so they are
 * never called again.
 */

export const FOLLOW_UP_SEGMENTS = [
  'NOT_ANSWERED',
  'NOT_CALLED',
  'CALLBACK_REQUESTED',
  'INTERESTED',
  'APPOINTMENT_BOOKED',
  'NOT_INTERESTED',
  'TRANSFERRED',
] as const;
export type FollowUpSegment = (typeof FOLLOW_UP_SEGMENTS)[number];

export const FOLLOW_UP_SEGMENT_INFO: Record<
  FollowUpSegment,
  { label: string; description: string; goal: string }
> = {
  NOT_ANSWERED: {
    label: 'Did not answer',
    description: 'No answer, busy, voicemail or a failed call, even after every retry.',
    goal: 'Reach people who did not pick up last time and complete the original goal of the campaign.',
  },
  NOT_CALLED: {
    label: 'Never called',
    description: 'Still waiting when the campaign ended (canceled early or out of minutes).',
    goal: 'Call the people the previous campaign never got to.',
  },
  CALLBACK_REQUESTED: {
    label: 'Asked for a callback',
    description: 'Said "call me later".',
    goal: 'Call back as promised: they asked us to ring later, so remind them of the earlier conversation.',
  },
  INTERESTED: {
    label: 'Interested',
    description: 'Showed interest but did not book anything.',
    goal: 'Follow up with people who showed interest last time and move them to the next step.',
  },
  APPOINTMENT_BOOKED: {
    label: 'Booked an appointment',
    description: 'Confirm the time, or reschedule if it no longer suits.',
    goal: 'Confirm the appointment they booked: state the time ({{appointment_time}}), ask if they can still make it and offer to reschedule if not.',
  },
  NOT_INTERESTED: {
    label: 'Not interested',
    description: 'Declined. Only re-contact if your offer has changed.',
    goal: 'Re-engage people who declined before, with the new offer.',
  },
  TRANSFERRED: {
    label: 'Transferred to a human',
    description: 'Handed to a team member during the call.',
    goal: 'Check in with people who were transferred to a team member and see whether they were helped.',
  },
};

const OUTCOME_SEGMENTS: Partial<Record<CallOutcome, FollowUpSegment>> = {
  APPOINTMENT_BOOKED: 'APPOINTMENT_BOOKED',
  CALLBACK_REQUESTED: 'CALLBACK_REQUESTED',
  INTERESTED: 'INTERESTED',
  NOT_INTERESTED: 'NOT_INTERESTED',
  TRANSFERRED: 'TRANSFERRED',
  VOICEMAIL: 'NOT_ANSWERED',
};

/** The one group a contact belongs to, or null when they must not (or need not) be called again. */
export function followUpSegmentOf(contact: {
  status: ContactStatus;
  lastOutcome: CallOutcome | null;
}): FollowUpSegment | null {
  const { status, lastOutcome } = contact;
  if (status === 'DO_NOT_CALL' || lastOutcome === 'DO_NOT_CALL' || lastOutcome === 'WRONG_NUMBER')
    return null;
  const byOutcome = lastOutcome ? OUTCOME_SEGMENTS[lastOutcome] : undefined;
  if (byOutcome) return byOutcome;
  if (status === 'NO_ANSWER' || status === 'FAILED') return 'NOT_ANSWERED';
  if (status === 'PENDING') return 'NOT_CALLED';
  return null;
}

/** Tags are lower-case, short and free of separators so a CSV cell can hold several. */
export function normalizeTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_ -]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 32);
}

/** Splits "vip; webinar, 2026" into clean, unique tags (at most 20). */
export function parseTags(raw: string | string[] | undefined | null): string[] {
  const parts = Array.isArray(raw) ? raw : String(raw ?? '').split(/[;,|]/);
  return [...new Set(parts.map(normalizeTag).filter(Boolean))].slice(0, 20);
}

/** Whether a contact joins a follow-up: in one of the groups and, if tags are given, carrying one. */
export function matchesFollowUp(
  contact: { status: ContactStatus; lastOutcome: CallOutcome | null; tags: string[] },
  segments: readonly FollowUpSegment[],
  tags: readonly string[],
): boolean {
  const segment = followUpSegmentOf(contact);
  if (!segment) return false;
  if (segments.length && !segments.includes(segment)) return false;
  if (tags.length && !tags.some((t) => contact.tags.includes(t))) return false;
  return true;
}

const tagList = z
  .array(z.string().trim().min(1).max(40))
  .max(20)
  .transform((t) => parseTags(t));

export const followUpSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    segments: z.array(z.enum(FOLLOW_UP_SEGMENTS)).max(FOLLOW_UP_SEGMENTS.length).default([]),
    tags: tagList.default([]),
    goal: z.string().trim().max(1000).optional(),
    agentId: z.string().min(1).optional(),
    phoneNumberId: z.string().min(1).optional(),
    maxAttempts: z
      .number()
      .int()
      .min(1)
      .max(MAX_CAMPAIGN_RETRIES + 1)
      .optional(),
    retryDelayMinutes: z.number().int().min(5).max(10080).optional(),
  })
  .refine((v) => v.segments.length || v.tags.length, {
    message: 'Choose who to call: at least one group or tag',
    path: ['segments'],
  });
export type FollowUpInput = z.infer<typeof followUpSchema>;

/** Editing one contact of a campaign's list. Every field is optional. */
export const updateContactSchema = z.object({
  phone: z.string().trim().min(5).max(30).optional(),
  name: z.string().trim().max(160).optional(),
  email: z.string().trim().toLowerCase().email().max(254).optional().or(z.literal('')),
  company: z.string().trim().max(160).optional(),
  notes: z.string().trim().max(2000).optional(),
  tags: tagList.optional(),
});
export type UpdateContactInput = z.infer<typeof updateContactSchema>;

// ── Run again: a new batch inside the same finished campaign ────────────────

/**
 * Re-queue people of a finished campaign by how their last call went, without
 * making a new campaign. Do-not-call and wrong-number contacts are never included.
 */
export const RERUN_TARGETS = [
  'NO_ANSWER',
  'VOICEMAIL',
  'FAILED',
  'CALLBACK_REQUESTED',
  'INTERESTED',
  'NOT_INTERESTED',
] as const;
export type RerunTarget = (typeof RERUN_TARGETS)[number];

export const RERUN_TARGET_INFO: Record<RerunTarget, { label: string; description: string }> = {
  NO_ANSWER: { label: 'Did not pick up', description: 'No answer or busy.' },
  VOICEMAIL: { label: 'Went to voicemail', description: 'The call reached voicemail.' },
  FAILED: { label: 'Call failed', description: 'The call could not be connected.' },
  CALLBACK_REQUESTED: { label: 'Asked for a callback', description: 'Said "call me later".' },
  INTERESTED: { label: 'Interested', description: 'Showed interest but did not book.' },
  NOT_INTERESTED: { label: 'Not interested', description: 'Declined last time.' },
};

/** The one target a contact falls under, or null when they must not be called again. */
export function rerunTargetOf(contact: {
  status: ContactStatus;
  lastOutcome: CallOutcome | null;
}): RerunTarget | null {
  const { status, lastOutcome } = contact;
  if (status === 'DO_NOT_CALL' || lastOutcome === 'DO_NOT_CALL' || lastOutcome === 'WRONG_NUMBER')
    return null;
  if (status === 'PENDING' || status === 'CALLING') return null;
  if (lastOutcome === 'VOICEMAIL') return 'VOICEMAIL';
  if (lastOutcome === 'CALLBACK_REQUESTED') return 'CALLBACK_REQUESTED';
  if (lastOutcome === 'INTERESTED') return 'INTERESTED';
  if (lastOutcome === 'NOT_INTERESTED') return 'NOT_INTERESTED';
  if (status === 'NO_ANSWER') return 'NO_ANSWER';
  if (status === 'FAILED') return 'FAILED';
  return null;
}

export const rerunSchema = z.object({
  targets: z.array(z.enum(RERUN_TARGETS)).min(1, 'Choose who to call again'),
  /** Attempts each re-queued contact gets in this batch. */
  maxAttempts: z
    .number()
    .int()
    .min(1)
    .max(MAX_CAMPAIGN_RETRIES + 1)
    .optional(),
});
export type RerunInput = z.infer<typeof rerunSchema>;
