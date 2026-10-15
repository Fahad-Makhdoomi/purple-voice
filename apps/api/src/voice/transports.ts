import type WebSocket from 'ws';

/**
 * A carrier's bidirectional audio stream over WebSocket. Both supported
 * carriers send and receive 8 kHz μ-law, base64 encoded — the same format
 * OpenAI Realtime and Deepgram accept — so audio passes through untouched.
 */
export interface MediaTransport {
  /** Fires once the carrier has identified the stream. */
  onStart(cb: (info: { streamId: string; providerCallId?: string }) => void): void;
  onAudio(cb: (payloadB64: string) => void): void;
  onStop(cb: () => void): void;
  sendAudio(payloadB64: string): void;
  /** Drops audio queued on the carrier side (caller interrupted the agent). */
  clearAudio(): void;
  close(): void;
}

type Json = Record<string, unknown>;

abstract class BaseTransport implements MediaTransport {
  protected streamId = '';
  private startCb?: (info: { streamId: string; providerCallId?: string }) => void;
  private audioCb?: (payload: string) => void;
  private stopCb?: () => void;
  private stopped = false;

  constructor(protected readonly ws: WebSocket) {
    ws.on('message', (raw) => {
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

  protected emitStart(streamId: string, providerCallId?: string) {
    this.streamId = streamId;
    this.startCb?.({ streamId, providerCallId });
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

  onStart(cb: (info: { streamId: string; providerCallId?: string }) => void) {
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

/** Twilio Media Streams protocol. */
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

export function createTransport(provider: string, ws: WebSocket): MediaTransport | null {
  if (provider === 'twilio') return new TwilioTransport(ws);
  if (provider === 'plivo') return new PlivoTransport(ws);
  return null;
}

/** μ-law at 8 kHz is 8 bytes per millisecond. */
export function mulawDurationMs(payloadB64: string): number {
  return Math.floor((payloadB64.length * 3) / 4 / 8);
}
