import { EventEmitter } from 'node:events';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DIALER_FRAME_BYTES,
  DTMF_FREQUENCIES,
  dialerCallSchema,
  normalizeDialNumber,
  type CallStatus,
  type DialerEndReason,
} from '@pv/shared';
import {
  DialerRegistry,
  endReasonFor,
  type BridgeDeps,
  type BridgeTimings,
} from '../src/voice/dialer-bridge';
import type { MediaTransport } from '../src/voice/transports';
import { attachMediaServer } from '../src/voice/media-server';
import { mulawDecode, mulawEncode } from '../src/voice/audio';
import { signSubject, verifySubject } from '../src/lib/signed-url';
import { signAccessToken } from '../src/lib/jwt';
import { prisma } from '../src/lib/prisma';

// The media-server test below runs real sockets against these in-memory call rows.
vi.mock('../src/lib/prisma', () => ({
  prisma: { call: { findUnique: vi.fn(), updateMany: vi.fn(async () => ({ count: 1 })) } },
}));
vi.mock('../src/events', () => ({ emitEvent: vi.fn(async () => undefined) }));

// ── Fakes ───────────────────────────────────────────────────────────────────

/** The browser's WebSocket as the bridge sees it. */
class FakeSocket extends EventEmitter {
  readyState = 1;
  sent: Array<Buffer | string> = [];
  closeCode?: number;
  send(data: Buffer | string) {
    this.sent.push(data);
  }
  close(code = 1000) {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.closeCode = code;
    this.emit('close');
  }
  /** The browser sends something. */
  say(data: Buffer | string) {
    this.emit('message', Buffer.isBuffer(data) ? data : Buffer.from(data), Buffer.isBuffer(data));
  }
  statuses() {
    return this.sent
      .filter((d): d is string => typeof d === 'string')
      .map((d) => JSON.parse(d) as { type: string; status: string; reason?: string });
  }
  audio() {
    return this.sent.filter((d): d is Buffer => Buffer.isBuffer(d));
  }
}

/** The carrier's media stream. Closing it fires stop, like the real transports do. */
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
  start() {
    this.startCb?.({ streamId: 'MZ1' });
  }
  audio(bytes: Buffer) {
    this.audioCb?.(bytes.toString('base64'));
  }
  stop() {
    this.stopCb?.();
  }
}

const TIMINGS: BridgeTimings = {
  pollMs: 2_000,
  ringTimeoutMs: 60_000,
  browserTimeoutMs: 10_000,
  maxCallMs: 600_000,
  tombstoneMs: 30_000,
};

function setup(initial: CallStatus = 'RINGING') {
  const state = {
    status: initial as CallStatus | null,
    hangups: 0,
    answered: 0,
    ended: [] as DialerEndReason[],
  };
  const deps: BridgeDeps = {
    callStatus: async () => state.status,
    hangup: async () => {
      state.hangups++;
    },
    onAnswered: () => {
      state.answered++;
    },
    onEnded: (reason) => {
      state.ended.push(reason);
    },
  };
  const registry = new DialerRegistry(() => deps, TIMINGS);
  return { state, registry, bridge: registry.open('call1') };
}

// ── The bridge ──────────────────────────────────────────────────────────────

