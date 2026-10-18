import type { Call, CallOutcome, Campaign, DialResult } from '@prisma/client';
import type { TranscriptLine } from './ai/summarize';
import { isValidTimeZone, utcToZoned, zonedToUtc } from '../voice/time';

/**
 * Campaign retries: what a finished call amounted to for the person on the
 * list, whether they are worth another call, and when.
 */

/**
 * Whether the call reached a person and, if not, why. A call the carrier
 * reports as answered but where the caller never said a word (and the AI
 * found nothing to act on) is SILENT: usually a voicemail box or a line
 * picked up and dropped, so it is retried like a missed call.
 */
export function dialResultFor(
  call: Pick<Call, 'status' | 'answeredAt' | 'durationSec' | 'endReason'>,
  outcome: CallOutcome | null,
  transcript: TranscriptLine[],
): DialResult {
  if (outcome === 'VOICEMAIL') return 'VOICEMAIL';
  if (call.status === 'BUSY') return 'BUSY';
  if (call.status === 'NO_ANSWER') return 'NO_ANSWER';
  if (call.status === 'FAILED') return 'FAILED';
  // Canceled before anyone answered (force-ended while ringing): not reached.
  if (call.status === 'CANCELED') return call.answeredAt ? 'SILENT' : 'NO_ANSWER';
  // Booked or handed over: someone was certainly there, whatever the transcript holds.
  if (
    call.status === 'TRANSFERRED' ||
    outcome === 'APPOINTMENT_BOOKED' ||
    outcome === 'TRANSFERRED'
  )
    return 'REACHED';
  // Otherwise trust the transcript over the AI's reading of a one-sided call.
  const callerSpoke = transcript.some((l) => l.role === 'caller' && l.text.trim().length > 0);
  if (!callerSpoke) return call.answeredAt || call.durationSec > 0 ? 'SILENT' : 'NO_ANSWER';
  return 'REACHED';
}

type RetryCampaign = Pick<
  Campaign,
  | 'timezone'
  | 'callDays'
  | 'callWindowStart'
  | 'callWindowEnd'
  | 'retryStrategy'
  | 'retryDelayMinutes'
  | 'retryWindowStart'
  | 'retryWindowEnd'
>;

const zoneOf = (tz: string) => (isValidTimeZone(tz) ? tz : 'UTC');

/** Whether `now` is inside [start, end) on one of `days`, in `timeZone`. */
export function withinWindow(
  days: number[],
  start: string,
  end: string,
  timeZone: string,
  now = new Date(),
): boolean {
  const local = utcToZoned(now, zoneOf(timeZone));
  return days.includes(local.weekday) && local.time >= start && local.time < end;
}

/** The hours retries may be placed in: the retry window if set, else the call window. */
export function retryHours(c: RetryCampaign): { start: string; end: string } {
  return c.retryWindowStart && c.retryWindowEnd
    ? { start: c.retryWindowStart, end: c.retryWindowEnd }
    : { start: c.callWindowStart, end: c.callWindowEnd };
}

/** Start of retry hours on the next calling day after `now`'s local date. */
export function nextCallingDayStart(c: RetryCampaign, now = new Date()): Date {
  const tz = zoneOf(c.timezone);
  const { start } = retryHours(c);
  const today = utcToZoned(now, tz).date;
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  for (let i = 1; i <= 14; i++) {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    const date = day.toISOString().slice(0, 10);
    if (c.callDays.includes(day.getUTCDay())) return zonedToUtc(date, start, tz);
  }
  return new Date(now.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * When a number that was not reached may be called again. Every strategy
 * waits at least `retryDelayMinutes`; NEXT_DAY also waits for the next
 * calling day. The dialer then only places it inside the retry hours.
 */
export function nextRetryAt(c: RetryCampaign, now = new Date()): Date {
  const gap = new Date(now.getTime() + c.retryDelayMinutes * 60_000);
  if (c.retryStrategy !== 'NEXT_DAY') return gap;
  const nextDay = nextCallingDayStart(c, now);
  return nextDay > gap ? nextDay : gap;
}
