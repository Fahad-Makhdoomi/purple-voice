import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';
import type WebSocket from 'ws';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { telephonyAccountSchema } from '@pv/shared';
import { SignalWireAdapter } from '../src/telephony/signalwire';
import { TelnyxAdapter } from '../src/telephony/telnyx';
import { ExotelAdapter, exotelE164 } from '../src/telephony/exotel';
import { VonageAdapter, vonageJwt } from '../src/telephony/vonage';
import { BandwidthAdapter, bandwidthStatus } from '../src/telephony/bandwidth';
import { callbackFields } from '../src/telephony/webhook-fields';
import { mulawDecode, mulawEncode } from '../src/voice/audio';
import {
  BandwidthTransport,
  createTransport,
  ExotelTransport,
  FrameBuffer,
  mulawB64ToPcm16,
  pcm16ToMulawB64,
  TelnyxTransport,
  TwilioTransport,
  VonageTransport,
  type StreamStartInfo,
} from '../src/voice/transports';

const UUID = '1b4e28ba-2fa1-41d2-883f-0016d3cca427';

/** Records what a transport sends; `msg`/`bin` deliver frames as the carrier would. */
class FakeWs extends EventEmitter {
  readonly OPEN = 1;
  readyState = 1;
  sent: Array<{ data: unknown; binary: boolean }> = [];
  send(data: unknown, opts?: { binary?: boolean }) {
    this.sent.push({ data, binary: !!opts?.binary });
  }
  close() {
    this.readyState = 3;
    this.emit('close');
  }
  msg(m: unknown) {
    this.emit('message', Buffer.from(JSON.stringify(m)), false);
  }
  bin(b: Buffer) {
    this.emit('message', b, true);
  }
  json() {
    return this.sent.filter((s) => !s.binary).map((s) => JSON.parse(String(s.data)));
  }
}
const asWs = (ws: FakeWs) => ws as unknown as WebSocket;

function mockFetch(responses: unknown[]) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const body = responses.shift() ?? {};
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fn);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('carrier credential schemas', () => {
  it('normalises a SignalWire space URL and rejects other hosts', () => {
    const ok = telephonyAccountSchema.parse({
      provider: 'SIGNALWIRE',
      spaceUrl: 'https://Acme.signalwire.com/dashboard',
      projectId: UUID,
      apiToken: 'PT' + 'a'.repeat(30),
    });
    expect(ok).toMatchObject({ spaceUrl: 'acme.signalwire.com' });
    expect(() =>
      telephonyAccountSchema.parse({
        provider: 'SIGNALWIRE',
        spaceUrl: 'evil.example.com',
        projectId: UUID,
        apiToken: 'PT' + 'a'.repeat(30),
      }),
    ).toThrow();
  });

  it('only accepts Exotel’s own clusters', () => {
    const base = {
      provider: 'EXOTEL',
      accountSid: 'acme1',
      apiKey: 'k'.repeat(10),
      apiToken: 't'.repeat(10),
    };
    expect(() =>
      telephonyAccountSchema.parse({ ...base, subdomain: 'api.in.exotel.com' }),
    ).not.toThrow();
    expect(() => telephonyAccountSchema.parse({ ...base, subdomain: 'evil.com' })).toThrow();
  });
});

describe('SignalWire', () => {
  it('uses the LaML API on the space with Twilio markup', async () => {
    const sw = new SignalWireAdapter({
      spaceUrl: 'acme.signalwire.com',
      projectId: UUID,
      apiToken: 'PTsecret',
    });
    expect(sw.provider).toBe('SIGNALWIRE');
    expect(sw.mediaProtocol).toBe('twilio');
    expect(sw.streamDocument('wss://x/ws/signalwire/c/s').body).toContain(
      '<Connect><Stream url="wss://x/ws/signalwire/c/s"/></Connect>',
    );
    const calls = mockFetch([{ sid: 'CA1' }]);
    const { providerCallId } = await sw.placeCall({
      from: '+15550001111',
      to: '+15550002222',
      answerUrl: 'https://x/a',
      statusUrl: 'https://x/s',
      streamUrl: 'wss://x/m',
    });
    expect(providerCallId).toBe('CA1');
    expect(calls[0].url).toBe(
      `https://acme.signalwire.com/api/laml/2010-04-01/Accounts/${UUID}/Calls.json`,
    );
    expect(
      String(
        calls[0].init.headers && (calls[0].init.headers as Record<string, string>).Authorization,
      ),
    ).toBe(`Basic ${Buffer.from(`${UUID}:PTsecret`).toString('base64')}`);
  });
});

