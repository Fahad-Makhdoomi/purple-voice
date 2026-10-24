import { describe, expect, it } from 'vitest';
import { mulawDecode, mulawEncode } from '../src/voice/audio';
import { EchoGuard } from '../src/voice/echo-guard';
import { rms } from '../src/voice/noise-gate';

const FRAME = 160;
/** 20 ms of noise-like audio at roughly `level` RMS, as μ-law base64. */
function frame(level: number, seed: number): string {
  const s = new Int16Array(FRAME);
  let x = seed * 9301 + 49297;
  for (let i = 0; i < FRAME; i++) {
    x = (x * 9301 + 49297) % 233280;
    s[i] = Math.round(((x / 233280) * 2 - 1) * level * 1.7);
  }
  return mulawEncode(s).toString('base64');
}
const level = (b64: string) => rms(mulawDecode(Buffer.from(b64, 'base64')));
/** A speech-like loudness contour: syllables rising and falling. */
const contour = (i: number) => 900 + 800 * Math.abs(Math.sin(i / 3)) + (i % 7) * 60;

describe('EchoGuard', () => {
  it('learns a line that echoes the agent and mutes the echo', () => {
    let now = 0;
    const g = new EchoGuard(() => now);
    const lag = 15; // 300 ms
    const sent: number[] = [];
    let muted = 0;
    let passed = 0;
    for (let i = 0; i < 300; i++, now += 20) {
      const a = contour(i);
      sent.push(a);
      g.agentAudio(frame(a, i), now);
      const echo = i >= lag ? sent[i - lag]! * 0.5 : 20;
      const out = g.process(frame(echo, i + 1000));
      if (i > 150) level(out) < 5 ? muted++ : passed++;
    }
    expect(g.echoPath?.lag).toBeGreaterThanOrEqual(lag - 1);
    expect(g.echoPath?.lag).toBeLessThanOrEqual(lag + 1);
    expect(muted / (muted + passed)).toBeGreaterThan(0.9);
  });

  it('still lets the caller talk over the agent', () => {
    let now = 0;
    const g = new EchoGuard(() => now);
    const sent: number[] = [];
    for (let i = 0; i < 200; i++, now += 20) {
      sent.push(contour(i));
      g.agentAudio(frame(contour(i), i), now);
      g.process(frame(i >= 15 ? sent[i - 15]! * 0.4 : 20, i + 500));
    }
    expect(g.echoPath).not.toBeNull();
    // The caller speaks loudly over the agent.
    let passed = 0;
    for (let i = 200; i < 250; i++, now += 20) {
      sent.push(contour(i));
      g.agentAudio(frame(contour(i), i), now);
      const out = g.process(frame(sent[i - 15]! * 0.4 + 4000, i + 900));
      if (level(out) > 1000) passed++;
    }
    expect(passed).toBeGreaterThan(45);
  });

  it('leaves a line without echo alone', () => {
    let now = 0;
    const g = new EchoGuard(() => now);
    for (let i = 0; i < 300; i++, now += 20) {
      g.agentAudio(frame(contour(i), i), now);
      g.process(frame(30 + (i % 5), i + 1000)); // just line hiss
    }
    expect(g.echoPath).toBeNull();
    // A caller answering after the agent stops is untouched.
    now += 1000;
    expect(level(g.process(frame(1500, 1)))).toBeGreaterThan(1000);
  });
});
