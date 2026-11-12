import type WebSocket from 'ws';
import { mulawDecode, mulawEncode, pcm16ToBuffer } from './audio';

/** What the carrier tells us when a stream starts. `from`/`to` only where the protocol carries them. */
export interface StreamStartInfo {
  streamId: string;
  providerCallId?: string;
  from?: string;
  to?: string;
}

/**
 * A carrier's bidirectional audio stream over WebSocket. The rest of the
 * platform speaks 8 kHz μ-law, base64 encoded — the same format OpenAI
 * Realtime and Deepgram accept, and what Twilio, SignalWire, Plivo, Telnyx
 * and Bandwidth stream — so for those audio passes through untouched.
 * Exotel and Vonage stream 16-bit linear PCM; their transports convert.
 */
export interface MediaTransport {
  /** Fires once the carrier has identified the stream. */
  onStart(cb: (info: StreamStartInfo) => void): void;
  onAudio(cb: (payloadB64: string) => void): void;
  onStop(cb: () => void): void;
  sendAudio(payloadB64: string): void;
  /** Drops audio queued on the carrier side (caller interrupted the agent). */
  clearAudio(): void;
  close(): void;
}

type Json = Record<string, unknown>;

function toBuffer(raw: WebSocket.RawData): Buffer {
  if (Buffer.isBuffer(raw)) return raw;
  if (Array.isArray(raw)) return Buffer.concat(raw);
  return Buffer.from(raw as ArrayBuffer);
}

abstract class BaseTransport implements MediaTransport {
  protected streamId = '';
  private startCb?: (info: StreamStartInfo) => void;
  private audioCb?: (payload: string) => void;
  private stopCb?: () => void;
  private stopped = false;

  constructor(protected readonly ws: WebSocket) {
    ws.on('message', (raw: WebSocket.RawData, isBinary: boolean) => {
      if (isBinary) return this.handleBinary(toBuffer(raw));
      let msg: Json;
      try {
        msg = JSON.parse(raw.toString()) as Json;
      } catch {
        return;
      }
      this.handle(msg);
    });
    ws.on('close', () => this.emitStop());
    ws.on('error', () => this.emitStop());
  }

  protected abstract handle(msg: Json): void;
  /** Binary frames: only Vonage sends audio this way. */
  protected handleBinary(_data: Buffer): void {}

  protected emitStart(
    streamId: string,
    providerCallId?: string,
    extra?: { from?: string; to?: string },
  ) {
    this.streamId = streamId;
    this.startCb?.({ streamId, providerCallId, ...extra });
  }
  protected emitAudio(payload: string) {
    this.audioCb?.(payload);
  }
  protected emitStop() {
    if (this.stopped) return;
    this.stopped = true;
    this.stopCb?.();
  }
  protected send(msg: Json) {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(msg));
  }

  onStart(cb: (info: StreamStartInfo) => void) {
    this.startCb = cb;
  }
  onAudio(cb: (payload: string) => void) {
    this.audioCb = cb;
  }
  onStop(cb: () => void) {
    this.stopCb = cb;
  }
  abstract sendAudio(payloadB64: string): void;
  abstract clearAudio(): void;
  close() {
    if (this.ws.readyState === this.ws.OPEN) this.ws.close();
  }
}

/**
 * Regroups outgoing audio into the frame sizes a carrier insists on. Bytes
 * are sent as soon as at least `min` are queued, in whole `frame`s (at most
 * `max` per send); a tail still waiting after `flushMs` (the end of an
 * utterance) is padded with `silence` to a whole frame, and to `min`, and
 * sent too.
 */
