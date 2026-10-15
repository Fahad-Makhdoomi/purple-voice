/**
 * Audio conversion between the phone line and engines that speak linear PCM
 * (Gemini Live). Carriers send and expect 8 kHz G.711 μ-law; Gemini takes
 * 16 kHz and returns 24 kHz 16-bit PCM. Pure TypeScript and cheap enough to
 * run many calls on a small VPS: table lookups for μ-law, short FIR filters
 * for resampling.
 *
 * The resamplers are streaming and keep their filter history between chunks,
 * so feeding audio in pieces gives exactly the same samples as feeding it in
 * one go: chunk boundaries never click.
 */

// ── G.711 μ-law ────────────────────────────────────────────────────────────

const BIAS = 0x84;
const CLIP = 32635;

function encodeSample(sample: number): number {
  const sign = sample < 0 ? 0x80 : 0;
  let magnitude = sign ? -sample : sample;
  if (magnitude > CLIP) magnitude = CLIP;
  magnitude += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (magnitude & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

function decodeByte(byte: number): number {
  const u = ~byte & 0xff;
  const exponent = (u >> 4) & 0x07;
  const magnitude = ((((u & 0x0f) << 3) + BIAS) << exponent) - BIAS;
  return u & 0x80 ? -magnitude : magnitude;
}

/** Every μ-law byte as a linear sample. */
const DECODE = new Int16Array(256);
for (let b = 0; b < 256; b++) DECODE[b] = decodeByte(b);

/** Every 16-bit sample (indexed by its two's-complement bits) as μ-law: 64 KB, one lookup per sample. */
const ENCODE = new Uint8Array(65536);
for (let s = -32768; s < 32768; s++) ENCODE[s & 0xffff] = encodeSample(s);

/** μ-law bytes to 16-bit linear samples. */
export function mulawDecode(bytes: Uint8Array): Int16Array {
  const out = new Int16Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = DECODE[bytes[i]];
  return out;
}

/** 16-bit linear samples (or PCM16LE bytes) to μ-law bytes. */
export function mulawEncode(pcm: Int16Array | Uint8Array): Buffer {
  const samples = pcm instanceof Int16Array ? pcm : pcm16FromBytes(pcm);
  const out = Buffer.allocUnsafe(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = ENCODE[samples[i] & 0xffff];
  return out;
}

// ── PCM16LE ────────────────────────────────────────────────────────────────

const LITTLE_ENDIAN = new Uint8Array(Uint16Array.of(1).buffer)[0] === 1;

/** Samples as little-endian bytes. Shares memory with `samples` where the platform allows. */
export function pcm16ToBuffer(samples: Int16Array): Buffer {
  if (LITTLE_ENDIAN) return Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const out = Buffer.allocUnsafe(samples.length * 2);
  for (let i = 0; i < samples.length; i++) out.writeInt16LE(samples[i], i * 2);
  return out;
}

/** Little-endian bytes as samples; a trailing odd byte is ignored. */
export function pcm16FromBytes(bytes: Uint8Array): Int16Array {
  const out = new Int16Array(bytes.length >> 1);
  for (let i = 0; i < out.length; i++) out[i] = toInt16(bytes[2 * i] | (bytes[2 * i + 1] << 8));
  return out;
}

/** Reinterprets the low 16 bits as a signed sample. */
function toInt16(bits: number): number {
  return (bits << 16) >> 16;
}

function clamp16(x: number): number {
  return x >= 32767 ? 32767 : x <= -32768 ? -32768 : Math.round(x);
}

// ── Filter design ──────────────────────────────────────────────────────────

/** Zeroth-order modified Bessel function, for the Kaiser window. */
function besselI0(x: number): number {
  let sum = 1;
  let term = 1;
  for (let k = 1; k < 64; k++) {
    term *= (x / (2 * k)) ** 2;
    sum += term;
    if (term < sum * 1e-12) break;
  }
  return sum;
}

/** Kaiser window at offset `t` from the centre, zero at ±`half`. */
function kaiser(t: number, half: number, beta: number): number {
  const r = t / half;
  return r * r >= 1 ? 0 : besselI0(beta * Math.sqrt(1 - r * r)) / besselI0(beta);
}

function sinc(x: number): number {
  return x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
}

/** Windowed-sinc low-pass FIR with unity gain at DC. */
function lowPass(taps: number, cutoffHz: number, rateHz: number, beta: number): Float64Array {
  const h = new Float64Array(taps);
  const centre = (taps - 1) / 2;
  const fc = cutoffHz / rateHz;
  let sum = 0;
  for (let i = 0; i < taps; i++) {
    const t = i - centre;
    h[i] = 2 * fc * sinc(2 * fc * t) * kaiser(t, centre + 1, beta);
    sum += h[i];
  }
  for (let i = 0; i < taps; i++) h[i] /= sum;
  return h;
}

/**
 * Coefficients of a half-band ×2 interpolator: `c[k-1]` weighs the input
 * samples k - ½ either side of each new in-between sample. Normalised so the
 * interpolated phase has unity gain at DC, like the pass-through phase.
 */
function halfBand(half: number, beta: number): Float64Array {
  const c = new Float64Array(half);
  let sum = 0;
  for (let k = 1; k <= half; k++) {
    const t = k - 0.5;
    c[k - 1] = sinc(t) * kaiser(t, half + 0.5, beta);
    sum += 2 * c[k - 1];
  }
  for (let k = 0; k < half; k++) c[k] /= sum;
  return c;
}

/** Grows a scratch buffer only when a chunk is bigger than any before it. */
function ensure(buf: Float64Array, size: number): Float64Array {
  return buf.length >= size ? buf : new Float64Array(Math.max(size, buf.length * 2));
}

// ── 8 kHz → 16 kHz (caller audio) ──────────────────────────────────────────

/** Input samples used either side of each interpolated sample. */
const UP_HALF = 16;
/** Flat to 3.4 kHz, -6 dB at 4 kHz (the 8 kHz Nyquist), below -70 dB from 4.6 kHz. */
const UP_COEFFS = halfBand(UP_HALF, 7);
const UP_HISTORY = 2 * UP_HALF - 1;

/**
 * Doubles the sample rate with a half-band low-pass interpolator rather than
 * repeating samples, so no mirror image of the voice lands above 4 kHz. Even
 * output samples are the input samples themselves; odd ones are interpolated.
 * Delay: 16 input samples (2 ms).
 */
export class Upsampler8kTo16k {
  private history = new Float64Array(UP_HISTORY);
  private scratch: Float64Array = new Float64Array(UP_HISTORY + 320);

  /** Returns exactly two output samples per input sample. */
  process(input: Int16Array): Int16Array {
    const n = input.length;
    const z = (this.scratch = ensure(this.scratch, UP_HISTORY + n));
    z.set(this.history);
    for (let i = 0; i < n; i++) z[UP_HISTORY + i] = input[i];

    const out = new Int16Array(n * 2);
    for (let i = 0; i < n; i++) {
      const m = i + UP_HALF - 1;
      out[2 * i] = z[m];
      let acc = 0;
      for (let k = 1; k <= UP_HALF; k++) acc += UP_COEFFS[k - 1] * (z[m + k] + z[m + 1 - k]);
      out[2 * i + 1] = clamp16(acc);
    }
    this.history.set(z.subarray(n, n + UP_HISTORY));
    return out;
  }

  reset() {
    this.history.fill(0);
  }
}

// ── 24 kHz → 8 kHz (agent audio) ───────────────────────────────────────────

const DOWN_TAPS = 121;
/** -1 dB at 3.4 kHz, -52 dB at 4 kHz, below -80 dB from 4.4 kHz: nothing folds back into the voice band. */
const DOWN_COEFFS = lowPass(DOWN_TAPS, 3600, 24_000, 7);
const DOWN_HISTORY = DOWN_TAPS - 1;
const DOWN_MID = DOWN_HISTORY / 2;

/**
 * Divides the sample rate by three behind an anti-aliasing low-pass, only
 * computing the samples it keeps. Takes raw PCM16LE bytes as the model sends
 * them: a sample split across two chunks, or a chunk whose length is not a
 * multiple of three samples, carries over to the next call.
 * Delay: 60 input samples (2.5 ms).
 */
export class Downsampler24kTo8k {
  private history = new Float64Array(DOWN_HISTORY);
  private scratch: Float64Array = new Float64Array(DOWN_HISTORY + 2400);
  /** Input samples still to read before the next output sample (0–2). */
  private skip = 0;
  /** Low byte of a sample whose high byte has not arrived yet, or -1. */
  private carry = -1;

  /** Returns one output sample for every three input samples. */
  process(pcm: Uint8Array): Int16Array {
    const z = (this.scratch = ensure(this.scratch, DOWN_HISTORY + (pcm.length >> 1) + 1));
    z.set(this.history);
    let w = DOWN_HISTORY;
    let i = 0;
    if (this.carry >= 0 && pcm.length > 0) {
      z[w++] = toInt16(this.carry | (pcm[0] << 8));
      this.carry = -1;
      i = 1;
    }
    for (; i + 1 < pcm.length; i += 2) z[w++] = toInt16(pcm[i] | (pcm[i + 1] << 8));
    if (i < pcm.length) this.carry = pcm[i];
    const n = w - DOWN_HISTORY;

    const count = n > this.skip ? Math.ceil((n - this.skip) / 3) : 0;
    const out = new Int16Array(count);
    // `p` indexes the newest input sample under the filter for each output.
    let p = DOWN_HISTORY + this.skip;
    for (let o = 0; o < count; o++, p += 3) {
      // The filter is symmetric: pair each tap with its mirror, half the multiplies.
      const oldest = p - DOWN_HISTORY;
      let acc = DOWN_COEFFS[DOWN_MID] * z[p - DOWN_MID];
      for (let j = 0; j < DOWN_MID; j++) acc += DOWN_COEFFS[j] * (z[p - j] + z[oldest + j]);
      out[o] = clamp16(acc);
    }
    this.skip = p - w;
    this.history.set(z.subarray(n, w));
    return out;
  }

  /** Forgets buffered audio, e.g. when the caller interrupts and the rest of the turn is dropped. */
  reset() {
    this.history.fill(0);
    this.skip = 0;
    this.carry = -1;
  }
}
