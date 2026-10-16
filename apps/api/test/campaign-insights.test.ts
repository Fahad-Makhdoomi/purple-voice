import { describe, expect, it } from 'vitest';
import { followUpSegmentOf, matchesFollowUp, parseTags, followUpSchema } from '@pv/shared';
import { computeCampaignAnalytics, wasReached } from '../src/services/campaign-analytics';
import { buildCampaignDigest } from '../src/services/ai/campaign-report';

const contact = (
  status: Parameters<typeof followUpSegmentOf>[0]['status'],
  lastOutcome: Parameters<typeof followUpSegmentOf>[0]['lastOutcome'] = null,
  tags: string[] = [],
) => ({ status, lastOutcome, tags });

describe('follow-up groups', () => {
  it('sorts contacts by what happened on their calls', () => {
    expect(followUpSegmentOf(contact('NO_ANSWER'))).toBe('NOT_ANSWERED');
    expect(followUpSegmentOf(contact('FAILED'))).toBe('NOT_ANSWERED');
    expect(followUpSegmentOf(contact('COMPLETED', 'VOICEMAIL'))).toBe('NOT_ANSWERED');
    expect(followUpSegmentOf(contact('PENDING'))).toBe('NOT_CALLED');
    expect(followUpSegmentOf(contact('COMPLETED', 'APPOINTMENT_BOOKED'))).toBe(
      'APPOINTMENT_BOOKED',
    );
    expect(followUpSegmentOf(contact('COMPLETED', 'CALLBACK_REQUESTED'))).toBe(
      'CALLBACK_REQUESTED',
    );
    expect(followUpSegmentOf(contact('COMPLETED', 'INTERESTED'))).toBe('INTERESTED');
    expect(followUpSegmentOf(contact('COMPLETED', 'NOT_INTERESTED'))).toBe('NOT_INTERESTED');
    expect(followUpSegmentOf(contact('COMPLETED', 'OTHER'))).toBeNull();
  });

  it('never calls do-not-call or wrong-number contacts again', () => {
    expect(followUpSegmentOf(contact('DO_NOT_CALL'))).toBeNull();
    expect(followUpSegmentOf(contact('COMPLETED', 'DO_NOT_CALL'))).toBeNull();
    expect(followUpSegmentOf(contact('COMPLETED', 'WRONG_NUMBER'))).toBeNull();
    expect(followUpSegmentOf(contact('NO_ANSWER', 'DO_NOT_CALL'))).toBeNull();
  });

  it('combines groups and tags', () => {
    const vip = contact('NO_ANSWER', null, ['vip']);
    const other = contact('NO_ANSWER', null, ['cold']);
    expect(matchesFollowUp(vip, ['NOT_ANSWERED'], [])).toBe(true);
    expect(matchesFollowUp(other, ['NOT_ANSWERED'], ['vip'])).toBe(false);
    expect(matchesFollowUp(vip, ['INTERESTED'], [])).toBe(false);
    // Tags alone select across every group, but still skip do-not-call.
    expect(matchesFollowUp(vip, [], ['vip'])).toBe(true);
    expect(matchesFollowUp(contact('DO_NOT_CALL', null, ['vip']), [], ['vip'])).toBe(false);
  });

  it('cleans tags from a CSV cell', () => {
    expect(parseTags('VIP; Webinar 2026, vip |  ')).toEqual(['vip', 'webinar-2026']);
    expect(parseTags(undefined)).toEqual([]);
  });

  it('needs a group or a tag to build a follow-up', () => {
    expect(followUpSchema.safeParse({ name: 'Re-call', segments: [], tags: [] }).success).toBe(
      false,
    );
    const ok = followUpSchema.parse({ name: 'Re-call', segments: ['NOT_ANSWERED'] });
    expect(ok.tags).toEqual([]);
  });
});