export class FrameBuffer {
  private pending: Buffer = Buffer.alloc(0);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly opts: {
      frame: number;
      min: number;
      max?: number;
      silence: number;
      flushMs: number;
    },
    private readonly out: (chunk: Buffer) => void,
  ) {}

  push(bytes: Buffer) {
    this.pending = this.pending.length ? Buffer.concat([this.pending, bytes]) : bytes;
    const { frame, min } = this.opts;
    const max = this.opts.max ?? Number.POSITIVE_INFINITY;
    while (this.pending.length >= min) {
      const n = Math.min(this.pending.length - (this.pending.length % frame), max);
      if (n <= 0) break;
      this.out(this.pending.subarray(0, n));
      this.pending = this.pending.subarray(n);
    }
    clearTimeout(this.timer);
    if (this.pending.length) this.timer = setTimeout(() => this.flush(), this.opts.flushMs);
  }

  flush() {
    clearTimeout(this.timer);
    if (!this.pending.length) return;
    const { frame, min, silence } = this.opts;
    const size = Math.max(min, Math.ceil(this.pending.length / frame) * frame);
    const chunk = Buffer.alloc(size, silence);
    this.pending.copy(chunk);
    this.pending = Buffer.alloc(0);
    this.out(chunk);
  }

  clear() {
    clearTimeout(this.timer);
    this.pending = Buffer.alloc(0);
  }
}

/** Base64 μ-law to 16-bit little-endian PCM, both 8 kHz. */
export function mulawB64ToPcm16(payloadB64: string): Buffer {
  return Buffer.from(pcm16ToBuffer(mulawDecode(Buffer.from(payloadB64, 'base64'))));
}

/** 16-bit little-endian PCM to base64 μ-law, both 8 kHz. */
export function pcm16ToMulawB64(pcm: Buffer): string {
  return mulawEncode(pcm).toString('base64');
}

/** Twilio Media Streams protocol (also SignalWire's <Connect><Stream>). */
export class TwilioTransport extends BaseTransport {
  protected handle(msg: Json) {
    switch (msg.event) {
      case 'start': {
        const start = msg.start as { streamSid: string; callSid?: string };
        this.emitStart(start.streamSid, start.callSid);
        break;
      }
      case 'media': {
        const media = msg.media as { payload: string; track?: string };
        if (!media.track || media.track === 'inbound') this.emitAudio(media.payload);
        break;
      }
      case 'stop':
        this.emitStop();
        break;
    }
  }
  sendAudio(payload: string) {
    this.send({ event: 'media', streamSid: this.streamId, media: { payload } });
  }
  clearAudio() {
    this.send({ event: 'clear', streamSid: this.streamId });
  }
}

/** Plivo Audio Streams protocol (bidirectional). */
export class PlivoTransport extends BaseTransport {
  protected handle(msg: Json) {
    switch (msg.event) {
      case 'start': {
        const start = msg.start as { streamId: string; callId?: string };
        this.emitStart(start.streamId, start.callId);
        break;
      }
      case 'media': {
        const media = msg.media as { payload: string; track?: string };
        if (!media.track || media.track === 'inbound') this.emitAudio(media.payload);
        break;
      }
      case 'stop':
        this.emitStop();
        break;
    }
  }
  sendAudio(payload: string) {
    this.send({
      event: 'playAudio',
      media: { contentType: 'audio/x-mulaw', sampleRate: 8000, payload },
    });
  }
  clearAudio() {
    this.send({ event: 'clearAudio', streamId: this.streamId });
  }
}

/**
 * Telnyx media streaming, bidirectional RTP mode with PCMU. Audio we send
 * must come in chunks of at least 20 ms (160 bytes).
 */
export class TelnyxTransport extends BaseTransport {
  private readonly out = new FrameBuffer(
    { frame: 1, min: 160, max: 8000, silence: 0xff, flushMs: 40 },
    (chunk) => this.send({ event: 'media', media: { payload: chunk.toString('base64') } }),
  );

  protected handle(msg: Json) {
    switch (msg.event) {
      case 'start': {
        const start = (msg.start ?? {}) as { call_control_id?: string; from?: string; to?: string };
        this.emitStart(String(msg.stream_id ?? ''), start.call_control_id, {
          from: start.from,
          to: start.to,
        });
        break;
      }
      case 'media': {
        const media = msg.media as { payload: string; track?: string };
        if (!media.track || media.track === 'inbound') this.emitAudio(media.payload);
        break;
      }
      case 'stop':
        this.emitStop();
        break;
    }
  }
  sendAudio(payload: string) {
    this.out.push(Buffer.from(payload, 'base64'));
  }
  clearAudio() {
    this.out.clear();
    this.send({ event: 'clear' });
  }
}

/**
 * Exotel AgentStream (Voicebot applet, Connect API stream): JSON frames like
 * Twilio's, but the audio is base64 16-bit little-endian PCM at 8 kHz, and
 * what we send must come in multiples of 320 bytes, at least 3,200 (200 ms).
 */