describe('Telnyx', () => {
  const telnyx = new TelnyxAdapter({ apiKey: 'KEYabc', applicationId: '1293384261075731499' });

  it('streams with bidirectional RTP PCMU', () => {
    const doc = telnyx.streamDocument('wss://x/ws/telnyx/c/s', 'Hi & bye');
    expect(doc.body).toContain('<Say>Hi &amp; bye</Say>');
    expect(doc.body).toContain(
      '<Connect><Stream url="wss://x/ws/telnyx/c/s" bidirectionalMode="rtp" bidirectionalCodec="PCMU"/></Connect>',
    );
  });

  it('places calls on the TeXML application', async () => {
    const calls = mockFetch([{ call_sid: 'v3:abc', status: 'queued' }]);
    const r = await telnyx.placeCall({
      from: '+15550001111',
      to: '+15550002222',
      answerUrl: 'https://x/a',
      statusUrl: 'https://x/s',
      streamUrl: 'wss://x/m',
    });
    expect(r.providerCallId).toBe('v3:abc');
    expect(calls[0].url).toBe('https://api.telnyx.com/v2/texml/calls/1293384261075731499');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({ To: '+15550002222', From: '+15550001111', Url: 'https://x/a' });
  });

  it('hangs up through Call Control', async () => {
    const calls = mockFetch([{}]);
    await telnyx.hangup('v3:abc');
    expect(calls[0].url).toBe('https://api.telnyx.com/v2/calls/v3%3Aabc/actions/hangup');
  });
});

describe('Exotel', () => {
  const exotel = new ExotelAdapter({
    accountSid: 'acme1',
    apiKey: 'key',
    apiToken: 'token',
    subdomain: 'api.in.exotel.com',
  });

  it('normalises Indian numbers', () => {
    expect(exotelE164('09876543210')).toBe('+919876543210');
    expect(exotelE164('9876543210')).toBe('+919876543210');
    expect(exotelE164('+91 98765 43210')).toBe('+919876543210');
    expect(exotelE164('919876543210')).toBe('+919876543210');
  });

  it('places calls that open our stream on answer', async () => {
    const calls = mockFetch([{ Call: { Sid: 'exo123' } }]);
    const r = await exotel.placeCall({
      from: '+918000000000',
      to: '+919876543210',
      answerUrl: 'https://x/a',
      statusUrl: 'https://x/s',
      streamUrl: 'wss://x/ws/exotel/c/s',
    });
    expect(r.providerCallId).toBe('exo123');
    expect(calls[0].url).toBe('https://api.in.exotel.com/v1/Accounts/acme1/Calls/connect.json');
    const form = new URLSearchParams(String(calls[0].init.body));
    expect(form.get('From')).toBe('+919876543210');
    expect(form.get('CallerId')).toBe('+918000000000');
    expect(form.get('StreamUrl')).toBe('wss://x/ws/exotel/c/s');
    expect(form.get('StreamType')).toBe('bidirectional');
    expect(exotel.manualInbound).toBe(true);
  });
});

describe('Vonage', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const vonage = new VonageAdapter({
    apiKey: 'abc123',
    apiSecret: 'secret123',
    applicationId: UUID,
    privateKey: pem,
  });

  it('signs RS256 JWTs for the application', () => {
    const jwt = vonageJwt(UUID, pem, 1_700_000_000);
    const [h, p, sig] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({
      alg: 'RS256',
      typ: 'JWT',
    });
    const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
    expect(claims).toMatchObject({ application_id: UUID, iat: 1_700_000_000, exp: 1_700_000_900 });
    expect(
      crypto.verify(
        'RSA-SHA256',
        Buffer.from(`${h}.${p}`),
        publicKey,
        Buffer.from(sig, 'base64url'),
      ),
    ).toBe(true);
  });

  it('answers with an NCCO websocket connect at 8 kHz', () => {
    const ncco = JSON.parse(vonage.streamDocument('wss://x/ws/vonage/c/s', 'Hello').body);
    expect(ncco).toEqual([
      { action: 'talk', text: 'Hello' },
      {
        action: 'connect',
        endpoint: [
          {
            type: 'websocket',
            uri: 'wss://x/ws/vonage/c/s',
            'content-type': 'audio/l16;rate=8000',
          },
        ],
      },
    ]);
    expect(vonage.sayAndHangupDocument('Bye').contentType).toBe('application/json');
  });

  it('places calls with bare digits', async () => {
    const calls = mockFetch([{ uuid: 'u-1' }]);
    const r = await vonage.placeCall({
      from: '+447700900000',
      to: '+447700900001',
      answerUrl: 'https://x/a',
      statusUrl: 'https://x/s',
      streamUrl: 'wss://x/m',
    });
    expect(r.providerCallId).toBe('u-1');
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.to).toEqual([{ type: 'phone', number: '447700900001' }]);
    expect(body.answer_method).toBe('POST');
  });
});

