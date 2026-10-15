import { describe, expect, it } from 'vitest';
import {
  Downsampler24kTo8k,
  Upsampler8kTo16k,
  mulawDecode,
  mulawEncode,
  pcm16FromBytes,
  pcm16ToBuffer,
} from '../src/voice/audio';

function tone(hz: number, rate: number, samples: number, amplitude = 10_000): Int16Array {
  const out = new Int16Array(samples);
  for (let i = 0; i < samples; i++)
    out[i] = Math.round(amplitude * Math.sin((2 * Math.PI * hz * i) / rate));
  return out;
}

function rms(samples: ArrayLike<number>, from = 0): number {
  let sum = 0;
  for (let i = from; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / (samples.length - from));
}

/** Amplitude of one frequency (Goertzel), normalised so a full-scale sine of amplitude A gives A. */
function amplitudeAt(samples: ArrayLike<number>, hz: number, rate: number, from = 0): number {
  const w = (2 * Math.PI * hz) / rate;
  let re = 0;
  let im = 0;
  for (let i = from; i < samples.length; i++) {
    re += samples[i] * Math.cos(w * i);
    im -= samples[i] * Math.sin(w * i);
  }
  return (2 * Math.hypot(re, im)) / (samples.length - from);
}

/** Splits bytes into uneven pieces, including odd lengths and single bytes. */
function chunks(bytes: Buffer, sizes = [1, 7, 333, 2, 1001, 3, 64, 5]): Buffer[] {
  const out: Buffer[] = [];
  for (let at = 0, i = 0; at < bytes.length; i++) {
    const size = sizes[i % sizes.length];
    out.push(bytes.subarray(at, at + size));
    at += size;
  }
  return out;
}

function concat(parts: Int16Array[]): Int16Array {
  const out = new Int16Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

describe('G.711 μ-law', () => {
  it('round-trips every sample within half a quantisation step', () => {
    const all = new Int16Array(65536);
    for (let i = 0; i < all.length; i++) all[i] = i - 32768;
    const back = mulawDecode(mulawEncode(all));
    const outside: number[] = [];
    for (let i = 0; i < all.length; i++) {
      const s = all[i];
      const err = Math.abs(back[i] - s);
      // Beyond ±32635 the codec clips to its largest level, ±32124.
      const bound = Math.abs(s) <= 32635 ? (Math.abs(s) + 0x84) / 32 : Math.abs(s) - 32124;
      if (err > bound) outside.push(s);
    }
    expect(outside).toEqual([]);
  });

  it('matches the G.711 reference points', () => {
    expect([...mulawEncode(Int16Array.of(0, 32767, -32768))]).toEqual([0xff, 0x80, 0x00]);
    expect([...mulawDecode(Buffer.from([0xff, 0x7f, 0x80, 0x00]))]).toEqual([0, 0, 32124, -32124]);
    // Decoding then re-encoding any byte lands on the same level.
    const bytes = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
    expect(mulawDecode(mulawEncode(mulawDecode(bytes)))).toEqual(mulawDecode(bytes));
  });

  it('encodes PCM16LE bytes the same as samples', () => {
    const samples = tone(440, 8000, 400);
    expect(mulawEncode(pcm16ToBuffer(samples))).toEqual(mulawEncode(samples));
    expect(pcm16FromBytes(pcm16ToBuffer(samples))).toEqual(samples);
  });
});

describe('24 kHz → 8 kHz downsampler', () => {
  const settle = 100; // skip the filter's warm-up at 8 kHz

  it('keeps one sample in three', () => {
    expect(new Downsampler24kTo8k().process(pcm16ToBuffer(new Int16Array(2400)))).toHaveLength(800);
  });

  it('passes 1 kHz at unity gain', () => {
    const input = tone(1000, 24_000, 24_000);
    const out = new Downsampler24kTo8k().process(pcm16ToBuffer(input));
    expect(rms(out, settle) / rms(input)).toBeGreaterThan(0.98);
    expect(rms(out, settle) / rms(input)).toBeLessThan(1.02);
  });

  it('keeps the telephone band and removes what would alias into it', () => {
    const at = (hz: number) => {
      const out = new Downsampler24kTo8k().process(pcm16ToBuffer(tone(hz, 24_000, 24_000)));
      return rms(out, settle) / rms(tone(hz, 24_000, 24_000));
    };
    expect(at(3000)).toBeGreaterThan(0.95);
    expect(at(3400)).toBeGreaterThan(0.85);
    // 6 kHz would fold back to 2 kHz, 5 kHz to 3 kHz.
    expect(at(6000)).toBeLessThan(0.001);
    expect(at(5000)).toBeLessThan(0.001);
  });

  it('gives identical output however the bytes are chunked', () => {
    const bytes = pcm16ToBuffer(tone(700, 24_000, 7_001));
    const whole = new Downsampler24kTo8k().process(bytes);
    const streaming = new Downsampler24kTo8k();
    const pieces = concat(chunks(bytes).map((c) => streaming.process(c)));
    expect(pieces).toEqual(whole);
    expect(whole).toHaveLength(Math.ceil(7_001 / 3));
  });

  it('forgets everything on reset', () => {
    const a = pcm16ToBuffer(tone(500, 24_000, 999));
    const b = pcm16ToBuffer(tone(900, 24_000, 1200));
    const used = new Downsampler24kTo8k();
    used.process(a.subarray(0, 1001)); // leaves a split sample and a partial phase behind
    used.reset();
    expect(used.process(b)).toEqual(new Downsampler24kTo8k().process(b));
  });
});

describe('8 kHz → 16 kHz upsampler', () => {
  it('doubles the sample count', () => {
    expect(new Upsampler8kTo16k().process(new Int16Array(160))).toHaveLength(320);
  });

  it('gives identical output however the samples are chunked', () => {
    const input = tone(1000, 8000, 4_003);
    const whole = new Upsampler8kTo16k().process(input);
    const streaming = new Upsampler8kTo16k();
    const parts: Int16Array[] = [];
    for (let at = 0, i = 0; at < input.length; i++) {
      const size = [1, 160, 17, 2, 333][i % 5];
      parts.push(streaming.process(input.subarray(at, at + size)));
      at += size;
    }
    expect(concat(parts)).toEqual(whole);
  });

  it('interpolates instead of repeating samples', () => {
    const input = tone(1000, 8000, 8000);
    const out = new Upsampler8kTo16k().process(input);
    // Even samples are the input, 16 samples (2 ms) late.
    for (let i = 16; i < 100; i++) expect(out[2 * i]).toBe(input[i - 16]);
    // The voice stays at full level and its 7 kHz mirror image is gone
    // (repeating each sample would leave it at about -14 dB).
    expect(amplitudeAt(out, 1000, 16_000, 64)).toBeGreaterThan(9_900);
    expect(amplitudeAt(out, 7000, 16_000, 64)).toBeLessThan(10);
    // Odd samples land on the true sine between the input samples.
    let worst = 0;
    for (let i = 64; i < out.length; i++) {
      const ideal = 10_000 * Math.sin((2 * Math.PI * 1000 * (i - 32)) / 16_000);
      worst = Math.max(worst, Math.abs(out[i] - ideal));
    }
    expect(worst).toBeLessThan(20);
  });
});
