import {
  DTMF_FREQUENCIES,
  type DialerEndReason,
  type DialerServerMessage,
  type DialpadKey,
} from '@pv/shared';
import { api } from './api';

/**
 * The browser end of a dialer call: microphone and speakers on one side, the
 * call's audio WebSocket on the other (protocol in packages/shared/src/dialer.ts).
 * Resampling and μ-law coding run off the main thread in public/dialer-worklet.js.
 */

const WORKLET_URL = '/dialer-worklet.js';
const KEY_TONE_MS = 150;

/**
 * The call's audio socket. In production the site and API share an origin
 * and nginx sends /ws/ to the API; in development Next proxies /ws/ to it
 * (next.config.mjs), so the same relative path works in both.
 */
export function dialerSocketUrl(path: string): string {
  const { protocol, host } = window.location;
  return `${protocol === 'https:' ? 'wss:' : 'ws:'}//${host}${path}`;
}

/** Something stopped the call audio from starting; `message` is written for the person calling. */
export class DialerSetupError extends Error {}

/** Plain-language reason the microphone couldn't be opened. */
export function microphoneErrorMessage(err: unknown): string {
  const name = err instanceof Error || err instanceof DOMException ? err.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Microphone access is blocked. Allow it from the icon in your browser’s address bar, then call again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No microphone found. Plug in a headset or microphone and try again.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Your microphone is in use by another app (a video call, perhaps). Close it and try again.';
    case 'SecurityError':
      return 'This browser blocked the microphone here. Calls need a secure (https) connection.';
    default:
      return 'Could not start your microphone. Check it is connected and try again.';
  }
}

export type CallPhase = 'connecting' | 'ringing' | 'answered' | 'ended';

export interface BrowserCallHandlers {
  onPhase(phase: CallPhase, reason?: DialerEndReason): void;
}

/**
 * One call from this browser. Create it inside the click handler (browsers
 * only start audio from a user gesture), then `prepare()` for the
 * microphone, place the call with the API, and `connect()` its socket.
 */
export class BrowserCall {
  private readonly ctx: AudioContext;
  private mic?: MediaStream;
  private capture?: AudioWorkletNode;
  private playback?: AudioWorkletNode;
  private stopRingback?: () => void;
  private ws?: WebSocket;
  private callId?: string;
  private phase: CallPhase = 'connecting';
  /** The call is over (or was abandoned before it started). */
  private disposed = false;
  private released = false;

  constructor(private readonly handlers: BrowserCallHandlers) {
    this.ctx = new AudioContext({ latencyHint: 'interactive' });
    void this.ctx.resume().catch(() => undefined);
  }

  get isOver() {
    return this.disposed;
  }