export class ExotelTransport extends BaseTransport {
  private readonly out = new FrameBuffer(
    { frame: 320, min: 3200, max: 32000, silence: 0, flushMs: 60 },
    (chunk) =>
      this.send({
        event: 'media',
        stream_sid: this.streamId,
        media: { payload: chunk.toString('base64') },
      }),
  );

  protected handle(msg: Json) {
    switch (msg.event) {
      case 'start': {
        const start = (msg.start ?? {}) as {
          stream_sid?: string;
          call_sid?: string;
          from?: string;
          to?: string;
        };
        this.emitStart(String(start.stream_sid ?? msg.stream_sid ?? ''), start.call_sid, {
          from: start.from,
          to: start.to,
        });
        break;
      }
      case 'media': {
        const media = msg.media as { payload?: string } | undefined;
        if (media?.payload) this.emitAudio(pcm16ToMulawB64(Buffer.from(media.payload, 'base64')));
        break;
      }
      case 'stop':
        this.emitStop();
        break;
    }
  }
  sendAudio(payload: string) {
    this.out.push(mulawB64ToPcm16(payload));
  }
  clearAudio() {
    this.out.clear();
    this.send({ event: 'clear', stream_sid: this.streamId });
  }
}

/**
 * Vonage `websocket` endpoint with content-type audio/l16;rate=8000: a JSON
 * "websocket:connected" text frame, then binary frames of 16-bit PCM. What
 * we send must be whole 20 ms frames (320 bytes at 8 kHz); Vonage queues
 * them (about a minute's worth) and plays them in order.
 */
export class VonageTransport extends BaseTransport {
  private readonly out = new FrameBuffer(
    { frame: 320, min: 320, max: 320, silence: 0, flushMs: 40 },
    (chunk) => {
      if (this.ws.readyState === this.ws.OPEN) this.ws.send(chunk, { binary: true });
    },
  );

  protected handle(msg: Json) {
    if (msg.event === 'websocket:connected') this.emitStart('vonage');
  }
  protected override handleBinary(data: Buffer) {
    this.emitAudio(pcm16ToMulawB64(data));
  }
  sendAudio(payload: string) {
    this.out.push(mulawB64ToPcm16(payload));
  }
  clearAudio() {
    this.out.clear();
    this.send({ action: 'clear' });
  }
}

/** Bandwidth <StartStream mode="bidirectional">: JSON frames of base64 PCMU. */
export class BandwidthTransport extends BaseTransport {
  protected handle(msg: Json) {
    switch (msg.eventType) {
      case 'start': {
        const meta = (msg.metadata ?? {}) as { callId?: string; streamId?: string };
        this.emitStart(String(meta.streamId ?? ''), meta.callId);
        break;
      }
      case 'media':
        if (!msg.track || msg.track === 'inbound') this.emitAudio(String(msg.payload ?? ''));
        break;
      case 'stop':
        this.emitStop();
        break;
    }
  }
  sendAudio(payload: string) {
    this.send({ eventType: 'playAudio', media: { contentType: 'audio/pcmu', payload } });
  }
  clearAudio() {
    this.send({ eventType: 'clear' });
  }
}

/** Lowercase provider names that have a media-stream protocol (the /ws/<provider>/ segment). */
export const STREAM_PROVIDERS = [
  'twilio',
  'signalwire',
  'plivo',
  'telnyx',
  'exotel',
  'vonage',
  'bandwidth',
] as const;

export function createTransport(provider: string, ws: WebSocket): MediaTransport | null {
  switch (provider) {
    case 'twilio':
    case 'signalwire':
      return new TwilioTransport(ws);
    case 'plivo':
      return new PlivoTransport(ws);
    case 'telnyx':
      return new TelnyxTransport(ws);
    case 'exotel':
      return new ExotelTransport(ws);
    case 'vonage':
      return new VonageTransport(ws);
    case 'bandwidth':
      return new BandwidthTransport(ws);
    default:
      return null;
  }
}

/** μ-law at 8 kHz is 8 bytes per millisecond. */
export function mulawDurationMs(payloadB64: string): number {
  return Math.floor((payloadB64.length * 3) / 4 / 8);
}
