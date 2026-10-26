import type { CallStatus } from '@pv/shared';
import { logger } from '../lib/logger';
import { mulawEncode } from './audio';
import type { MediaTransport } from './transports';

/**
 * Hands a live AI call to a person without the carrier's own transfer.
 *
 * A carrier transfer (Twilio redirecting the call into <Dial>, Plivo's
 * transfer API) takes the caller out of our hands. When that dial fails —
 * caller-ID rules (an Indian caller's number presented from a carrier abroad
 * is dropped), nobody answering, a media stream that keeps the call to
 * itself — the caller sits in silence or is cut off, and we never hear why.
 *
 * So Purple Voice does it itself: it places a second, ordinary outbound call
 * to the transfer number from the number the AI call is on (the same kind
 * of call every campaign makes), plays the caller a ringing tone while it
 * rings, and when the person answers joins the two audio streams. If nobody
 * answers, the agent is still on the line to say so.
 *
 * The leg's answer and status webhooks and its media stream find the
 * transfer by the AI call's id (`transferLegs`; the API runs as one process).
 */

export type TransferFailure = 'no_answer' | 'busy' | 'failed' | 'timeout' | 'caller_left';
export type TransferOutcome = { connected: true } | { connected: false; reason: TransferFailure };

export interface TransferDeps {
  /** Places the call to the person; returns the carrier's id for it. Throws if the carrier refuses. */
  dial(): Promise<string>;
  /** Hangs up, or cancels while it rings, the call to the person. */
  hangup(providerCallId: string): Promise<void>;
  /** Audio for the caller, μ-law base64: the ringing tone, then the person's voice. */
  toCaller(payloadB64: string): void;
  /** The ringing is over: drop whatever of the tone the carrier still has queued. */
  clearCaller(): void;
  /** The person's voice, for the recording. */
  onPersonAudio?(payloadB64: string): void;
  /** The person hung up after they were connected. */
  onPersonLeft(): void;
}

export interface TransferTimings {
  /** Give up if the person hasn't answered this long after the call to them was placed. */
  answerTimeoutMs: number;
  /** How often the ringing tone is topped up. */
  toneTickMs: number;
}

export const DEFAULT_TRANSFER_TIMINGS: TransferTimings = {
  answerTimeoutMs: 40_000,
  toneTickMs: 100,
};

/** How long the carrier lets the person's phone ring. */
export const TRANSFER_RING_SECONDS = 30;

const RATE = 8000;

/**
 * One cycle of a ringing tone as μ-law 8 kHz. North America rings 440 + 480 Hz,
 * two seconds on and four off; most of the rest of the world (India and the
 * UK among them) a 400 + 450 Hz double ring: 0.4 s on, 0.2 off, 0.4 on, 2 off.
 */
export function ringbackTone(northAmerican: boolean): Buffer {
  const [f1, f2] = northAmerican ? [440, 480] : [400, 450];
  const cadence = northAmerican ? [2, 4] : [0.4, 0.2, 0.4, 2];
  const total = Math.round(cadence.reduce((a, b) => a + b, 0) * RATE);
  const pcm = new Int16Array(total);
  let at = 0;
  cadence.forEach((seconds, i) => {
    const n = Math.round(seconds * RATE);
    if (i % 2 === 0) {
      for (let k = 0; k < n; k++) {
        const t = (at + k) / RATE;
        pcm[at + k] = Math.round(
          4000 * (Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t)),
        );
      }
    }
    at += n;
  });
  return mulawEncode(pcm);
}

const tones = new Map<boolean, Buffer>();
function toneFor(callerNumber: string): Buffer {
  const northAmerican = callerNumber.startsWith('+1');
  let tone = tones.get(northAmerican);
  if (!tone) tones.set(northAmerican, (tone = ringbackTone(northAmerican)));
  return tone;
}

export class TransferLeg {
  private state: 'dialling' | 'ringing' | 'connected' | 'ended' = 'dialling';
  /** The carrier's id for the call to the person (Plivo's changes once it is answered). */
  private legCallId?: string;
  private transport?: MediaTransport;
  private toneTimer?: NodeJS.Timeout;
  private toneStartedAt = 0;
  private toneSent = 0;
  private answerTimer?: NodeJS.Timeout;
  private settle!: (outcome: TransferOutcome) => void;
  private readonly result = new Promise<TransferOutcome>((resolve) => (this.settle = resolve));
  private readonly tone: Buffer;

  constructor(
    readonly callId: string,
    callerNumber: string,
    /** Said to the person when they pick up, before the caller joins. */
    readonly intro: string,
    private readonly deps: TransferDeps,
    private readonly timings: TransferTimings = DEFAULT_TRANSFER_TIMINGS,
    private readonly now: () => number = Date.now,
  ) {
    this.tone = toneFor(callerNumber);
  }

