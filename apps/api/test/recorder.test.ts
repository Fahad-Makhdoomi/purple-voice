import { describe, expect, it } from 'vitest';
import { mulawEncode } from '../src/voice/audio';
import { CallRecorder } from '../src/voice/recorder';

/** 20 ms of a constant level as μ-law base64. */
const frame = (level: number, ms = 20) =>
  mulawEncode(new Int16Array((ms * 8000) / 1000).fill(level)).toString('base64');

function samples(wav: Buffer): Int16Array {
  expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
  expect(wav.readUInt32LE(24)).toBe(8000);
  const data = wav.subarray(44);
  return new Int16Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.length));
}

describe('CallRecorder', () => {
  it('keeps nothing for a call with (almost) no audio', () => {
    const r = new CallRecorder();
    r.remote(frame(1000));
    expect(r.toWav()).toBeNull();
  });

  it('mixes both sides on one timeline', () => {
    let now = 0;
    const r = new CallRecorder(() => now);
    // The caller talks for 1 s.
    for (let i = 0; i < 50; i++, now += 20) r.remote(frame(1000));
    // Then the agent's 1 s reply arrives all at once (the carrier buffers it).
    r.local(frame(-2000, 1000));
    const s = samples(r.toWav()!);
    expect(s.length).toBe(16000);
    expect(Math.abs(s[4000]! - 1000)).toBeLessThan(80); // caller only
    expect(Math.abs(s[12000]! + 2000)).toBeLessThan(150); // agent only
  });

  it('drops the part of a reply the caller cut off', () => {
    let now = 0;
    const r = new CallRecorder(() => now);
    r.remote(frame(0));
    r.local(frame(3000, 2000)); // 2 s queued
    now = 500;
    r.interrupt(); // heard only the first half second
    for (let i = 0; i < 50; i++, now += 20) r.remote(frame(0));
    const s = samples(r.toWav()!);
    expect(Math.abs(s[2000]! - 3000)).toBeLessThan(200); // before the cut
    expect(s[8000]).toBe(0); // after it: silence
  });

  it('starts at the first audio, not when the call was dialled', () => {
    let now = 0;
    const r = new CallRecorder(() => now);
    now = 30_000; // half a minute of ringing
    for (let i = 0; i < 60; i++, now += 20) r.remote(frame(500));
    expect(samples(r.toWav()!).length).toBe(9600);
  });
});
