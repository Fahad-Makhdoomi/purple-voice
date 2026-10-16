import type { EventEmitter } from 'node:events';
import {
  LIVE_CALL_STATUSES,
  type CallStatus,
  type DialerEndReason,
  type DialerServerMessage,
  type DialerStatus,
} from '@pv/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { emitEvent } from '../events';
import { applyCallStatus, isTerminal } from '../services/calls';
import { adapterForAccount } from '../telephony';
import type { MediaTransport } from './transports';

/**
 * The browser dialer's media bridge: a person's browser on one side, the
 * carrier's audio stream on the other, no AI in between.
 *
 * The browser opens /ws/dialer/<callId>/<sig> right after placing the call;
 * the carrier opens its usual media stream once the callee answers. Either
 * may arrive first, so both meet here, in a registry keyed by call id (the
 * API runs as one process). Audio is μ-law 8 kHz on both sides: carrier
 * frames go to the browser as binary WebSocket frames, and the browser's
 * binary frames go back to the carrier untouched. Control messages are JSON
 * text frames (see packages/shared/src/dialer.ts).
 *
 * The call ends when either side leaves: the browser closing (or sending
 * hangup) hangs up the carrier call; the carrier's stream stopping tells the
 * browser `ended`. The bridge also polls the call row, so a call that is
 * never answered (no answer, busy, failed) still ends the browser's wait.
 */

/** The browser's socket: a `ws` WebSocket, or a fake in tests. */
export interface BrowserSocket extends Pick<EventEmitter, 'on'> {
  readonly readyState: number;
  send(data: Buffer | string): void;
  close(code?: number, reason?: string): void;
}

/** What the bridge needs from the database and carrier; injected so tests need neither. */
export interface BridgeDeps {
  /** The call's current status, or null if the row is gone. */
  callStatus(): Promise<CallStatus | null>;
  /** Ends the call on the carrier, cancelling it if it's still ringing. */
  hangup(): Promise<void>;
  /** The carrier's audio stream started: the callee picked up. */
  onAnswered?(): void;
  /** The bridge is over; `reason` is what the browser was told. */
  onEnded?(reason: DialerEndReason): void;
}

export interface BridgeTimings {
  /** How often to re-read the call's status. */
  pollMs: number;
  /** Hang up if the callee hasn't answered this long after the bridge opened. */
  ringTimeoutMs: number;
  /** Hang up if the browser hasn't joined this long after the callee answered. */
  browserTimeoutMs: number;
  /** Longest call; nginx holds /ws/ connections for a little over an hour. */
  maxCallMs: number;
  /** How long an ended bridge keeps answering late sockets with `ended`. */
  tombstoneMs: number;
}

export const DEFAULT_TIMINGS: BridgeTimings = {
  pollMs: 2_000,
  ringTimeoutMs: 90_000,
  browserTimeoutMs: 15_000,
  maxCallMs: 60 * 60_000,
  tombstoneMs: 60_000,
};

const OPEN = 1;
/** Browser frames are 20 ms (160 bytes); anything far larger isn't ours. */
const MAX_BROWSER_FRAME = 1600;
/** Close code for a second browser socket on a call that already has one. */
const ALREADY_CONNECTED = 4009;

type RawData = Buffer | ArrayBuffer | Buffer[];

function toBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

function sendJson(socket: BrowserSocket, msg: DialerServerMessage) {
  if (socket.readyState === OPEN) socket.send(JSON.stringify(msg));
}

/** What to tell the browser when the call row reaches a final status. */
export function endReasonFor(status: CallStatus, answered: boolean): DialerEndReason {
  switch (status) {
    case 'NO_ANSWER':
      return 'no_answer';
    case 'BUSY':
      return 'busy';
    case 'FAILED':
      return 'failed';
    case 'CANCELED':
      return 'canceled';
    default:
      return answered ? 'remote_hangup' : 'failed';
  }
}

const isLive = (status: CallStatus) => LIVE_CALL_STATUSES.includes(status);

export class DialerBridge {
  private browser?: BrowserSocket;
  private carrier?: MediaTransport;
  private answered = false;
  private ended = false;
  private reason?: DialerEndReason;
  private polling = false;
  private pollTimer?: NodeJS.Timeout;
  private deadline?: NodeJS.Timeout;
  private maxTimer?: NodeJS.Timeout;

  constructor(
    readonly callId: string,
    private readonly deps: BridgeDeps,
    private readonly timings: BridgeTimings = DEFAULT_TIMINGS,
    private readonly onFinished?: () => void,
  ) {}

  get isEnded() {
    return this.ended;
  }
  get endReason() {
    return this.reason;
  }
  get isAnswered() {
    return this.answered;
  }

