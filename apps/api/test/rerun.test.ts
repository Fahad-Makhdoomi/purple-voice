import { describe, expect, it } from 'vitest';
import { rerunTargetOf } from '@pv/shared';

describe('rerunTargetOf', () => {
  it('splits no-answer, voicemail and failed calls', () => {
    expect(rerunTargetOf({ status: 'NO_ANSWER', lastOutcome: null })).toBe('NO_ANSWER');
    expect(rerunTargetOf({ status: 'NO_ANSWER', lastOutcome: 'VOICEMAIL' })).toBe('VOICEMAIL');
    expect(rerunTargetOf({ status: 'FAILED', lastOutcome: null })).toBe('FAILED');
  });
  it('never re-queues do-not-call, wrong numbers or contacts still in play', () => {
    expect(rerunTargetOf({ status: 'DO_NOT_CALL', lastOutcome: null })).toBeNull();
    expect(rerunTargetOf({ status: 'COMPLETED', lastOutcome: 'WRONG_NUMBER' })).toBeNull();
    expect(rerunTargetOf({ status: 'PENDING', lastOutcome: null })).toBeNull();
    expect(rerunTargetOf({ status: 'CALLING', lastOutcome: null })).toBeNull();
  });
  it('uses the outcome for answered calls', () => {
    expect(rerunTargetOf({ status: 'COMPLETED', lastOutcome: 'CALLBACK_REQUESTED' })).toBe(
      'CALLBACK_REQUESTED',
    );
    expect(rerunTargetOf({ status: 'COMPLETED', lastOutcome: 'APPOINTMENT_BOOKED' })).toBeNull();
  });
});