describe('campaign analytics', () => {
  const at = (iso: string) => new Date(iso);
  const call = (over: Partial<Parameters<typeof computeCampaignAnalytics>[1][number]>) => ({
    contactId: 'a',
    status: 'COMPLETED' as const,
    createdAt: at('2026-10-12T14:00:00Z'),
    startedAt: at('2026-10-12T14:00:00Z'),
    answeredAt: at('2026-10-12T14:00:05Z'),
    durationSec: 60,
    billedMinutes: 1,
    outcome: 'INTERESTED' as const,
    sentiment: 0.6,
    ...over,
  });

  it('does not count voicemail as speaking to a person', () => {
    expect(wasReached({ answeredAt: new Date(), outcome: 'VOICEMAIL' })).toBe(false);
    expect(wasReached({ answeredAt: null, outcome: null })).toBe(false);
    expect(wasReached({ answeredAt: new Date(), outcome: 'INTERESTED' })).toBe(true);
  });

  it('measures the funnel, rates, hours in the campaign time zone and attempts', () => {
    const contacts = [
      {
        id: 'a',
        status: 'COMPLETED' as const,
        attempts: 1,
        lastOutcome: 'APPOINTMENT_BOOKED' as const,
      },
      { id: 'b', status: 'NO_ANSWER' as const, attempts: 2, lastOutcome: null },
      { id: 'c', status: 'PENDING' as const, attempts: 0, lastOutcome: null },
      { id: 'd', status: 'DO_NOT_CALL' as const, attempts: 1, lastOutcome: 'DO_NOT_CALL' as const },
    ];
    const calls = [
      call({ outcome: 'APPOINTMENT_BOOKED', sentiment: 0.9, durationSec: 150, billedMinutes: 3 }),
      call({
        contactId: 'b',
        status: 'NO_ANSWER',
        answeredAt: null,
        durationSec: 0,
        billedMinutes: 0,
        outcome: null,
        sentiment: null,
      }),
      call({
        contactId: 'b',
        status: 'NO_ANSWER',
        answeredAt: null,
        durationSec: 0,
        billedMinutes: 0,
        outcome: null,
        sentiment: null,
      }),
      call({
        contactId: 'd',
        outcome: 'DO_NOT_CALL',
        sentiment: -0.8,
        durationSec: 20,
        billedMinutes: 1,
      }),
    ];
    // 14:00 UTC is 10:00 in New York (EDT).
    const a = computeCampaignAnalytics(contacts, calls, 'America/New_York');

    expect(a.totals).toMatchObject({
      contacts: 4,
      called: 3,
      reached: 2,
      calls: 4,
      answeredCalls: 2,
      minutes: 4,
    });
    expect(a.funnel.map((f) => f.count)).toEqual([4, 3, 2, 1, 1]);
    expect(a.rates.contactRate).toBe(66.7);
    expect(a.rates.answerRate).toBe(50);
    expect(a.rates.appointmentRate).toBe(50);
    expect(a.outcomes).toEqual({ APPOINTMENT_BOOKED: 1, DO_NOT_CALL: 1 });
    expect(a.sentiment).toMatchObject({ positive: 1, negative: 1, neutral: 0 });
    expect(a.byHour).toEqual([{ hour: 10, calls: 4, answered: 2 }]);
    expect(a.byDay).toEqual([{ date: '2026-10-12', calls: 4, answered: 2 }]);
    expect(a.attempts).toEqual([
      { attempts: 1, contacts: 2, reached: 2 },
      { attempts: 2, contacts: 1, reached: 0 },
    ]);
    expect(a.segments).toMatchObject({ APPOINTMENT_BOOKED: 1, NOT_ANSWERED: 1, NOT_CALLED: 1 });
  });

  it('copes with an empty campaign and a bad time zone', () => {
    const a = computeCampaignAnalytics([], [], 'Not/AZone');
    expect(a.totals.calls).toBe(0);
    expect(a.rates.contactRate).toBeNull();
    expect(a.totals.avgSentiment).toBeNull();
  });

  it('writes a digest an AI can read', () => {
    const analytics = computeCampaignAnalytics([], [call({})], 'UTC');
    const text = buildCampaignDigest({
      campaign: {
        name: 'October leads',
        status: 'COMPLETED',
        goal: 'Book demos',
        timezone: 'UTC',
        callWindowStart: '09:00',
        callWindowEnd: '18:00',
        maxAttempts: 2,
        retryDelayMinutes: 240,
        startedAt: at('2026-10-12T00:00:00Z'),
        completedAt: at('2026-10-14T00:00:00Z'),
      },
      agent: { name: 'Mia', goal: 'Book demos', systemPrompt: 'You are Mia.', greeting: 'Hi!' },
      analytics,
      samples: [
        { outcome: 'INTERESTED', sentiment: 0.6, durationSec: 60, summary: 'Wants pricing.' },
      ],
    });
    expect(text).toContain('# Campaign report: October leads');
    expect(text).toContain('You are Mia.');
    expect(text).toContain('INTERESTED: 1');
    expect(text).toContain('Wants pricing.');
  });
});