describe('Bandwidth', () => {
  const bw = new BandwidthAdapter({
    accountId: '9900000',
    clientId: 'client-id',
    clientSecret: 'client-secret',
    applicationId: UUID,
  });

  it('holds the call open around a bidirectional stream', () => {
    const doc = bw.streamDocument('wss://x/ws/bandwidth/c/s', 'Hi');
    expect(doc.body).toContain('<SpeakSentence>Hi</SpeakSentence>');
    expect(doc.body).toContain('mode="bidirectional"');
    expect(doc.body).toContain('destination="wss://x/ws/bandwidth/c/s"');
    expect(doc.body).toContain('<StopStream name="purplevoice" wait="true"/>');
  });

  it('places calls with an OAuth token', async () => {
    const calls = mockFetch([{ access_token: 'tok', expires_in: 3600 }, { callId: 'c-1' }]);
    const r = await bw.placeCall({
      from: '+15550001111',
      to: '+15550002222',
      answerUrl: 'https://x/a',
      statusUrl: 'https://x/s',
      streamUrl: 'wss://x/m',
    });
    expect(r.providerCallId).toBe('c-1');
    expect(calls[0].url).toBe('https://api.bandwidth.com/api/v1/oauth2/token');
    expect(calls[1].url).toBe('https://voice.bandwidth.com/api/v2/accounts/9900000/calls');
    expect((calls[1].init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('maps callback events to statuses', () => {
    expect(bandwidthStatus({ eventType: 'answer' })).toBe('IN_PROGRESS');
    expect(bandwidthStatus({ eventType: 'disconnect', cause: 'hangup' })).toBe('COMPLETED');
    expect(bandwidthStatus({ eventType: 'disconnect', cause: 'busy' })).toBe('BUSY');
    expect(bandwidthStatus({ eventType: 'disconnect', cause: 'timeout' })).toBe('NO_ANSWER');
    expect(bandwidthStatus({ eventType: 'disconnect', cause: 'error' })).toBe('FAILED');
    expect(bandwidthStatus({ eventType: 'initiate' })).toBeUndefined();
  });
});

describe('webhook fields', () => {
  it('reads each carrier’s call id, numbers and status', () => {
    expect(
      callbackFields('TELNYX', {
        CallSid: 'v3:x',
        From: '+1',
        To: '+2',
        CallStatus: 'completed',
        CallDuration: '12',
      }),
    ).toEqual({
      providerCallId: 'v3:x',
      from: '+1',
      to: '+2',
      status: 'COMPLETED',
      durationSec: 12,
    });
    expect(callbackFields('SIGNALWIRE', { CallSid: 'a', CallStatus: 'no-answer' }).status).toBe(
      'NO_ANSWER',
    );
    expect(callbackFields('PLIVO', { CallUUID: 'p', CallStatus: 'timeout' })).toMatchObject({
      providerCallId: 'p',
      status: 'NO_ANSWER',
    });
    expect(
      callbackFields('EXOTEL', { CallSid: 'e', EventType: 'answered', Status: 'in-progress' })
        .status,
    ).toBe('IN_PROGRESS');
    expect(
      callbackFields('EXOTEL', {
        CallSid: 'e',
        EventType: 'terminal',
        Status: 'busy',
        ConversationDuration: 0,
      }),
    ).toMatchObject({ status: 'BUSY', durationSec: 0 });
    expect(
      callbackFields('VONAGE', {
        uuid: 'v',
        from: '447700900000',
        to: '447700900001',
        status: 'answered',
      }),
    ).toMatchObject({ providerCallId: 'v', status: 'IN_PROGRESS', to: '447700900001' });
    // The WebSocket leg's own events are ignored.
    expect(callbackFields('VONAGE', { uuid: 'w', to: 'wss://x/ws', status: 'completed' })).toEqual(
      {},
    );
    expect(
      callbackFields('BANDWIDTH', {
        eventType: 'disconnect',
        cause: 'hangup',
        callId: 'c',
        answerTime: '2026-01-01T00:00:00Z',
        endTime: '2026-01-01T00:01:05Z',
      }),
    ).toMatchObject({ providerCallId: 'c', status: 'COMPLETED', durationSec: 65 });
  });
});

describe('audio conversion', () => {
  it('converts μ-law to PCM16 and back without loss', () => {
    const mulaw = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
    const pcm = mulawB64ToPcm16(mulaw.toString('base64'));
    expect(pcm.length).toBe(512);
    expect(pcm.readInt16LE(0)).toBe(mulawDecode(Uint8Array.of(0))[0]);
    // 0x7f and 0xff both decode to zero; everything else round-trips exactly.
    const back = Buffer.from(pcm16ToMulawB64(pcm), 'base64');
    for (let i = 0; i < 256; i++) if (i !== 0x7f) expect(back[i]).toBe(i);
    expect(mulawEncode(new Int16Array([0]))[0]).toBe(0xff);
  });

  it('regroups audio into carrier frames and pads the tail', () => {
    vi.useFakeTimers();
    const out: Buffer[] = [];
    const fb = new FrameBuffer({ frame: 320, min: 640, max: 960, silence: 0, flushMs: 50 }, (c) =>
      out.push(Buffer.from(c)),
    );
    fb.push(Buffer.alloc(300, 1));
    expect(out).toHaveLength(0);
    fb.push(Buffer.alloc(1100, 1)); // 1400 queued: 960, then 320 (≥ min? no, 440 < 640) waits
    expect(out.map((c) => c.length)).toEqual([960]);
    vi.advanceTimersByTime(60);
    expect(out.map((c) => c.length)).toEqual([960, 640]);
    expect(out[1][439]).toBe(1);
    expect(out[1][440]).toBe(0);
    fb.push(Buffer.alloc(100, 1));
    fb.clear();
    vi.advanceTimersByTime(60);
    expect(out).toHaveLength(2);
  });
});

describe('media transports', () => {
  it('routes every streaming carrier to its protocol', () => {
    const ws = asWs(new FakeWs());
    expect(createTransport('signalwire', ws)).toBeInstanceOf(TwilioTransport);
    expect(createTransport('telnyx', ws)).toBeInstanceOf(TelnyxTransport);
    expect(createTransport('exotel', ws)).toBeInstanceOf(ExotelTransport);
    expect(createTransport('vonage', ws)).toBeInstanceOf(VonageTransport);
    expect(createTransport('bandwidth', ws)).toBeInstanceOf(BandwidthTransport);
    expect(createTransport('superphone', ws)).toBeNull();
  });

  it('speaks Telnyx media streaming', () => {
    vi.useFakeTimers();
    const ws = new FakeWs();
    const t = new TelnyxTransport(asWs(ws));
    let start: StreamStartInfo | undefined;
    const audio: string[] = [];
    let stopped = false;
    t.onStart((i) => (start = i));
    t.onAudio((a) => audio.push(a));
    t.onStop(() => (stopped = true));
    ws.msg({ event: 'connected', version: '1.0.0' });
    ws.msg({
      event: 'start',
      stream_id: 's1',
      start: { call_control_id: 'v3:c', from: '+1', to: '+2' },
    });
    ws.msg({ event: 'media', stream_id: 's1', media: { track: 'inbound', payload: 'AAAA' } });
    ws.msg({ event: 'media', stream_id: 's1', media: { track: 'outbound', payload: 'BBBB' } });
    expect(start).toEqual({ streamId: 's1', providerCallId: 'v3:c', from: '+1', to: '+2' });
    expect(audio).toEqual(['AAAA']);
    // Short chunks are held until 20 ms is queued.
    t.sendAudio(Buffer.alloc(100, 0x55).toString('base64'));
    expect(ws.json()).toEqual([]);
    t.sendAudio(Buffer.alloc(100, 0x55).toString('base64'));
    const sent = ws.json();
    expect(sent[0].event).toBe('media');
    expect(Buffer.from(sent[0].media.payload, 'base64').length).toBe(200);
    t.clearAudio();
    expect(ws.json().at(-1)).toEqual({ event: 'clear' });
    ws.msg({ event: 'stop', stream_id: 's1', stop: {} });
    expect(stopped).toBe(true);
  });

  it('converts Exotel PCM and sends 320-byte multiples', () => {
    vi.useFakeTimers();
    const ws = new FakeWs();
    const t = new ExotelTransport(asWs(ws));
    let start: StreamStartInfo | undefined;
    const audio: string[] = [];
    t.onStart((i) => (start = i));
    t.onAudio((a) => audio.push(a));
    ws.msg({ event: 'connected' });
    ws.msg({
      event: 'start',
      sequence_number: 1,
      stream_sid: 'st1',
      start: { stream_sid: 'st1', call_sid: 'cs1', from: '09876543210', to: '08000000000' },
    });
    expect(start).toMatchObject({ streamId: 'st1', providerCallId: 'cs1', from: '09876543210' });

    // 20 ms of PCM in, 20 ms of μ-law out.
    const pcm = Buffer.alloc(320);
    for (let i = 0; i < 160; i++) pcm.writeInt16LE(i * 50, i * 2);
    ws.msg({
      event: 'media',
      stream_sid: 'st1',
      media: { chunk: '1', payload: pcm.toString('base64') },
    });
    expect(Buffer.from(audio[0], 'base64')).toEqual(mulawEncode(pcm));

    // 100 ms of μ-law out (1,600 bytes PCM) waits for 200 ms, or the flush.
    t.sendAudio(Buffer.alloc(800, 0xff).toString('base64'));
    expect(ws.json()).toEqual([]);
    t.sendAudio(Buffer.alloc(1000, 0xff).toString('base64'));
    let sent = ws.json();
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ event: 'media', stream_sid: 'st1' });
    const first = Buffer.from(sent[0].media.payload, 'base64').length;
    expect(first % 320).toBe(0);
    expect(first).toBe(3520);
    vi.advanceTimersByTime(100);
    sent = ws.json();
    const second = Buffer.from(sent[1].media.payload, 'base64').length;
    expect(second).toBe(3200); // the 80-byte tail padded up to the minimum chunk
    t.clearAudio();
    expect(ws.json().at(-1)).toEqual({ event: 'clear', stream_sid: 'st1' });
  });

  it('speaks Vonage binary linear16', () => {
    vi.useFakeTimers();
    const ws = new FakeWs();
    const t = new VonageTransport(asWs(ws));
    let started = false;
    const audio: string[] = [];
    t.onStart(() => (started = true));
    t.onAudio((a) => audio.push(a));
    ws.msg({ event: 'websocket:connected', 'content-type': 'audio/l16;rate=8000' });
    expect(started).toBe(true);
    ws.bin(Buffer.alloc(320));
    expect(Buffer.from(audio[0], 'base64')).toEqual(Buffer.alloc(160, 0xff));
    // 30 ms of μ-law: one 20 ms frame now, the rest padded on flush.
    t.sendAudio(Buffer.alloc(240, 0xff).toString('base64'));
    const frames = () => ws.sent.filter((s) => s.binary).map((s) => (s.data as Buffer).length);
    expect(frames()).toEqual([320]);
    vi.advanceTimersByTime(50);
    expect(frames()).toEqual([320, 320]);
    t.clearAudio();
    expect(ws.json().at(-1)).toEqual({ action: 'clear' });
  });

  it('speaks Bandwidth streaming', () => {
    const ws = new FakeWs();
    const t = new BandwidthTransport(asWs(ws));
    let start: StreamStartInfo | undefined;
    const audio: string[] = [];
    t.onStart((i) => (start = i));
    t.onAudio((a) => audio.push(a));
    ws.msg({
      eventType: 'start',
      metadata: { accountId: '1', callId: 'c-1', streamId: 'bs1', streamName: 'purplevoice' },
    });
    ws.msg({ eventType: 'media', track: 'inbound', sequenceNumber: '1', payload: 'AAAA' });
    expect(start).toEqual({ streamId: 'bs1', providerCallId: 'c-1' });
    expect(audio).toEqual(['AAAA']);
    t.sendAudio('BBBB');
    t.clearAudio();
    expect(ws.json()).toEqual([
      { eventType: 'playAudio', media: { contentType: 'audio/pcmu', payload: 'BBBB' } },
      { eventType: 'clear' },
    ]);
  });
});
