/**
 * Purple Voice browser dialer: the audio worklet. src/lib/dialer.ts loads it
 * with audioWorklet.addModule('/dialer-worklet.js').
 *
 * The phone line is 8 kHz G.711 μ-law; the browser runs at its own rate
 * (usually 48 kHz). Two processors convert between them, off the main thread:
 *
 *   pv-dialer-capture   microphone → anti-alias low-pass → 8 kHz → μ-law →
 *                       160-byte (20 ms) frames posted to the page. Keypad
 *                       tones (DTMF) replace the microphone while they play.
 *   pv-dialer-playback  μ-law frames from the page → jitter buffer (~80 ms) →
 *                       resampled to the context rate → speakers.
 *
 * It's a static file because the CSP allows same-origin scripts only (no
 * blob: URLs). The pure parts are exported so the API's test suite can run
 * them under Node (apps/api/test/dialer.test.ts); the worklet ignores them.
 */

const LINE_RATE = 8000;
const FRAME_BYTES = 160;

// ── G.711 μ-law ────────────────────────────────────────────────────────────

const BIAS = 0x84;
const CLIP = 32635;

/** One 16-bit sample to a μ-law byte. */
export function mulawEncode(sample) {
  const sign = sample < 0 ? 0x80 : 0;
  let magnitude = sign ? -sample : sample;
  if (magnitude > CLIP) magnitude = CLIP;
  magnitude += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (magnitude & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (magnitude >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/** One μ-law byte to a 16-bit sample. */
export function mulawDecode(byte) {
  const u = ~byte & 0xff;
  const exponent = (u >> 4) & 0x07;
  const magnitude = ((((u & 0x0f) << 3) + BIAS) << exponent) - BIAS;
  return u & 0x80 ? -magnitude : magnitude;
}

/** Every μ-law byte as a float sample in −1…1. */
const DECODE = new Float32Array(256);
for (let b = 0; b < 256; b++) DECODE[b] = mulawDecode(b) / 32768;

/** A float sample in −1…1 to 16 bits. */
export function toInt16(x) {
  const s = Math.round(x * 32767);
  return s > 32767 ? 32767 : s < -32768 ? -32768 : s;
}

// ── Filters ────────────────────────────────────────────────────────────────

/** RBJ-cookbook low-pass biquad coefficients, normalised by a0. */
export function lowPassBiquad(cutoffHz, rateHz, q) {
  const w0 = (2 * Math.PI * Math.min(cutoffHz, rateHz * 0.45)) / rateHz;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    b0: (1 - cos) / 2 / a0,
    b1: (1 - cos) / a0,
    b2: (1 - cos) / 2 / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
  };
}

/**
 * Sixth-order Butterworth low-pass: three biquads with the Butterworth Q
 * values, transposed direct form II. Keeps the phone band, removes what
 * would alias (on the way down) or image (on the way up) around 4 kHz.
 */
export class LowPass {
  constructor(cutoffHz, rateHz) {
    this.stages = [0.5176, 0.7071, 1.9319].map((q) => lowPassBiquad(cutoffHz, rateHz, q));
    this.state = new Float64Array(6);
  }

  process(x) {
    const s = this.state;
    for (let i = 0; i < 3; i++) {
      const c = this.stages[i];
      const y = c.b0 * x + s[2 * i];
      s[2 * i] = c.b1 * x - c.a1 * y + s[2 * i + 1];
      s[2 * i + 1] = c.b2 * x - c.a2 * y;
      x = y;
    }
    return x;
  }
}

// ── Capture: microphone → 8 kHz μ-law frames ───────────────────────────────

/** Streaming low-pass + linear-interpolation decimator from the context rate to 8 kHz. */
export class Downsampler {
  constructor(inRate, outRate = LINE_RATE) {
    this.step = inRate / outRate;
    this.filter = new LowPass(3400, inRate);
    this.n = 0; // index of the input sample being fed
    this.next = 0; // input position of the next output sample
    this.prev = 0;
  }

  /** Feeds one input sample; appends any output samples to `out`. */
  push(x, out) {
    const y = this.filter.process(x);
    while (this.next <= this.n) {
      const frac = this.next - (this.n - 1);
      out.push(this.prev + (y - this.prev) * frac);
      this.next += this.step;
    }
    this.prev = y;
    this.n++;
    // Keep the counters small on long calls.
    if (this.n >= 1e9) {
      this.n -= 1e9;
      this.next -= 1e9;
    }
  }
}

const TONE_RAMP = 40; // 5 ms at 8 kHz, so tones start and stop without a click

/** Dual-tone (DTMF) generator at the line rate. Queued tones play one after another. */
export class ToneGenerator {
  constructor(rate = LINE_RATE, level = 0.25) {
    this.rate = rate;
    this.level = level;
    this.queue = [];
    this.tone = null;
    this.i = 0;
  }

  add(low, high, ms = 150, gapMs = 60) {
    this.queue.push({
      low,
      high,
      on: Math.round((ms * this.rate) / 1000),
      off: Math.round((gapMs * this.rate) / 1000),
    });
  }

  /** The next sample while a tone (or the gap after it) plays, else null. */
  next() {
    if (!this.tone) {
      this.tone = this.queue.shift() ?? null;
      this.i = 0;
      if (!this.tone) return null;
    }
    const t = this.tone;
    const i = this.i++;
    if (i >= t.on + t.off - 1) this.tone = null;
    if (i >= t.on) return 0;
    const ramp = Math.min(1, (i + 1) / TONE_RAMP, (t.on - i) / TONE_RAMP);
    const time = i / this.rate;
    return (
      this.level *
      ramp *
      (Math.sin(2 * Math.PI * t.low * time) + Math.sin(2 * Math.PI * t.high * time))
    );
  }
}

/** Microphone samples in, finished 20 ms μ-law frames out. */
export class CaptureEncoder {
  constructor(inRate, frameBytes = FRAME_BYTES) {
    this.down = new Downsampler(inRate);
    this.tones = new ToneGenerator();
    this.frameBytes = frameBytes;
    this.frame = new Uint8Array(frameBytes);
    this.fill = 0;
    this.muted = false;
    this.line = [];
  }

  /** `input` is one block of mic samples, or undefined when the mic gives nothing. */
  push(input, length = input ? input.length : 128) {
    const line = this.line;
    line.length = 0;
    for (let i = 0; i < length; i++) this.down.push(input && !this.muted ? input[i] : 0, line);
    const frames = [];
    for (let i = 0; i < line.length; i++) {
      const tone = this.tones.next();
      this.frame[this.fill++] = mulawEncode(toInt16(tone === null ? line[i] : tone));
      if (this.fill === this.frameBytes) {
        frames.push(this.frame);
        this.frame = new Uint8Array(this.frameBytes);
        this.fill = 0;
      }
    }
    return frames;
  }
}

// ── Playback: μ-law frames → speakers ──────────────────────────────────────

/**
 * Jitter buffer and 8 kHz → context-rate resampler. Playback starts once
 * `targetMs` of audio is queued and pauses to refill after an underrun; if
 * a burst queues more than `maxMs`, the oldest audio is dropped so the delay
 * never creeps up.
 */
export class PlaybackBuffer {
  constructor(outRate, { targetMs = 80, maxMs = 300, capacityMs = 2000 } = {}) {
    const perMs = LINE_RATE / 1000;
    this.step = LINE_RATE / outRate;
    this.target = targetMs * perMs;
    this.max = maxMs * perMs;
    this.ring = new Float32Array(capacityMs * perMs);
    this.start = 0;
    this.size = 0;
    this.playing = false;
    this.frac = 0;
    this.a = 0;
    this.b = 0;
    this.underruns = 0;
    this.filter = new LowPass(3600, outRate);
  }

  /** Line-rate samples queued and not yet played. */
  get buffered() {
    return this.size;
  }

  /** μ-law bytes from the line. */
  push(bytes) {
    const ring = this.ring;
    for (let i = 0; i < bytes.length; i++) {
      if (this.size === ring.length) this.drop(1);
      ring[(this.start + this.size) % ring.length] = DECODE[bytes[i]];
      this.size++;
    }
    if (this.size > this.max) this.drop(this.size - this.target);
  }

  drop(count) {
    this.start = (this.start + count) % this.ring.length;
    this.size -= count;
  }

  shift() {
    const v = this.ring[this.start];
    this.drop(1);
    return v;
  }

  /** Fills `out` (one render quantum at the context rate). */
  render(out) {
    for (let i = 0; i < out.length; i++) {
      if (!this.playing && this.size >= this.target) {
        this.playing = true;
        this.frac = 0;
        this.a = this.b;
        this.b = this.shift();
      }
      if (this.playing) {
        this.frac += this.step;
        while (this.frac >= 1) {
          this.frac -= 1;
          if (this.size === 0) {
            this.playing = false;
            this.underruns++;
            break;
          }
          this.a = this.b;
          this.b = this.shift();
        }
      }
      let sample;
      if (this.playing) {
        sample = this.a + (this.b - this.a) * this.frac;
      } else {
        // Waiting for audio, or ran dry: fade the last sample out instead of clicking.
        this.b *= 0.9;
        sample = this.b;
      }
      out[i] = this.filter.process(sample);
    }
  }
}

// ── The processors ─────────────────────────────────────────────────────────

/* global AudioWorkletProcessor, registerProcessor, sampleRate */
const Processor = typeof AudioWorkletProcessor === 'function' ? AudioWorkletProcessor : class {};

/** Port messages: {type:'mute', muted}, {type:'dtmf', low, high, ms}, {type:'stop'}. Posts ArrayBuffer frames. */
class CaptureProcessor extends Processor {
  constructor() {
    super();
    this.encoder = new CaptureEncoder(sampleRate);
    this.alive = true;
    this.port.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'mute') this.encoder.muted = !!m.muted;
      else if (m.type === 'dtmf') this.encoder.tones.add(m.low, m.high, m.ms);
      else if (m.type === 'stop') this.alive = false;
    };
  }

  process(inputs) {
    const mic = inputs[0] && inputs[0][0];
    for (const frame of this.encoder.push(mic)) this.port.postMessage(frame.buffer, [frame.buffer]);
    return this.alive;
  }
}

/** Port messages: ArrayBuffer of μ-law bytes, or {type:'stop'}. */
class PlaybackProcessor extends Processor {
  constructor() {
    super();
    this.buffer = new PlaybackBuffer(sampleRate);
    this.alive = true;
    this.port.onmessage = (e) => {
      if (e.data instanceof ArrayBuffer) this.buffer.push(new Uint8Array(e.data));
      else if (e.data && e.data.type === 'stop') this.alive = false;
    };
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    this.buffer.render(out[0]);
    for (let c = 1; c < out.length; c++) out[c].set(out[0]);
    return this.alive;
  }
}

if (typeof registerProcessor === 'function') {
  registerProcessor('pv-dialer-capture', CaptureProcessor);
  registerProcessor('pv-dialer-playback', PlaybackProcessor);
}