describe('dialer bridge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('pairs a browser that arrives first with the carrier stream on answer', () => {
    const { bridge, state } = setup();
    const browser = new FakeSocket();
    const carrier = new FakeTransport();

    bridge.attachBrowser(browser);
    expect(browser.statuses()).toEqual([{ type: 'status', status: 'ringing' }]);

    // The browser's frames are dropped until the carrier's stream has started.
    browser.say(Buffer.alloc(DIALER_FRAME_BYTES, 0xff));
    bridge.attachCarrier(carrier);
    browser.say(Buffer.alloc(DIALER_FRAME_BYTES, 0xff));
    expect(carrier.sent).toHaveLength(0);

    carrier.start();
    expect(browser.statuses().at(-1)).toEqual({ type: 'status', status: 'answered' });
    expect(state.answered).toBe(1);

    // Carrier → browser as binary, browser → carrier as base64, bytes untouched.
    const line = Buffer.from([0x00, 0x7f, 0x80, 0xff]);
    carrier.audio(line);
    expect(browser.audio()).toEqual([line]);
    const mic = Buffer.alloc(DIALER_FRAME_BYTES, 0x55);
    browser.say(mic);
    expect(carrier.sent).toEqual([mic.toString('base64')]);
  });

  it('tells a browser that arrives after the answer that the call is live', () => {
    const { bridge } = setup();
    const carrier = new FakeTransport();
    bridge.attachCarrier(carrier);
    carrier.start();

    const browser = new FakeSocket();
    bridge.attachBrowser(browser);
    expect(browser.statuses()).toEqual([{ type: 'status', status: 'answered' }]);

    // Joining in time cancels the "browser never came" hangup.
    vi.advanceTimersByTime(TIMINGS.browserTimeoutMs * 2);
    expect(bridge.isEnded).toBe(false);
  });

  it('hangs up when the callee answers but the browser never joins', async () => {
    const { bridge, state } = setup();
    const carrier = new FakeTransport();
    bridge.attachCarrier(carrier);
    carrier.start();

    await vi.advanceTimersByTimeAsync(TIMINGS.browserTimeoutMs);
    expect(bridge.isEnded).toBe(true);
    expect(state.hangups).toBe(1);
    expect(carrier.closed).toBe(true);
  });

  it('hangs up the carrier when the browser sends hangup', async () => {
    const { bridge, state } = setup();
    const browser = new FakeSocket();
    const carrier = new FakeTransport();
    bridge.attachBrowser(browser);
    bridge.attachCarrier(carrier);
    carrier.start();

    browser.say(JSON.stringify({ type: 'hangup' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(state.hangups).toBe(1);
    expect(browser.statuses().at(-1)).toEqual({
      type: 'status',
      status: 'ended',
      reason: 'hangup',
    });
    expect(browser.closeCode).toBe(1000);
    expect(carrier.closed).toBe(true);
    expect(state.ended).toEqual(['hangup']);
  });

  it('hangs up the carrier when the browser goes away mid-call', async () => {
    const { bridge, state } = setup();
    const browser = new FakeSocket();
    const carrier = new FakeTransport();
    bridge.attachBrowser(browser);
    bridge.attachCarrier(carrier);
    carrier.start();

    browser.close(1006);
    await vi.advanceTimersByTimeAsync(0);
    expect(state.hangups).toBe(1);
    expect(carrier.closed).toBe(true);
    expect(bridge.isEnded).toBe(true);
  });

  it('cancels the call when the browser goes away while it rings', async () => {
    const { bridge, state } = setup();
    const browser = new FakeSocket();
    bridge.attachBrowser(browser);
    browser.close(1001);
    await vi.advanceTimersByTimeAsync(0);
    expect(state.hangups).toBe(1);
    expect(state.ended).toEqual(['hangup']);
  });

  it('tells the browser when the other side hangs up, without hanging up again', () => {
    const { bridge, state } = setup();
    const browser = new FakeSocket();
    const carrier = new FakeTransport();
    bridge.attachBrowser(browser);
    bridge.attachCarrier(carrier);
    carrier.start();

    carrier.stop();
    expect(browser.statuses().at(-1)).toEqual({
      type: 'status',
      status: 'ended',
      reason: 'remote_hangup',
    });
    expect(browser.readyState).toBe(3);
    expect(state.hangups).toBe(0);
    expect(state.ended).toEqual(['remote_hangup']);
  });

  it('ends the wait when the call is never answered', async () => {
    const { bridge, state } = setup();
    const browser = new FakeSocket();
    bridge.attachBrowser(browser);

    await vi.advanceTimersByTimeAsync(TIMINGS.pollMs);
    expect(bridge.isEnded).toBe(false);

    state.status = 'BUSY';
    await vi.advanceTimersByTimeAsync(TIMINGS.pollMs);
    expect(browser.statuses().at(-1)).toEqual({ type: 'status', status: 'ended', reason: 'busy' });
    expect(state.hangups).toBe(0);
  });

  it('gives up on a call that rings too long', async () => {
    const { bridge, state } = setup();
    bridge.attachBrowser(new FakeSocket());
    await vi.advanceTimersByTimeAsync(TIMINGS.ringTimeoutMs);
    expect(bridge.endReason).toBe('timeout');
    expect(state.hangups).toBe(1);
  });

  it('ends calls that reach the time limit', async () => {
    const { bridge, state } = setup();
    const carrier = new FakeTransport();
    bridge.attachBrowser(new FakeSocket());
    bridge.attachCarrier(carrier);
    carrier.start();
    state.status = 'IN_PROGRESS';
    await vi.advanceTimersByTimeAsync(TIMINGS.maxCallMs);
    expect(bridge.endReason).toBe('time_limit');
    expect(state.hangups).toBe(1);
  });

  it('keeps the first browser and refuses a second one', () => {
    const { bridge } = setup();
    const first = new FakeSocket();
    const second = new FakeSocket();
    const carrier = new FakeTransport();
    bridge.attachBrowser(first);
    bridge.attachBrowser(second);
    expect(second.closeCode).toBe(4009);
    expect(bridge.isEnded).toBe(false);

    bridge.attachCarrier(carrier);
    carrier.start();
    carrier.audio(Buffer.from([1, 2, 3]));
    expect(first.audio()).toHaveLength(1);
    expect(second.audio()).toHaveLength(0);
  });

  it('ignores oversized frames and stray text', () => {
    const { bridge } = setup();
    const browser = new FakeSocket();
    const carrier = new FakeTransport();
    bridge.attachBrowser(browser);
    bridge.attachCarrier(carrier);
    carrier.start();

    browser.say(Buffer.alloc(64 * 1024));
    browser.say('not json');
    browser.say(JSON.stringify({ type: 'dance' }));
    expect(carrier.sent).toHaveLength(0);
    expect(bridge.isEnded).toBe(false);
  });

  it('answers late sockets for an ended call with "ended", then forgets it', async () => {
    const { bridge, registry } = setup();
    bridge.attachBrowser(new FakeSocket());
    await bridge.hangup('hangup');

    const late = new FakeSocket();
    registry.open('call1').attachBrowser(late);
    expect(late.statuses()).toEqual([{ type: 'status', status: 'ended', reason: 'hangup' }]);
    expect(late.readyState).toBe(3);

    const carrier = new FakeTransport();
    registry.open('call1').attachCarrier(carrier);
    expect(carrier.closed).toBe(true);
    expect(registry.liveCount).toBe(0);

    await vi.advanceTimersByTimeAsync(TIMINGS.tombstoneMs);
    expect(registry.get('call1')).toBeUndefined();
  });

  it('hangs up only once, whoever ends the call', async () => {
    const { bridge, state } = setup();
    const browser = new FakeSocket();
    bridge.attachBrowser(browser);
    await Promise.all([bridge.hangup('hangup'), bridge.hangup('timeout')]);
    browser.close();
    await vi.advanceTimersByTimeAsync(TIMINGS.ringTimeoutMs);
    expect(state.hangups).toBe(1);
    expect(state.ended).toEqual(['hangup']);
  });

  it('reports registry opens and closes for the shutdown count', async () => {
    const { registry } = setup();
    const opened: string[] = [];
    const closed: string[] = [];
    registry.hooks.opened = (b) => opened.push(b.callId);
    registry.hooks.closed = (b) => closed.push(b.callId);
    const bridge = registry.open('call2');
    expect(registry.open('call2')).toBe(bridge);
    expect(registry.liveCount).toBe(2);
    await bridge.hangup();
    expect(opened).toEqual(['call2']);
    expect(closed).toEqual(['call2']);
  });

  it('maps final call statuses to what the browser is told', () => {
    expect(endReasonFor('NO_ANSWER', false)).toBe('no_answer');
    expect(endReasonFor('BUSY', false)).toBe('busy');
    expect(endReasonFor('FAILED', false)).toBe('failed');
    expect(endReasonFor('CANCELED', false)).toBe('canceled');
    expect(endReasonFor('COMPLETED', true)).toBe('remote_hangup');
    expect(endReasonFor('COMPLETED', false)).toBe('failed');
  });
});

// ── Requests and signatures ─────────────────────────────────────────────────

describe('dialer requests', () => {
  it('accepts E.164 numbers only', () => {
    expect(dialerCallSchema.safeParse({ phoneNumberId: 'pn1', to: '+14155550123' }).success).toBe(
      true,
    );
    expect(dialerCallSchema.safeParse({ phoneNumberId: 'pn1', to: '4155550123' }).success).toBe(
      false,
    );
    expect(dialerCallSchema.safeParse({ phoneNumberId: '', to: '+14155550123' }).success).toBe(
      false,
    );
  });

  it('normalises what people type', () => {
    expect(normalizeDialNumber('+1 (415) 555-0123')).toBe('+14155550123');
    expect(normalizeDialNumber('0044 20 7946 0958')).toBe('+442079460958');
    expect(normalizeDialNumber('415 555 0123')).toBeNull();
    expect(normalizeDialNumber('+0123456789')).toBeNull();
    expect(normalizeDialNumber('+1')).toBeNull();
  });

  it('signs the browser socket separately from the carrier stream', () => {
    const sig = signSubject('dialer', 'call1');
    expect(verifySubject('dialer', 'call1', sig)).toBe(true);
    expect(verifySubject('media', 'call1', sig)).toBe(false);
    expect(verifySubject('dialer', 'call2', sig)).toBe(false);
  });
});

// ── The browser's audio worklet (apps/web/public/dialer-worklet.js) ─────────

interface WorkletModule {
  mulawEncode(sample: number): number;
  mulawDecode(byte: number): number;
  toInt16(x: number): number;
  LowPass: new (cutoffHz: number, rateHz: number) => { process(x: number): number };
  ToneGenerator: new () => {
    add(low: number, high: number, ms?: number): void;
    next(): number | null;
  };
  CaptureEncoder: new (inRate: number) => {
    muted: boolean;
    tones: { add(low: number, high: number, ms?: number): void };
    push(input: Float32Array | undefined, length?: number): Uint8Array[];
  };
  PlaybackBuffer: new (
    outRate: number,
    opts?: { targetMs?: number; maxMs?: number },
  ) => {
    buffered: number;
    underruns: number;
    push(bytes: Uint8Array): void;
    render(out: Float32Array): void;
  };
}

/** Amplitude of `freq` in `samples` (single-bin DFT), relative to a full-scale sine = 1. */
function toneLevel(samples: ArrayLike<number>, freq: number, rate: number): number {
  let re = 0;
  let im = 0;
  for (let i = 0; i < samples.length; i++) {
    re += samples[i] * Math.cos((2 * Math.PI * freq * i) / rate);
    im -= samples[i] * Math.sin((2 * Math.PI * freq * i) / rate);
  }
  return (2 * Math.hypot(re, im)) / samples.length;
}

function sine(freq: number, rate: number, seconds: number, level = 0.5): Float32Array {
  const out = new Float32Array(Math.round(rate * seconds));
  for (let i = 0; i < out.length; i++) out[i] = level * Math.sin((2 * Math.PI * freq * i) / rate);
  return out;
}

describe('dialer audio worklet', () => {
  let w: WorkletModule;
  beforeAll(async () => {
    const file = path.resolve(__dirname, '../../web/public/dialer-worklet.js');
    w = (await import(pathToFileURL(file).href)) as WorkletModule;
  });

  it('speaks the same μ-law as the server', () => {
    for (const s of [-32768, -20000, -1234, -1, 0, 1, 77, 1234, 20000, 32767]) {
      expect(w.mulawEncode(s)).toBe(mulawEncode(Int16Array.of(s))[0]);
    }
    // (| 0: the server decodes into an Int16Array, which has no -0.)
    for (let b = 0; b < 256; b++) {
      expect(w.mulawDecode(b) | 0).toBe(mulawDecode(Uint8Array.of(b))[0]);
    }
  });

  it('turns 48 kHz and 44.1 kHz microphone audio into 20 ms frames at 8 kHz', () => {
    for (const rate of [48_000, 44_100]) {
      const enc = new w.CaptureEncoder(rate);
      const frames: Uint8Array[] = [];
      const mic = sine(1000, rate, 1);
      for (let i = 0; i < mic.length; i += 128) frames.push(...enc.push(mic.subarray(i, i + 128)));
      expect(frames.every((f) => f.length === DIALER_FRAME_BYTES)).toBe(true);
      expect(frames.length).toBeGreaterThanOrEqual(49);
      expect(frames.length).toBeLessThanOrEqual(50);

      // The 1 kHz tone survives at about its level.
      const line = Array.from(
        frames.slice(10).flatMap((f) => Array.from(f)),
        (b) => w.mulawDecode(b) / 32768,
      );
      expect(toneLevel(line, 1000, 8000)).toBeGreaterThan(0.4);
    }
  });

  it('filters out what would alias into the phone band', () => {
    const rate = 48_000;
    const enc = new w.CaptureEncoder(rate);
    const frames: Uint8Array[] = [];
    // 7 kHz would fold to 1 kHz at 8 kHz without the low-pass.
    const mic = sine(7000, rate, 1);
    for (let i = 0; i < mic.length; i += 128) frames.push(...enc.push(mic.subarray(i, i + 128)));
    const line = Array.from(
      frames.slice(10).flatMap((f) => Array.from(f)),
      (b) => w.mulawDecode(b) / 32768,
    );
    expect(toneLevel(line, 1000, 8000)).toBeLessThan(0.02);
  });

  it('sends silence when muted, and keypad tones even then', () => {
    const enc = new w.CaptureEncoder(48_000);
    enc.muted = true;
    const mic = sine(500, 48_000, 0.2);
    const silent = enc.push(mic.subarray(0, 960 * 2));
    expect(silent.flatMap((f) => Array.from(f)).every((b) => b === 0xff)).toBe(true);

    const [low, high] = DTMF_FREQUENCIES['5'];
    enc.tones.add(low, high, 150);
    const frames: Uint8Array[] = [];
    for (let i = 0; i < 48_000 * 0.15; i += 128) frames.push(...enc.push(new Float32Array(128)));
    const line = Array.from(
      frames.flatMap((f) => Array.from(f)),
      (b) => w.mulawDecode(b) / 32768,
    ).slice(0, 1200);
    expect(toneLevel(line, low, 8000)).toBeGreaterThan(0.15);
    expect(toneLevel(line, high, 8000)).toBeGreaterThan(0.15);
    expect(toneLevel(line, 1000, 8000)).toBeLessThan(0.02);
  });

  it('plays queued tones one after another with a gap', () => {
    const gen = new w.ToneGenerator();
    gen.add(697, 1209, 150);
    gen.add(941, 1477, 150);
    let count = 0;
    while (gen.next() !== null) count++;
    // Two tones of 150 ms plus a 60 ms gap after each, at 8 kHz.
    expect(count).toBe(2 * (1200 + 480));
  });

  it('buffers ~80 ms before playing and resamples 8 kHz to the context rate', () => {
    const player = new w.PlaybackBuffer(48_000);
    const out = new Float32Array(128);
    const tone = sine(1000, 8000, 1);
    const bytes = Uint8Array.from(tone, (x) => w.mulawEncode(w.toInt16(x)));

    player.push(bytes.subarray(0, 320)); // 40 ms: not enough yet
    player.render(out);
    expect(Math.max(...out.map(Math.abs))).toBeLessThan(1e-3);

    // Then 20 ms frames arrive in real time, staying ~100 ms ahead of playback.
    let fed = 320;
    const played: number[] = [];
    for (let i = 0; i < 300; i++) {
      while (fed < Math.min(bytes.length, (i * 128) / 6 + 800)) {
        player.push(bytes.subarray(fed, fed + 160));
        fed += 160;
      }
      player.render(out);
      played.push(...out);
    }
    expect(player.underruns).toBe(0);
    expect(toneLevel(played.slice(4800), 1000, 48_000)).toBeGreaterThan(0.4);
  });

  it('drops old audio after a burst so the delay stays short', () => {
    const player = new w.PlaybackBuffer(48_000, { targetMs: 80, maxMs: 300 });
    player.push(new Uint8Array(8000).fill(0xff)); // a second at once
    expect(player.buffered).toBe(640);
  });

  it('counts underruns and refills before playing again', () => {
    const player = new w.PlaybackBuffer(48_000);
    const out = new Float32Array(128);
    player.push(new Uint8Array(640).fill(0x80));
    for (let i = 0; i < 40; i++) player.render(out);
    expect(player.underruns).toBe(1);
    expect(player.buffered).toBe(0);
  });
});

// ── Through the media server, over real sockets ─────────────────────────────

describe('dialer media server', () => {
  type Row = { placedById: string | null; status: CallStatus; answeredAt: Date | null };
  const rows = new Map<string, Row>();
  const server = http.createServer();
  let base = '';

  beforeAll(async () => {
    vi.mocked(prisma.call.findUnique).mockImplementation(
      (async (args: { where: { id: string } }) =>
        rows.get(args.where.id) ?? null) as unknown as typeof prisma.call.findUnique,
    );
    attachMediaServer(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `ws://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server.close();
  });

  const cookie = (sub: string) =>
    `pv_at=${signAccessToken({ sub, role: 'SUBSCRIBER', wid: 'ws1' })}`;
  const browserUrl = (callId: string) =>
    `${base}/ws/dialer/${callId}/${signSubject('dialer', callId)}`;

  function open(url: string, headers: Record<string, string> = {}) {
    const ws = new WebSocket(url, { headers });
    const got: Array<{ data: Buffer; binary: boolean }> = [];
    ws.on('message', (data, binary) => got.push({ data: data as Buffer, binary }));
    const json = () => got.filter((m) => !m.binary).map((m) => JSON.parse(m.data.toString()));
    return { ws, got, json };
  }

  async function until(check: () => boolean, ms = 2000) {
    const start = Date.now();
    while (!check()) {
      if (Date.now() - start > ms) throw new Error('timed out');
      await new Promise((r) => setTimeout(r, 5));
    }
  }

  function refused(url: string, headers: Record<string, string> = {}): Promise<number> {
    return new Promise((resolve) => {
      const ws = new WebSocket(url, { headers });
      ws.on('unexpected-response', (req, res) => {
        resolve(res.statusCode ?? 0);
        req.destroy();
      });
      ws.on('error', () => undefined);
    });
  }

  it('bridges the browser and a Twilio stream, both ways, until hangup', async () => {
    rows.set('call1', { placedById: 'user1', status: 'RINGING', answeredAt: null });
    const browser = open(browserUrl('call1'), {
      Cookie: cookie('user1'),
      Origin: 'http://localhost:3000',
    });
    await until(() => browser.json().length === 1);
    expect(browser.json()[0]).toEqual({ type: 'status', status: 'ringing' });

    // The callee answers: the carrier fetches the stream document and connects.
    rows.set('call1', { placedById: 'user1', status: 'IN_PROGRESS', answeredAt: new Date() });
    const carrier = open(`${base}/ws/twilio/call1/${signSubject('media', 'call1')}`);
    await new Promise((r) => carrier.ws.once('open', r));
    carrier.ws.send(JSON.stringify({ event: 'connected' }));
    carrier.ws.send(
      JSON.stringify({ event: 'start', start: { streamSid: 'MZ1', callSid: 'CA1' } }),
    );
    await until(() => browser.json().length === 2);
    expect(browser.json()[1]).toEqual({ type: 'status', status: 'answered' });

    const line = Buffer.from([0x10, 0x20, 0x30]);
    carrier.ws.send(
      JSON.stringify({ event: 'media', media: { payload: line.toString('base64') } }),
    );
    await until(() => browser.got.some((m) => m.binary));
    expect(browser.got.find((m) => m.binary)?.data).toEqual(line);

    const mic = Buffer.alloc(DIALER_FRAME_BYTES, 0x55);
    browser.ws.send(mic);
    await until(() => carrier.got.length === 1);
    expect(JSON.parse(carrier.got[0].data.toString())).toEqual({
      event: 'media',
      streamSid: 'MZ1',
      media: { payload: mic.toString('base64') },
    });

    const carrierClosed = new Promise((r) => carrier.ws.once('close', r));
    const browserClosed = new Promise((r) => browser.ws.once('close', r));
    browser.ws.send(JSON.stringify({ type: 'hangup' }));
    await Promise.all([carrierClosed, browserClosed]);
    expect(browser.json().at(-1)).toEqual({ type: 'status', status: 'ended', reason: 'hangup' });
  });

  it('tells a browser that reconnects to a finished call that it ended', async () => {
    rows.set('call2', { placedById: 'user1', status: 'NO_ANSWER', answeredAt: null });
    const browser = open(browserUrl('call2'), { Cookie: cookie('user1') });
    await new Promise((r) => browser.ws.once('close', r));
    expect(browser.json()).toEqual([{ type: 'status', status: 'ended', reason: 'no_answer' }]);
  });

  it('refuses sockets without the signature, the session or the right person', async () => {
    rows.set('call3', { placedById: 'user1', status: 'RINGING', answeredAt: null });
    rows.set('ai1', { placedById: null, status: 'RINGING', answeredAt: null });
    const sig = signSubject('dialer', 'call3');
    expect(await refused(`${base}/ws/dialer/call3/${'0'.repeat(40)}`)).toBe(403);
    expect(await refused(`${base}/ws/dialer/call3/${signSubject('media', 'call3')}`)).toBe(403);
    expect(await refused(`${base}/ws/dialer/call3/${sig}`)).toBe(401);
    expect(await refused(`${base}/ws/dialer/call3/${sig}`, { Cookie: cookie('user2') })).toBe(404);
    expect(
      await refused(`${base}/ws/dialer/call3/${sig}`, {
        Cookie: cookie('user1'),
        Origin: 'https://evil.example',
      }),
    ).toBe(403);
    expect(await refused(browserUrl('ai1'), { Cookie: cookie('user1') })).toBe(404);
  });
});
