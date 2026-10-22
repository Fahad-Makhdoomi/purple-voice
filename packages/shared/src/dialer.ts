import { z } from 'zod';
import type { CallStatus } from './enums';

/**
 * Browser dialer: a person calls from their computer through one of the
 * workspace's Twilio or Plivo numbers, talking through their own microphone
 * and speakers. No AI agent is on the line.
 *
 * One WebSocket per call, at /ws/dialer/<callId>/<sig>:
 *   binary frames, both ways    G.711 μ-law, 8 kHz mono (the carrier's own format)
 *   text frames, server → page  {"type":"status","status":"ringing"|"answered"|"ended","reason"?}
 *   text frames, page → server  {"type":"hangup"}
 */

const e164 = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, 'Use international format, e.g. +14155550123');

export const dialerCallSchema = z.object({
  phoneNumberId: z.string().min(1),
  to: e164,
  /** The CRM lead being called, so the call shows on the lead. */
  leadId: z.string().min(1).optional(),
});
export type DialerCallInput = z.infer<typeof dialerCallSchema>;

/** The dialer's other mode: one of the workspace's agents makes the call instead of the person. */
export const dialerAgentCallSchema = z.object({
  agentId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  to: e164,
  /** The CRM lead being called, so the agent knows who it is and the call shows on the lead. */
  leadId: z.string().min(1).optional(),
});
export type DialerAgentCallInput = z.infer<typeof dialerAgentCallSchema>;

/** The phone line's sample rate. */
export const DIALER_SAMPLE_RATE = 8000;
/** 20 ms of 8 kHz μ-law: one byte per sample. */
export const DIALER_FRAME_BYTES = 160;

export const DIALER_STATUSES = ['ringing', 'answered', 'ended'] as const;
export type DialerStatus = (typeof DIALER_STATUSES)[number];

/** Why a dialer call ended, as the server tells the page. */
export const DIALER_END_REASONS = [
  'hangup',
  'remote_hangup',
  'no_answer',
  'busy',
  'failed',
  'canceled',
  'timeout',
  'time_limit',
  'error',
] as const;
export type DialerEndReason = (typeof DIALER_END_REASONS)[number];

export const DIALER_END_REASON_LABELS: Record<DialerEndReason, string> = {
  hangup: 'Call ended',
  remote_hangup: 'They hung up',
  no_answer: 'No answer',
  busy: 'The line is busy',
  failed: "The call couldn't be connected",
  canceled: 'Call canceled',
  timeout: 'Nobody answered in time',
  time_limit: 'Calls can last up to an hour',
  error: 'The call dropped',
};

export type DialerServerMessage = {
  type: 'status';
  status: DialerStatus;
  reason?: DialerEndReason;
};
export type DialerClientMessage = { type: 'hangup' };

/** Keys on the dial pad. During a call they also send DTMF tones. */
export const DIALPAD_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'] as const;
export type DialpadKey = (typeof DIALPAD_KEYS)[number];

/** DTMF row and column frequencies (Hz) for each key. */
export const DTMF_FREQUENCIES: Record<DialpadKey, readonly [number, number]> = {
  '1': [697, 1209],
  '2': [697, 1336],
  '3': [697, 1477],
  '4': [770, 1209],
  '5': [770, 1336],
  '6': [770, 1477],
  '7': [852, 1209],
  '8': [852, 1336],
  '9': [852, 1477],
  '*': [941, 1209],
  '0': [941, 1336],
  '#': [941, 1477],
};

/**
 * What someone typed ("+1 (415) 555-0123", "0044 20 7946 0958") as E.164,
 * or null when it has no country code or is the wrong length.
 */
export function normalizeDialNumber(input: string): string | null {
  const trimmed = input.trim();
  let digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+')) {
    // already international
  } else if (digits.startsWith('00')) {
    digits = digits.slice(2);
  } else {
    return null;
  }
  const e = `+${digits}`;
  return /^\+[1-9]\d{6,14}$/.test(e) ? e : null;
}

/** A row in the dialer's recent calls. */
export interface DialerCallView {
  id: string;
  status: CallStatus;
  fromNumber: string;
  toNumber: string;
  durationSec: number;
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  endReason: string | null;
  placedBy: { id: string; name: string } | null;
  /** Set when an agent made the call; requestedBy is who asked it to. */
  agent: { id: string; name: string } | null;
  requestedBy: { id: string; name: string } | null;
}
