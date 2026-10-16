import type { NoiseFilter } from '@prisma/client';
import { mulawDecode } from './audio';

/**
 * A noise gate on the caller's line, run before any voice engine hears it.
 *
 * Engines decide "the caller is talking" from their own voice detection, so
 * traffic, a TV or people talking in the background can cut the agent off.
 * The gate passes the caller's voice and replaces everything else with
 * silence. It learns two levels as the call goes on:
 *
 *  - the line's background (a floor that drops quickly and creeps up slowly),
 *  - the caller's own speaking level (they are closest to the microphone,
 *    so they are the loudest steady voice on the line).
 *
 * A frame opens the gate only if it is clearly above the background and not
 * far below the caller's level, for long enough to be speech rather than a
 * click. While the agent is talking the bar is higher still, so echo and
 * murmurs don't count as interruptions. Frames are delayed by the attack time
 * so the start of a word is let through once the gate opens, and the gate
 * stays open briefly after speech so pauses between words aren't chopped.
 */

export interface GateSettings {
  /** Above the background by at least this factor (linear RMS). */
  floorRatio: number;
  /** At least this fraction of the caller's own speaking level. */
  speechRatio: number;
  /** Never open below this RMS (16-bit PCM). */
  minRms: number;
  /** Loud audio needed before the gate opens; also the added delay. */
  attackMs: number;
  /** Stay open this long after the last loud frame. */
  holdMs: number;
  /** Bar multiplier while the agent's voice is playing. */
  agentSpeakingRatio: number;
}

export const GATE_SETTINGS: Record<NoiseFilter, GateSettings | null> = {
  OFF: null,
  STANDARD: {
    floorRatio: 2,
    speechRatio: 0.18,
    minRms: 120,
    attackMs: 40,
    holdMs: 400,
    agentSpeakingRatio: 1.4,
  },
  STRONG: {
    floorRatio: 3.2,
    speechRatio: 0.3,
    minRms: 200,
    attackMs: 60,
    holdMs: 350,
    agentSpeakingRatio: 1.8,
  },
};

/** The caller's level is capped here so a shout early on can't mute normal speech later. */
const MAX_SPEECH_BAR = 900;
/** μ-law byte for 0 (silence). */
const MULAW_SILENCE = 0xff;

interface Frame {
  bytes: Buffer;
  keep: boolean;
}

export function rms(samples: Int16Array): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (const s of samples) sum += s * s;
  return Math.sqrt(sum / samples.length);
}

export class NoiseGate {
  private floor = 0;
  private speechLevel = 0;
  private elapsedMs = 0;
  private loudForMs = 0;
  private openUntilMs = -1;
  private queue: Frame[] = [];
  private queuedMs = 0;

  constructor(private readonly s: GateSettings) {}

  /**
   * Takes one carrier frame (μ-law 8 kHz, base64) and returns the frame to
   * pass on — the original or silence of the same length — delayed by the
   * attack time. Returns null while that first delay fills.
   */
  push(payloadB64: string, agentSpeaking = false): string | null {
    const bytes = Buffer.from(payloadB64, 'base64');
    const ms = bytes.length / 8;
    const level = rms(mulawDecode(bytes));
    this.trackFloor(level);

    const speechBar = Math.min(this.speechLevel * this.s.speechRatio, MAX_SPEECH_BAR);
    let bar = Math.max(this.s.minRms, this.floor * this.s.floorRatio, speechBar);
    if (agentSpeaking) bar *= this.s.agentSpeakingRatio;
    const loud = level >= bar;

    this.elapsedMs += ms;
    this.loudForMs = loud ? this.loudForMs + ms : 0;
    const wasOpen = this.elapsedMs - ms <= this.openUntilMs;
    if (loud && (wasOpen || this.loudForMs >= this.s.attackMs)) {
      this.openUntilMs = this.elapsedMs + this.s.holdMs;
      // Opening now: let through the start of the word held in the delay line.
      if (!wasOpen) for (const f of this.queue) f.keep = true;
    }
    const keep = this.elapsedMs <= this.openUntilMs;
    if (keep && loud) this.speechLevel = this.speechLevel * 0.95 + level * 0.05;
    else this.speechLevel *= 0.9995;

    this.queue.push({ bytes, keep });
    this.queuedMs += ms;
    if (this.queuedMs - (this.queue[0]?.bytes.length ?? 0) / 8 < this.s.attackMs) return null;
    const out = this.queue.shift()!;
    this.queuedMs -= out.bytes.length / 8;
    return out.keep
      ? out.bytes.toString('base64')
      : Buffer.alloc(out.bytes.length, MULAW_SILENCE).toString('base64');
  }

  /** Background estimate: falls fast to quiet frames, rises ~15%/s through speech. */
  private trackFloor(level: number) {
    if (this.floor === 0) this.floor = Math.max(level, 1);
    else if (level < this.floor) this.floor = this.floor * 0.8 + level * 0.2;
    else this.floor *= 1.003;
  }
}

export function createNoiseGate(filter: NoiseFilter | undefined): NoiseGate | null {
  const settings = GATE_SETTINGS[filter ?? 'STANDARD'];
  return settings ? new NoiseGate(settings) : null;
}