  /** Starts the status poll and the ring timeout. */
  start() {
    this.pollTimer = setInterval(() => void this.poll(), this.timings.pollMs);
    this.arm(this.timings.ringTimeoutMs, 'timeout');
  }

  attachBrowser(socket: BrowserSocket) {
    if (this.ended) {
      sendJson(socket, { type: 'status', status: 'ended', reason: this.reason });
      socket.close(1000, 'ended');
      return;
    }
    // One browser per call; the first keeps it. Nobody can take over a live call.
    if (this.browser && this.browser.readyState === OPEN) {
      socket.close(ALREADY_CONNECTED, 'already connected');
      return;
    }
    this.browser = socket;
    socket.on('message', (data: RawData, isBinary: boolean) =>
      this.fromBrowser(socket, data, isBinary),
    );
    socket.on('close', () => this.browserLeft(socket));
    socket.on('error', () => this.browserLeft(socket));
    this.status(this.answered ? 'answered' : 'ringing');
    // The callee already answered and was waiting for us.
    if (this.answered) this.disarm();
  }

  attachCarrier(transport: MediaTransport) {
    if (this.ended) {
      transport.close();
      return;
    }
    // A second stream for the same call replaces the first; the old one's events are ignored.
    const previous = this.carrier;
    this.carrier = transport;
    previous?.close();

    transport.onStart(() => {
      if (transport !== this.carrier || this.ended) return;
      this.onAnswer();
    });
    transport.onAudio((payload) => {
      if (transport !== this.carrier) return;
      const browser = this.browser;
      if (browser?.readyState === OPEN) browser.send(Buffer.from(payload, 'base64'));
    });
    transport.onStop(() => {
      if (transport !== this.carrier) return;
      this.finish(this.answered ? 'remote_hangup' : 'failed');
    });
  }

  /** You hung up (or a timeout did): end the carrier call and tell the browser. */
  async hangup(reason: DialerEndReason = 'hangup'): Promise<void> {
    if (!this.finish(reason)) return;
    try {
      await this.deps.hangup();
    } catch (err) {
      logger.warn({ err, callId: this.callId }, 'Dialer hangup failed');
    }
  }

  private onAnswer() {
    if (this.answered) return;
    this.answered = true;
    this.disarm();
    this.maxTimer = setTimeout(() => void this.hangup('time_limit'), this.timings.maxCallMs);
    if (this.browser) this.status('answered');
    else this.arm(this.timings.browserTimeoutMs, 'error');
    this.deps.onAnswered?.();
  }

  private fromBrowser(socket: BrowserSocket, data: RawData, isBinary: boolean) {
    if (socket !== this.browser || this.ended) return;
    const buf = toBuffer(data);
    if (isBinary) {
      // Until the carrier's stream has started it has no stream id to play into.
      if (!this.answered || !this.carrier) return;
      if (buf.length === 0 || buf.length > MAX_BROWSER_FRAME) return;
      this.carrier.sendAudio(buf.toString('base64'));
      return;
    }
    let msg: unknown;
    try {
      msg = JSON.parse(buf.toString('utf8'));
    } catch {
      return;
    }
    if ((msg as { type?: unknown } | null)?.type === 'hangup') void this.hangup('hangup');
  }

  private browserLeft(socket: BrowserSocket) {
    if (socket !== this.browser) return;
    this.browser = undefined;
    // Closing the tab mid-call must not leave the callee talking to nobody.
    void this.hangup('hangup');
  }

  private async poll() {
    if (this.polling || this.ended) return;
    this.polling = true;
    try {
      const status = await this.deps.callStatus();
      if (this.ended) return;
      if (status === null) await this.hangup('error');
      else if (!isLive(status)) this.finish(endReasonFor(status, this.answered));
    } catch (err) {
      // A database blip: the next poll tries again.
      logger.warn({ err, callId: this.callId }, 'Dialer status poll failed');
    } finally {
      this.polling = false;
    }
  }

  private status(status: DialerStatus) {
    if (this.browser) sendJson(this.browser, { type: 'status', status });
  }

  private arm(ms: number, reason: DialerEndReason) {
    this.disarm();
    this.deadline = setTimeout(() => void this.hangup(reason), ms);
  }

  private disarm() {
    clearTimeout(this.deadline);
    this.deadline = undefined;
  }

  /** Ends the bridge once: tells the browser, closes both sides. False if already ended. */
  private finish(reason: DialerEndReason): boolean {
    if (this.ended) return false;
    this.ended = true;
    this.reason = reason;
    clearInterval(this.pollTimer);
    clearTimeout(this.maxTimer);
    this.disarm();

    const browser = this.browser;
    this.browser = undefined;
    if (browser) {
      sendJson(browser, { type: 'status', status: 'ended', reason });
      browser.close(1000, 'ended');
    }
    const carrier = this.carrier;
    this.carrier = undefined;
    carrier?.close();

    this.deps.onEnded?.(reason);
    this.onFinished?.();
    return true;
  }
}

