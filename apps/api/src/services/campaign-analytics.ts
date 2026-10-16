import { FOLLOW_UP_SEGMENTS, followUpSegmentOf, type FollowUpSegment } from '@pv/shared';
import type { CallOutcome, CallStatus, ContactStatus } from '@prisma/client';
import { isValidTimeZone, utcToZoned } from '../voice/time';

export interface AnalyticsContact {
  id: string;
  status: ContactStatus;
  attempts: number;
  lastOutcome: CallOutcome | null;
}

export interface AnalyticsCall {
  contactId: string | null;
  status: CallStatus;
  createdAt: Date;
  startedAt: Date | null;
  answeredAt: Date | null;
  durationSec: number;
  billedMinutes: number;
  outcome: CallOutcome | null;
  sentiment: number | null;
}

export interface CampaignAnalytics {
  totals: {
    contacts: number;
    called: number;
    reached: number;
    calls: number;
    answeredCalls: number;
    minutes: number;
    avgDurationSec: number;
    avgSentiment: number | null;
  };
  /** Percentages, 0–100, rounded to one decimal; null when there is nothing to divide by. */
  rates: {
    contactRate: number | null;
    answerRate: number | null;
    positiveRate: number | null;
    appointmentRate: number | null;
  };
  funnel: Array<{ key: string; label: string; count: number }>;
  outcomes: Record<string, number>;
  contactStatuses: Record<string, number>;
  callStatuses: Record<string, number>;
  sentiment: { positive: number; neutral: number; negative: number; unscored: number };
  /** Contacts by how many calls it took, and how many of them were reached. */
  attempts: Array<{ attempts: number; contacts: number; reached: number }>;
  byHour: Array<{ hour: number; calls: number; answered: number }>;
  byDay: Array<{ date: string; calls: number; answered: number }>;
  durationBuckets: Array<{ label: string; calls: number }>;
  segments: Record<FollowUpSegment, number>;
}

const pct = (n: number, d: number): number | null => (d ? Math.round((n / d) * 1000) / 10 : null);

/** A person picked up: the line was answered and it was not a voicemail greeting. */
export function wasReached(call: Pick<AnalyticsCall, 'answeredAt' | 'outcome'>): boolean {
  return call.answeredAt !== null && call.outcome !== 'VOICEMAIL';
}

const DURATION_BUCKETS: Array<[string, number, number]> = [
  ['Under 15s', 0, 15],
  ['15–30s', 15, 30],
  ['30s–1m', 30, 60],
  ['1–2m', 60, 120],
  ['2–5m', 120, 300],
  ['Over 5m', 300, Infinity],
];

/** Everything the campaign Analytics tab and the AI report are built from; pure so it can be tested. */
export function computeCampaignAnalytics(
  contacts: AnalyticsContact[],
  calls: AnalyticsCall[],
  timezone: string,
): CampaignAnalytics {
  const tz = isValidTimeZone(timezone) ? timezone : 'UTC';
  const reachedContacts = new Set<string>();
  const outcomes: Record<string, number> = {};
  const callStatuses: Record<string, number> = {};
  const sentiment = { positive: 0, neutral: 0, negative: 0, unscored: 0 };
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, calls: 0, answered: 0 }));
  const days = new Map<string, { calls: number; answered: number }>();
  const buckets = DURATION_BUCKETS.map(([label]) => ({ label, calls: 0 }));

  let answeredCalls = 0;
  let minutes = 0;
  let answeredSeconds = 0;
  let sentimentSum = 0;
  let sentimentCount = 0;

  for (const call of calls) {
    callStatuses[call.status] = (callStatuses[call.status] ?? 0) + 1;
    minutes += call.billedMinutes;
    const reached = wasReached(call);
    if (call.answeredAt) {
      answeredCalls++;
      answeredSeconds += call.durationSec;
      const i = DURATION_BUCKETS.findIndex(
        ([, lo, hi]) => call.durationSec >= lo && call.durationSec < hi,
      );
      if (i >= 0) buckets[i]!.calls++;
    }
    if (reached && call.contactId) reachedContacts.add(call.contactId);
    if (call.outcome) outcomes[call.outcome] = (outcomes[call.outcome] ?? 0) + 1;

    if (reached) {
      if (call.sentiment === null) sentiment.unscored++;
      else {
        sentimentSum += call.sentiment;
        sentimentCount++;
        if (call.sentiment > 0.25) sentiment.positive++;
        else if (call.sentiment < -0.25) sentiment.negative++;
        else sentiment.neutral++;
      }
    }

    const local = utcToZoned(call.startedAt ?? call.createdAt, tz);
    const hour = hours[Number(local.time.slice(0, 2))];
    if (hour) {
      hour.calls++;
      if (reached) hour.answered++;
    }
    const day = days.get(local.date) ?? { calls: 0, answered: 0 };
    day.calls++;
    if (reached) day.answered++;
    days.set(local.date, day);
  }

  const contactStatuses: Record<string, number> = {};
  const segments = Object.fromEntries(FOLLOW_UP_SEGMENTS.map((s) => [s, 0])) as Record<
    FollowUpSegment,
    number
  >;
  const attemptRows = new Map<number, { contacts: number; reached: number }>();
  let called = 0;
  let positive = 0;
  let appointments = 0;
  for (const c of contacts) {
    contactStatuses[c.status] = (contactStatuses[c.status] ?? 0) + 1;
    const segment = followUpSegmentOf(c);
    if (segment) segments[segment]++;
    if (c.attempts > 0) {
      called++;
      const row = attemptRows.get(c.attempts) ?? { contacts: 0, reached: 0 };
      row.contacts++;
      if (reachedContacts.has(c.id)) row.reached++;
      attemptRows.set(c.attempts, row);
    }
    if (c.lastOutcome === 'APPOINTMENT_BOOKED') appointments++;
    if (
      c.lastOutcome === 'APPOINTMENT_BOOKED' ||
      c.lastOutcome === 'INTERESTED' ||
      c.lastOutcome === 'CALLBACK_REQUESTED' ||
      c.lastOutcome === 'TRANSFERRED'
    )
      positive++;
  }

  const reached = reachedContacts.size;
  return {
    totals: {
      contacts: contacts.length,
      called,
      reached,
      calls: calls.length,
      answeredCalls,
      minutes,
      avgDurationSec: answeredCalls ? Math.round(answeredSeconds / answeredCalls) : 0,
      avgSentiment: sentimentCount ? Math.round((sentimentSum / sentimentCount) * 100) / 100 : null,
    },
    rates: {
      contactRate: pct(reached, called),
      answerRate: pct(answeredCalls, calls.length),
      positiveRate: pct(positive, reached),
      appointmentRate: pct(appointments, reached),
    },
    funnel: [
      { key: 'contacts', label: 'On the list', count: contacts.length },
      { key: 'called', label: 'Called', count: called },
      { key: 'reached', label: 'Spoke to a person', count: reached },
      { key: 'positive', label: 'Interested or next step', count: positive },
      { key: 'appointments', label: 'Booked an appointment', count: appointments },
    ],
    outcomes,
    contactStatuses,
    callStatuses,
    sentiment,
    attempts: [...attemptRows.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([n, v]) => ({ attempts: n, ...v })),
    byHour: hours.filter((h) => h.calls > 0),
    byDay: [...days.entries()].sort().map(([date, v]) => ({ date, ...v })),
    durationBuckets: buckets,
    segments,
  };
}
