import { mulawDecode } from './audio';

/**
 * Records a call as it is heard: both sides on one timeline, mixed to a mono
 * 8 kHz 16-bit WAV at the end. The audio already passes through the server
 * as μ-law, so recording costs no carrier feature and works on every
 * carrier, AI calls and dialer calls alike.
 *
 * The remote side (the person on the phone) arrives in real time and is laid
 * down where it falls. The local side (the agent's voice, or the dialer
 * user's) can arrive faster than it plays, because the carrier buffers it;
 * it is laid down from where the previous chunk ends, and when the caller
 * cuts in the unplayed rest is dropped, the same as on the line.
 *
 * Audio is kept as μ-law (one byte a sample, 8 KB a second per side) in
 * one-second blocks until the call ends.
 */

const RATE = 8000;
const SILENCE = 0xff;
/** A recording shorter than this has nothing worth keeping. */
const MIN_SECONDS = 1;

class Track {
  private blocks: Uint8Array[] = [];
  length = 0;

  write(at: number, bytes: Uint8Array) {
    for (let i = 0; i < bytes.length; i++) {
      const pos = at + i;
      const index = Math.floor(pos / RATE);
      let block = this.blocks[index];
      if (!block) block = this.blocks[index] = new Uint8Array(RATE).fill(SILENCE);
      block[pos % RATE] = bytes[i]!;
    }
    this.length = Math.max(this.length, at + bytes.length);
  }

  /** Forgets everything from `at` on. */
  truncate(at: number) {
    if (at >= this.length) return;
    for (let pos = at; pos < this.length; pos++) {
      const block = this.blocks[Math.floor(pos / RATE)];
      if (block) block[pos % RATE] = SILENCE;
    }
    this.length = at;
  }

  read(length: number): Uint8Array {
    const out = new Uint8Array(length).fill(SILENCE);
    for (let index = 0; index * RATE < length; index++) {
      const block = this.blocks[index];
      if (block) out.set(block.subarray(0, Math.min(RATE, length - index * RATE)), index * RATE);
    }
    return out;
  }
}

export class CallRecorder {
  private readonly remoteTrack = new Track();
  private readonly localTrack = new Track();
  /** Where the next local chunk starts (it may be queued ahead of now). */
  private localCursor = 0;
  /** The recording starts with the first audio, not when the call was dialled. */
  private startedAt: number | null = null;

  constructor(private readonly now: () => number = Date.now) {}

  private elapsed(): number {
    this.startedAt ??= this.now();
    return Math.max(0, Math.round(((this.now() - this.startedAt) * RATE) / 1000));
  }

  /** The person on the phone, μ-law base64 as the carrier sends it. */
  remote(payloadB64: string) {
    const bytes = Buffer.from(payloadB64, 'base64');
    // Frames arrive every 20 ms: keep them back to back unless a real gap opened.
    const at = this.elapsed();
    const start = at - this.remoteTrack.length < RATE / 5 ? this.remoteTrack.length : at;
    this.remoteTrack.write(start, bytes);
  }

  /** The agent (or the dialer user), μ-law base64 as it is sent to the carrier. */
  local(payloadB64: string) {
    const bytes = Buffer.from(payloadB64, 'base64');
    const at = Math.max(this.elapsed(), this.localCursor);
    this.localTrack.write(at, bytes);
    this.localCursor = at + bytes.length;
  }

  /** The carrier's queue was cleared: what hadn't played yet was never heard. */
  interrupt() {
    if (this.startedAt === null) return;
    const now = this.elapsed();
    this.localTrack.truncate(now);
    this.localCursor = now;
  }

  /** The mixed call as a WAV file, or null when there is (almost) nothing on it. */
  toWav(): Buffer | null {
    const length = Math.max(this.remoteTrack.length, this.localTrack.length);
    if (length < RATE * MIN_SECONDS) return null;
    const a = mulawDecode(this.remoteTrack.read(length));
    const b = mulawDecode(this.localTrack.read(length));
    const data = Buffer.alloc(length * 2);
    for (let i = 0; i < length; i++) {
      const mixed = a[i]! + b[i]!;
      data.writeInt16LE(mixed > 32767 ? 32767 : mixed < -32768 ? -32768 : mixed, i * 2);
    }
    return Buffer.concat([wavHeader(data.length), data]);
  }
}

function wavHeader(dataBytes: number): Buffer {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + dataBytes, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(dataBytes, 40);
  return h;
}