  /** Opens the microphone and the audio graph. Throws DialerSetupError. */
  async prepare(): Promise<void> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new DialerSetupError(
        'Calling needs a secure (https) page and a browser with microphone support.',
      );
    }
    try {
      this.mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
    } catch (err) {
      throw new DialerSetupError(microphoneErrorMessage(err));
    }
    if (this.disposed) return this.release();

    try {
      await this.ctx.audioWorklet.addModule(WORKLET_URL);
    } catch {
      throw new DialerSetupError(
        'Call audio could not start in this browser. Try the latest Chrome, Edge, Firefox or Safari.',
      );
    }
    if (this.disposed) return this.release();

    const source = this.ctx.createMediaStreamSource(this.mic);
    const capture = new AudioWorkletNode(this.ctx, 'pv-dialer-capture', {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 1,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    });
    // The capture node outputs nothing audible, but must reach the destination to be run.
    const sink = this.ctx.createGain();
    sink.gain.value = 0;
    source.connect(capture);
    capture.connect(sink).connect(this.ctx.destination);
    capture.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
      if (this.phase === 'answered' && this.ws?.readyState === WebSocket.OPEN) this.ws.send(e.data);
    };

    const playback = new AudioWorkletNode(this.ctx, 'pv-dialer-playback', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    });
    playback.connect(this.ctx.destination);
    this.capture = capture;
    this.playback = playback;
  }

  /** Opens the call's audio socket once the API has placed it. */
  connect(callId: string, socketPath: string) {
    this.callId = callId;
    // Hung up while the call was being placed: cancel it.
    if (this.disposed) return this.cancelOnServer();

    const ws = new WebSocket(dialerSocketUrl(socketPath));
    ws.binaryType = 'arraybuffer';
    this.ws = ws;
    ws.onmessage = (e: MessageEvent<ArrayBuffer | string>) => {
      if (typeof e.data !== 'string') {
        this.playback?.port.postMessage(e.data, [e.data]);
        return;
      }
      let msg: DialerServerMessage;
      try {
        msg = JSON.parse(e.data) as DialerServerMessage;
      } catch {
        return;
      }
      if (msg.type === 'status') this.setPhase(msg.status, msg.reason);
    };
    let opened = false;
    ws.onopen = () => (opened = true);
    ws.onclose = () => {
      // Closed without the server saying the call ended: we never connected, or the network dropped.
      if (this.phase === 'ended') return;
      this.cancelOnServer();
      this.setPhase('ended', opened ? 'error' : 'failed');
    };
  }

  /** Ends the call, or cancels it if it hasn't been answered. */
  hangup() {
    if (this.phase === 'ended') return;
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'hangup' }));
    else this.cancelOnServer();
    this.setPhase('ended', 'hangup');
  }

  setMuted(muted: boolean) {
    this.capture?.port.postMessage({ type: 'mute', muted });
  }

  /** A keypad press during the call: a DTMF tone down the line, and a short one locally. */
  sendDigit(key: DialpadKey) {
    if (this.phase !== 'answered') return;
    const [low, high] = DTMF_FREQUENCIES[key];
    this.capture?.port.postMessage({ type: 'dtmf', low, high, ms: KEY_TONE_MS });
    this.tone([low, high], KEY_TONE_MS / 1000);
  }

  private setPhase(phase: CallPhase, reason?: DialerEndReason) {
    if (this.phase === 'ended' || this.phase === phase) return;
    this.phase = phase;
    if (phase === 'ringing') this.ringback();
    else this.stopRingback?.();
    if (phase === 'ended') this.release();
    this.handlers.onPhase(phase, reason);
  }

  private cancelOnServer() {
    if (!this.callId) return;
    void api(`/app/dialer/calls/${this.callId}/hangup`, { method: 'POST' }).catch(() => undefined);
  }

  /** Plays two sine tones for `seconds`, with short ramps so they don't click. */
  private tone(freqs: readonly number[], seconds: number, level = 0.08) {
    if (this.ctx.state === 'closed') return;
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(level, t + 0.005);
    gain.gain.setValueAtTime(level, t + seconds - 0.005);
    gain.gain.linearRampToValueAtTime(0, t + seconds);
    gain.connect(this.ctx.destination);
    for (const f of freqs) {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = f;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + seconds + 0.01);
      osc.onended = () => gain.disconnect();
    }
  }

  /** Local ringback (440 + 480 Hz, two seconds on, four off) while the other phone rings. */
  private ringback() {
    if (this.stopRingback || this.ctx.state === 'closed') return;
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    gain.connect(this.ctx.destination);
    for (let i = 0; i < 30; i++) {
      const on = t + 0.2 + i * 6;
      gain.gain.setTargetAtTime(0.05, on, 0.01);
      gain.gain.setTargetAtTime(0, on + 2, 0.01);
    }
    const oscs = [440, 480].map((f) => {
      const osc = this.ctx.createOscillator();
      osc.frequency.value = f;
      osc.connect(gain);
      osc.start(t);
      return osc;
    });
    this.stopRingback = () => {
      this.stopRingback = undefined;
      for (const osc of oscs) osc.stop();
      gain.disconnect();
    };
  }

  /** Stops the microphone, the audio and the socket. Safe to call more than once. */
  release() {
    this.disposed = true;
    // Also reached when the microphone opens after the call was abandoned.
    this.mic?.getTracks().forEach((track) => track.stop());
    this.mic = undefined;
    if (this.released) return;
    this.released = true;
    this.stopRingback?.();
    this.capture?.port.postMessage({ type: 'stop' });
    this.playback?.port.postMessage({ type: 'stop' });
    this.capture?.disconnect();
    this.playback?.disconnect();
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) this.ws.close(1000);
    void this.ctx.close().catch(() => undefined);
  }
}
