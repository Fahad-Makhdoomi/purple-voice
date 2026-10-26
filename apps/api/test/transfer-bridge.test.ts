import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TransferLeg,
  ringbackTone,
  type TransferDeps,
  type TransferTimings,
} from '../src/voice/transfer-bridge';
import type { MediaTransport } from '../src/voice/transports';
import { agentLeftCall } from '../src/voice/tools';

/** The person's media stream. Closing it fires stop, like the real transports do. */
class FakeTransport implements MediaTransport {
  private startCb?: (info: { streamId: string; providerCallId?: string }) => void;
  private audioCb?: (payload: string) => void;
  private stopCb?: () => void;
  sent: string[] = [];
  closed = false;
  onStart(cb: (info: { streamId: string; providerCallId?: string }) => void) {
    this.startCb = cb;
  }
  onAudio(cb: (payload: string) => void) {
    this.audioCb = cb;
  }
  onStop(cb: () => void) {
    this.stopCb = cb;
  }
  sendAudio(payload: string) {
    this.sent.push(payload);
  }
  clearAudio() {}
  close() {
    if (this.closed) return;
    this.closed = true;
    this.stopCb?.();
  }
  start(providerCallId?: string) {
    this.startCb?.({ streamId: 'MZ1', providerCallId });
  }
  audio(text: string) {
    this.audioCb?.(Buffer.from(text).toString('base64'));
  }
}

const TIMINGS: TransferTimings = { answerTimeoutMs: 40_000, toneTickMs: 100 };

function setup(dial: () => Promise<string> = async () => 'CA-leg') {
  const state = {
    toCaller: [] as string[],
    cleared: 0,
    hangups: [] as string[],
    personLeft: 0,
    recorded: [] as string[],
  };
  const deps: TransferDeps = {
    dial,
    hangup: async (id) => {
      state.hangups.push(id);
    },
    toCaller: (payload) => state.toCaller.push(payload),
    clearCaller: () => state.cleared++,
    onPersonAudio: (payload) => state.recorded.push(payload),
    onPersonLeft: () => state.personLeft++,
  };
  const leg = new TransferLeg('call1', '+919800000000', 'Call from Ava.', deps, TIMINGS);
  return { state, leg };
}

const decoded = (payloads: string[]) => payloads.map((p) => Buffer.from(p, 'base64').toString());

