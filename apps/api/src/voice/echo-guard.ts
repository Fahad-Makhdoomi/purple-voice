import { mulawDecode } from './audio';
import { rms } from './noise-gate';

/**
 * Line echo suppression, run on the caller's audio before the noise gate and
 * any voice engine.
 *
 * Some lines (speakerphones, cheap handsets, some mobile networks) send the
 * agent's own voice back a few hundred milliseconds later. An engine hears
 * that as the caller talking, cuts itself off, and the call turns into the
 * agent interrupting itself over and over.
 *
 * The guard keeps the loudness of what the agent said, 20 ms at a time, on
 * the timeline it plays on, and compares it with the loudness of what comes
 * back from the line. When the two move together at some delay, the line
 * echoes: the guard learns that delay and how loud the echo is, and while the
 * agent is talking it replaces caller audio with silence unless it is clearly
 * louder than the echo would be (the caller really talking over the agent).
 * Lines that don't echo are left alone. Loudness only, so it costs next to
 * nothing per call.
 */

const FRAME_MS = 20;
/** Echo delays considered: 40–900 ms (network round trip plus the carrier's buffers). */
const MIN_LAG = 2;
const MAX_LAG = 45;
/** Frames of history the delay is learned from (4 s). */
const WINDOW = 200;
/** Re-learn this often (frames). */
const LEARN_EVERY = 10;
/** Agent frames this loud or more count as the agent talking. */
const AGENT_ACTIVE_RMS = 300;
/** How closely the line must follow the agent to be called an echo. */
const MIN_CORRELATION = 0.55;
/** Agent-active frames needed in the window before deciding anything. */
const MIN_ACTIVE_FRAMES = 25;
/** Caller audio this many times louder than the expected echo is the caller talking. */
const DOUBLE_TALK = 2.5;
/** Keep suppressing this long after the agent's audio ends (the echo tail). */
const TAIL_FRAMES = 15;
const MULAW_SILENCE = 0xff;

export class EchoGuard {
  /** Agent loudness by frame index on the play timeline. */
  private readonly agent = new Map<number, number>();
  /** Caller loudness by frame index. */
  private readonly caller = new Map<number, number>();
  private lastAgentFrame = -Infinity;
  private sinceLearn = 0;
  /** The learned echo path, or null while the line shows no echo. */
  private path: { lag: number; gain: number } | null = null;

  constructor(private readonly now: () => number = Date.now) {}

  private frameAt(ms: number) {
    return Math.floor(ms / FRAME_MS);
  }

  /** Agent audio (μ-law base64) about to be played, starting at `playAtMs`. */
  agentAudio(payloadB64: string, playAtMs: number) {
    const bytes = Buffer.from(payloadB64, 'base64');
    const samples = mulawDecode(bytes);
    const per = (8000 * FRAME_MS) / 1000;
    for (let i = 0; i * per < samples.length; i++) {
      const index = this.frameAt(playAtMs) + i;
      this.agent.set(index, rms(samples.subarray(i * per, (i + 1) * per)));
      this.lastAgentFrame = Math.max(this.lastAgentFrame, index);
    }
  }

  /** The agent was cut off: what hadn't played yet never will. */
  agentStopped() {
    const now = this.frameAt(this.now());
    for (const index of this.agent.keys()) if (index > now) this.agent.delete(index);
    this.lastAgentFrame = Math.min(this.lastAgentFrame, now);
  }

  /** Caller audio (μ-law base64): returned as is, or as silence when it is echo. */
  process(payloadB64: string): string {
    const index = this.frameAt(this.now());
    const bytes = Buffer.from(payloadB64, 'base64');
    const level = rms(mulawDecode(bytes));
    this.caller.set(index, level);
    this.forget(index);
    if (++this.sinceLearn >= LEARN_EVERY) {
      this.sinceLearn = 0;
      this.learn(index);
    }
    if (!this.path || index > this.lastAgentFrame + this.path.lag + TAIL_FRAMES) return payloadB64;

    // The loudest the echo could be now, allowing a frame either side of the delay.
    let echo = 0;
    for (let d = -1; d <= 1; d++) {
      echo = Math.max(echo, this.agent.get(index - this.path.lag + d) ?? 0);
    }
    echo *= this.path.gain;
    if (echo < 1 || level > echo * DOUBLE_TALK) return payloadB64;
    return Buffer.alloc(bytes.length, MULAW_SILENCE).toString('base64');
  }

  /** Whether the line has been found to echo (for logs and tests). */
  get echoPath() {
    return this.path;
  }

  private forget(index: number) {
    const before = index - WINDOW - MAX_LAG - 5;
    for (const map of [this.agent, this.caller]) {
      for (const key of map.keys()) if (key < before) map.delete(key);
    }
  }

  /** Finds the delay at which the line's loudness best follows the agent's. */
  private learn(index: number) {
    let best: { lag: number; gain: number; r: number } | null = null;
    for (let lag = MIN_LAG; lag <= MAX_LAG; lag++) {
      let n = 0;
      let sa = 0;
      let sc = 0;
      let saa = 0;
      let scc = 0;
      let sac = 0;
      for (let i = index - WINDOW; i <= index; i++) {
        const a = this.agent.get(i - lag);
        const c = this.caller.get(i);
        if (a === undefined || c === undefined || a < AGENT_ACTIVE_RMS) continue;
        n++;
        sa += a;
        sc += c;
        saa += a * a;
        scc += c * c;
        sac += a * c;
      }
      if (n < MIN_ACTIVE_FRAMES) continue;
      const cov = sac / n - (sa / n) * (sc / n);
      const va = saa / n - (sa / n) ** 2;
      const vc = scc / n - (sc / n) ** 2;
      if (va <= 0 || vc <= 0) continue;
      const r = cov / Math.sqrt(va * vc);
      if (!best || r > best.r) best = { lag, gain: sac / saa, r };
    }
    if (!best) return;
    if (best.r >= MIN_CORRELATION) this.path = { lag: best.lag, gain: Math.min(best.gain, 2) };
    else if (best.r < MIN_CORRELATION / 2) this.path = null;
  }
}