  get isConnected() {
    return this.state === 'connected';
  }

  /**
   * Calls the person, the caller hearing it ring, and resolves once they
   * answer or the attempt is over. Throws when the carrier won't place the call.
   */
  async connect(): Promise<TransferOutcome> {
    const id = await this.deps.dial();
    this.legCallId ??= id;
    if (this.state === 'ended') {
      // The caller hung up while we were dialling.
      void this.hangupLeg();
      return this.result;
    }
    if (this.state === 'dialling') {
      this.state = 'ringing';
      this.startTone();
      this.answerTimer = setTimeout(() => this.fail('timeout'), this.timings.answerTimeoutMs);
    }
    return this.result;
  }

  /**
   * The person picked up (the leg's answer webhook). False when the transfer
   * is no longer wanted, so the webhook hangs up on them instead.
   */
  answered(providerCallId?: string): boolean {
    if (providerCallId) this.legCallId = providerCallId;
    return this.state === 'dialling' || this.state === 'ringing';
  }

  /** The person's media stream. Their audio starting is what connects the two. */
  attach(transport: MediaTransport) {
    if (this.state === 'ended' || this.transport) {
      transport.close();
      return;
    }
    this.transport = transport;
    transport.onStart(({ providerCallId }) => {
      if (providerCallId) this.legCallId = providerCallId;
      this.join();
    });
    transport.onAudio((payload) => {
      if (this.state !== 'connected') return;
      this.deps.onPersonAudio?.(payload);
      this.deps.toCaller(payload);
    });
    transport.onStop(() => {
      if (this.state === 'connected') this.personLeft();
      else this.fail('failed');
    });
  }

  /** The caller's voice, passed to the person once they are connected. */
  fromCaller(payloadB64: string) {
    if (this.state === 'connected') this.transport?.sendAudio(payloadB64);
  }

  /** The carrier reported on the call to the person (the leg's status webhook). */
  status(status: CallStatus) {
    switch (status) {
      case 'COMPLETED':
      case 'CANCELED':
        if (this.state === 'connected') this.personLeft();
        else this.fail('no_answer');
        break;
      case 'NO_ANSWER':
        this.fail('no_answer');
        break;
      case 'BUSY':
        this.fail('busy');
        break;
      case 'FAILED':
        this.fail('failed');
        break;
    }
  }

  /** The caller is gone (or the AI call is over): stop, and hang up on the person. */
  end() {
    if (this.state === 'ended') return;
    const wasConnected = this.state === 'connected';
    this.stop();
    void this.hangupLeg();
    if (!wasConnected) this.settle({ connected: false, reason: 'caller_left' });
  }

  private join() {
    if (this.state !== 'ringing' && this.state !== 'dialling') return;
    this.stopTone();
    clearTimeout(this.answerTimer);
    this.deps.clearCaller();
    this.state = 'connected';
    this.settle({ connected: true });
  }

  private fail(reason: Exclude<TransferFailure, 'caller_left'>) {
    if (this.state === 'ended' || this.state === 'connected') return;
    this.stop();
    // The carrier already ended it unless we gave up waiting (or its stream broke).
    if (reason === 'timeout' || reason === 'failed') void this.hangupLeg();
    this.deps.clearCaller();
    this.settle({ connected: false, reason });
  }

  private personLeft() {
    if (this.state !== 'connected') return;
    this.stop();
    this.deps.onPersonLeft();
  }

  private stop() {
    this.state = 'ended';
    this.stopTone();
    clearTimeout(this.answerTimer);
    this.transport?.close();
  }

  private async hangupLeg() {
    if (!this.legCallId) return;
    try {
      await this.deps.hangup(this.legCallId);
    } catch (err) {
      logger.warn({ err, callId: this.callId }, 'Could not hang up the transfer call');
    }
  }

  /** Sends the ringing tone in real time, so the carrier never holds much of it. */
  private startTone() {
    this.toneStartedAt = this.now();
    this.toneSent = 0;
    const top = () => {
      const due = Math.floor(((this.now() - this.toneStartedAt) * RATE) / 1000) + RATE / 10;
      while (this.toneSent < due) {
        const at = this.toneSent % this.tone.length;
        const n = Math.min(due - this.toneSent, this.tone.length - at);
        this.deps.toCaller(this.tone.subarray(at, at + n).toString('base64'));
        this.toneSent += n;
      }
    };
    top();
    this.toneTimer = setInterval(top, this.timings.toneTickMs);
  }

  private stopTone() {
    clearInterval(this.toneTimer);
    this.toneTimer = undefined;
  }
}

/** Transfers in progress (ringing or connected), by the AI call's id. */
export const transferLegs = new Map<string, TransferLeg>();