describe('transfer bridge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('rings the caller in real time until the person answers, then joins them', async () => {
    const { state, leg } = setup();
    const outcome = leg.connect();
    await vi.advanceTimersByTimeAsync(0);
    // About 100 ms of tone is queued ahead, then it keeps pace with the clock.
    const queued = () => state.toCaller.reduce((n, p) => n + Buffer.from(p, 'base64').length, 0);
    expect(queued()).toBe(800);
    await vi.advanceTimersByTimeAsync(1000);
    expect(queued()).toBe(8800);

    expect(leg.answered('CA-answered')).toBe(true);
    const person = new FakeTransport();
    leg.attach(person);
    person.start();
    await expect(outcome).resolves.toEqual({ connected: true });
    expect(leg.isConnected).toBe(true);
    expect(state.cleared).toBe(1);

    // No more tone; each side now hears the other.
    state.toCaller = [];
    await vi.advanceTimersByTimeAsync(1000);
    expect(state.toCaller).toHaveLength(0);
    person.audio('person');
    leg.fromCaller(Buffer.from('caller').toString('base64'));
    expect(decoded(state.toCaller)).toEqual(['person']);
    expect(decoded(state.recorded)).toEqual(['person']);
    expect(decoded(person.sent)).toEqual(['caller']);
  });

  it('keeps the caller audio from the person until they are connected', async () => {
    const { leg } = setup();
    void leg.connect();
    await vi.advanceTimersByTimeAsync(0);
    const person = new FakeTransport();
    leg.attach(person);
    leg.fromCaller(Buffer.from('early').toString('base64'));
    expect(person.sent).toHaveLength(0);
  });

  it('reports a busy line or no answer, without hanging up again', async () => {
    for (const [status, reason] of [
      ['BUSY', 'busy'],
      ['NO_ANSWER', 'no_answer'],
      ['CANCELED', 'no_answer'],
    ] as const) {
      const { state, leg } = setup();
      const outcome = leg.connect();
      await vi.advanceTimersByTimeAsync(0);
      leg.status('RINGING');
      leg.status(status);
      await expect(outcome).resolves.toEqual({ connected: false, reason });
      expect(state.hangups).toEqual([]);
      // The tone stops with it.
      const sent = state.toCaller.length;
      await vi.advanceTimersByTimeAsync(1000);
      expect(state.toCaller).toHaveLength(sent);
    }
  });

  it('gives up and cancels the call when nobody answers in time', async () => {
    const { state, leg } = setup();
    const outcome = leg.connect();
    await vi.advanceTimersByTimeAsync(40_000);
    await expect(outcome).resolves.toEqual({ connected: false, reason: 'timeout' });
    expect(state.hangups).toEqual(['CA-leg']);
    expect(leg.answered()).toBe(false);
  });

  it('passes on a carrier that refuses to place the call', async () => {
    const { leg } = setup(async () => {
      throw new Error('Geo permission not enabled for +91');
    });
    await expect(leg.connect()).rejects.toThrow('Geo permission');
  });

  it('hangs up on the person when the caller leaves, ringing or connected', async () => {
    const ringing = setup();
    const outcome = ringing.leg.connect();
    await vi.advanceTimersByTimeAsync(0);
    ringing.leg.end();
    await expect(outcome).resolves.toEqual({ connected: false, reason: 'caller_left' });
    expect(ringing.state.hangups).toEqual(['CA-leg']);

    const live = setup();
    void live.leg.connect();
    await vi.advanceTimersByTimeAsync(0);
    const person = new FakeTransport();
    live.leg.attach(person);
    person.start('CA-stream');
    live.leg.end();
    expect(person.closed).toBe(true);
    expect(live.state.hangups).toEqual(['CA-stream']);
    expect(live.state.personLeft).toBe(0);
  });

  it('tells the session when the person hangs up, once', async () => {
    const { state, leg } = setup();
    void leg.connect();
    await vi.advanceTimersByTimeAsync(0);
    const person = new FakeTransport();
    leg.attach(person);
    person.start();
    leg.status('COMPLETED');
    person.close();
    leg.end();
    expect(state.personLeft).toBe(1);
    expect(state.hangups).toEqual([]);
  });

  it('hangs up a person who answers after the caller has gone', async () => {
    const { state, leg } = setup();
    void leg.connect();
    await vi.advanceTimersByTimeAsync(0);
    leg.end();
    expect(leg.answered('CA-late')).toBe(false);
    const person = new FakeTransport();
    leg.attach(person);
    expect(person.closed).toBe(true);
    expect(state.hangups).toEqual(['CA-leg']);
  });
});

describe('ringing tone', () => {
  it('rings the local way: a double ring, or the North American one', () => {
    expect(ringbackTone(false)).toHaveLength(3 * 8000);
    expect(ringbackTone(true)).toHaveLength(6 * 8000);
    // Silent between rings (μ-law 0xff is zero).
    const tone = ringbackTone(false);
    expect(tone[Math.round(0.5 * 8000)]).toBe(0xff);
    expect(tone[Math.round(2 * 8000)]).toBe(0xff);
    expect(tone[101]).not.toBe(0xff);
  });
});

describe('after a hang-up or transfer', () => {
  it('only a hang-up or transfer that went through takes the agent off the call', () => {
    expect(agentLeftCall('transfer_call', 'Transferred.')).toBe(true);
    expect(agentLeftCall('end_call', 'Call ending.')).toBe(true);
    expect(agentLeftCall('transfer_call', 'Error: the transfer did not go through')).toBe(false);
    expect(agentLeftCall('check_availability', 'Open slots: …')).toBe(false);
  });
});
