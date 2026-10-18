import { describe, expect, it } from 'vitest';
import { campaignProgress } from '@pv/shared';
import { dialResultFor, nextRetryAt } from '../src/services/campaign-retry';
import { contactAfterCall } from '../src/services/calls';

const campaign = {
  timezone: 'UTC',
  callDays: [1, 2, 3, 4, 5],
  callWindowStart: '09:00',
  callWindowEnd: '18:00',
  retryStrategy: 'END_OF_LIST' as const,
  retryDelayMinutes: 60,
  retryWindowStart: null,
  retryWindowEnd: null,
  maxAttempts: 3,
  retryOn: ['NO_ANSWER', 'BUSY', 'VOICEMAIL', 'SILENT', 'FAILED'] as const,
};
const call = (status: string, extra: object = {}) =>
  ({ status, answeredAt: null, durationSec: 0, endReason: null, ...extra }) as never;

describe('campaign progress', () => {
  it('counts unanswered numbers waiting for a retry instead of stalling', () => {
    // 60 reached, 40 no answer after one pass, 2 retries allowed.
    const p = campaignProgress(
      [
        { status: 'COMPLETED', attempts: 1, count: 60 },
        { status: 'PENDING', attempts: 1, count: 40 },
      ],
      3,
      'RUNNING',
    );
    expect(p.firstPassDone).toBe(true);
    expect(p.waitingRetry).toBe(40);
    expect(p.retryRound).toBe(1);
    expect(p.percent).toBe(73);
  });

  it('is 100% once finished, flagged incomplete when numbers were never reached', () => {
    const p = campaignProgress(
      [
        { status: 'COMPLETED', attempts: 1, count: 8 },
        { status: 'NO_ANSWER', attempts: 3, count: 2 },
      ],
      3,
      'COMPLETED',
    );
    expect(p.percent).toBe(100);
    expect(p.incomplete).toBe(true);
    expect(p.unreached).toBe(2);
  });

  it('never shows 100% while numbers are still to be dialled', () => {
    const p = campaignProgress(
      [
        { status: 'COMPLETED', attempts: 1, count: 999 },
        { status: 'PENDING', attempts: 0, count: 1 },
      ],
      1,
      'RUNNING',
    );
    expect(p.percent).toBe(99);
  });
});

describe('campaign retries', () => {
  it('treats a connected call where nobody spoke as not reached', () => {
    expect(
      dialResultFor(call('COMPLETED', { answeredAt: new Date(), durationSec: 9 }), null, []),
    ).toBe('SILENT');
    expect(
      dialResultFor(call('COMPLETED', { answeredAt: new Date(), durationSec: 40 }), 'OTHER', [
        { role: 'caller', text: 'Hello?', at: '' },
      ]),
    ).toBe('REACHED');
    expect(dialResultFor(call('BUSY'), null, [])).toBe('BUSY');
  });

  it('retries until the limit, then marks the number not reached', () => {
    const c = { ...campaign, retryOn: [...campaign.retryOn] };
    expect(contactAfterCall({ attempts: 1 }, c, 'NO_ANSWER', null).status).toBe('PENDING');
    expect(contactAfterCall({ attempts: 3 }, c, 'NO_ANSWER', null)).toEqual({
      status: 'NO_ANSWER',
      nextAttemptAt: null,
    });
    expect(contactAfterCall({ attempts: 1 }, c, 'FAILED', null).status).toBe('PENDING');
    expect(contactAfterCall({ attempts: 1 }, c, 'SILENT', 'DO_NOT_CALL').status).toBe(
      'DO_NOT_CALL',
    );
    expect(contactAfterCall({ attempts: 1 }, { ...c, retryOn: [] }, 'BUSY', null).status).toBe(
      'NO_ANSWER',
    );
  });

  it('schedules next-day retries at the start of the next calling day', () => {
    // Friday 2026-10-16 15:00 UTC → Monday 09:00.
    const at = nextRetryAt(
      { ...campaign, retryStrategy: 'NEXT_DAY' },
      new Date('2026-10-16T15:00:00Z'),
    );
    expect(at.toISOString()).toBe('2026-10-19T09:00:00.000Z');
  });
});