/**
 * Live bridges by call id. An ended bridge stays a while as a tombstone, so
 * a late or repeated socket for that call is told `ended` instead of
 * starting a new wait.
 */
export class DialerRegistry {
  private readonly bridges = new Map<string, DialerBridge>();
  /** Lets the media server count live bridges alongside AI sessions. */
  readonly hooks: {
    opened?: (bridge: DialerBridge) => void;
    closed?: (bridge: DialerBridge) => void;
  } = {};

  constructor(
    private readonly depsFor: (callId: string) => BridgeDeps,
    private readonly timings: BridgeTimings = DEFAULT_TIMINGS,
  ) {}

  get(callId: string): DialerBridge | undefined {
    return this.bridges.get(callId);
  }

  /** Bridges still carrying (or waiting for) a call. */
  get liveCount(): number {
    let n = 0;
    for (const b of this.bridges.values()) if (!b.isEnded) n++;
    return n;
  }

  /** The call's bridge, opened on first use. */
  open(callId: string): DialerBridge {
    const existing = this.bridges.get(callId);
    if (existing) return existing;
    const bridge: DialerBridge = new DialerBridge(
      callId,
      this.depsFor(callId),
      this.timings,
      () => {
        this.hooks.closed?.(bridge);
        const timer = setTimeout(() => {
          if (this.bridges.get(callId) === bridge) this.bridges.delete(callId);
        }, this.timings.tombstoneMs);
        timer.unref?.();
      },
    );
    this.bridges.set(callId, bridge);
    this.hooks.opened?.(bridge);
    bridge.start();
    return bridge;
  }
}

// ── Production wiring: the database and the carrier ─────────────────────────

/**
 * Ends a dialer call on the carrier. Hanging up a ringing call cancels it;
 * the row is closed right away, so if the carrier still connects it, the
 * answer webhook sees a finished call and hangs up.
 */
export async function hangupCarrierCall(callId: string): Promise<void> {
  const call = await prisma.call.findUnique({
    where: { id: callId },
    include: { phoneNumber: { include: { telephonyAccount: true } } },
  });
  if (!call || isTerminal(call.status)) return;
  if (call.providerCallId && call.phoneNumber) {
    await adapterForAccount(call.phoneNumber.telephonyAccount)
      .hangup(call.providerCallId)
      .catch((err) => logger.warn({ err, callId }, 'Carrier hangup failed'));
  }
  if (call.status === 'QUEUED' || call.status === 'RINGING') {
    await applyCallStatus(callId, 'CANCELED');
  }
}

async function announceAnswered(callId: string) {
  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call) return;
  await emitEvent(call.workspaceId, 'call.started', {
    callId: call.id,
    direction: call.direction,
    fromNumber: call.fromNumber,
    toNumber: call.toNumber,
    agentId: null,
    campaignId: null,
    placedById: call.placedById,
  });
}

/** Records why the call ended and makes sure the row is closed even if the carrier's callback never comes. */
async function settle(callId: string, reason: DialerEndReason) {
  await prisma.call.updateMany({
    where: { id: callId, endReason: null },
    data: { endReason: reason },
  });
  const timer = setTimeout(async () => {
    try {
      const call = await prisma.call.findUnique({
        where: { id: callId },
        select: { status: true, answeredAt: true },
      });
      if (call && !isTerminal(call.status)) {
        await applyCallStatus(callId, call.answeredAt ? 'COMPLETED' : 'CANCELED');
      }
    } catch (err) {
      logger.error({ err, callId }, 'Could not close dialer call');
    }
  }, 30_000);
  timer.unref?.();
}

function databaseDeps(callId: string): BridgeDeps {
  return {
    callStatus: async () =>
      (await prisma.call.findUnique({ where: { id: callId }, select: { status: true } }))?.status ??
      null,
    hangup: () => hangupCarrierCall(callId),
    onAnswered: () =>
      void announceAnswered(callId).catch((err) =>
        logger.warn({ err, callId }, 'call.started event failed'),
      ),
    onEnded: (reason) =>
      void settle(callId, reason).catch((err) =>
        logger.error({ err, callId }, 'Could not record dialer call end'),
      ),
  };
}

export const dialerBridges = new DialerRegistry(databaseDeps);

/** Hangs up a dialer call: through its live bridge, or on the carrier directly if it has none. */
export async function hangupDialerCall(callId: string): Promise<void> {
  const bridge = dialerBridges.get(callId);
  if (bridge && !bridge.isEnded) return bridge.hangup('hangup');
  await hangupCarrierCall(callId);
}
