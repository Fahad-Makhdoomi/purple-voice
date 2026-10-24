import WebSocket from 'ws';
import { sarvamLanguage } from '@pv/shared';
import {
  Upsampler8kTo16k,
  mulawDecode,
  mulawEncode,
  pcm16FromBytes,
  pcm16ToBuffer,
} from '../audio';
import type { SttEvents } from './deepgram';

/**
 * Sarvam AI speech for Indian languages: Saaras streaming speech-to-text
 * and Bulbul text-to-speech. Drop-in for the Deepgram pair in the cascaded
 * engine. Saaras wants 16 kHz PCM, so caller μ-law is decoded and upsampled
 * (the same filter Gemini Live uses); Bulbul returns 8 kHz audio that is
 * μ-law encoded for the carrier.
 */

const STT_URL = 'wss://api.sarvam.ai/speech-to-text/ws';
const TTS_URL = 'https://api.sarvam.ai/text-to-speech';
/** A transcript repeated this soon (after a flush that wasn't needed) is the same turn. */
const DUPLICATE_MS = 3000;

export class SarvamStt {
  private ws?: WebSocket;
  private up = new Upsampler8kTo16k();
  private last = { text: '', at: 0 };

  constructor(
    private readonly apiKey: string,
    private readonly language: string,
    private readonly events: SttEvents,
    /** Overridable for tests. */
    private readonly url = STT_URL,
  ) {}

  async connect(): Promise<void> {
    const params = new URLSearchParams({
      model: 'saaras:v3',
      mode: 'transcribe',
      'language-code': sarvamLanguage(this.language),
      sample_rate: '16000',
      input_audio_codec: 'pcm_s16le',
      vad_signals: 'true',
      flush_signal: 'true',
    });
    const ws = new WebSocket(`${this.url}?${params}`, {
      headers: { 'Api-Subscription-Key': this.apiKey },
    });
    this.ws = ws;
    ws.on('message', (raw) => {
      let msg: { type?: string; data?: Record<string, any> };
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const data = msg.data ?? {};
      if (msg.type === 'data') {
        const text: string = data.transcript?.trim() ?? '';
        const now = Date.now();
        if (text === this.last.text && now - this.last.at < DUPLICATE_MS) return;
        this.last = { text, at: now };
        if (text) {
          this.events.onTranscript(text, true);
          this.events.onUtteranceEnd();
        }
      } else if (msg.type === 'events') {
        if (data.signal_type === 'START_SPEECH') {
          this.events.onSpeechStarted();
        } else if (data.signal_type === 'END_SPEECH') {
          // Ask for the transcript now instead of waiting on Saaras to decide.
          this.sendJson({ type: 'flush' });
        }
      } else if (msg.type === 'error') {
        this.events.onError(new Error(`Sarvam STT: ${data.error ?? data.message ?? 'error'}`));
      }
    });
    ws.on('error', (err) => this.events.onError(err));
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Sarvam STT timed out')), 10_000);
      ws.once('open', () => {
        clearTimeout(timer);
        resolve();
      });
      ws.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  push(payloadB64: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    const pcm = this.up.process(mulawDecode(Buffer.from(payloadB64, 'base64')));
    this.sendJson({
      audio: {
        data: pcm16ToBuffer(pcm).toString('base64'),
        sample_rate: '16000',
        encoding: 'audio/wav',
      },
    });
  }

  private sendJson(msg: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close() {
    this.ws?.close();
  }
}

/**
 * The samples in a WAV file as μ-law 8 kHz. Bulbul is asked for 8 kHz, so
 * PCM only needs encoding; μ-law WAV passes through.
 */
export function wavToMulaw(wav: Buffer): Buffer {
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    // Not a WAV container: treat it as raw 16-bit PCM.
    return mulawEncode(pcm16FromBytes(wav.subarray(0, wav.length - (wav.length % 2))));
  }
  let format = 1;
  let rate = 8000;
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const id = wav.toString('ascii', offset, offset + 4);
    const size = wav.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (id === 'fmt ') {
      format = wav.readUInt16LE(body);
      rate = wav.readUInt32LE(body + 4);
    } else if (id === 'data') {
      // Streamed WAVs may carry a placeholder size; read to the end then.
      const end = size && body + size <= wav.length ? body + size : wav.length;
      const data = wav.subarray(body, end);
      if (rate !== 8000) throw new Error(`Sarvam TTS returned ${rate} Hz audio, expected 8000`);
      if (format === 7) return Buffer.from(data);
      return mulawEncode(pcm16FromBytes(data.subarray(0, data.length - (data.length % 2))));
    }
    offset = body + size + (size % 2);
  }
  throw new Error('Sarvam TTS returned a WAV file without audio');
}

/** Bulbul v4-flash persona voices are named name_language_style; the rest are v3. */
export function sarvamModelForVoice(voice: string): string {
  return voice.includes('_') ? 'bulbul:v4-flash' : 'bulbul:v3';
}

/**
 * Speaks `text` with a Bulbul voice and delivers μ-law in 20 ms frames.
 * Bulbul's REST endpoint returns the whole sentence at once; the cascaded
 * engine already synthesises sentence by sentence, so the first sentence
 * still starts playing quickly.
 */
export async function sarvamSpeak(
  apiKey: string,
  voice: string,
  text: string,
  onChunk: (payloadB64: string) => void,
  signal: AbortSignal,
  language = 'en-IN',
  model = sarvamModelForVoice(voice),
  url = TTS_URL,
): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'api-subscription-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      language_code: sarvamLanguage(language),
      speaker: voice,
      model,
      speech_sample_rate: 8000,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Sarvam TTS failed: ${res.status}`);
  const body = (await res.json()) as { audios?: string[] };
  if (signal.aborted) return;
  for (const audio of body.audios ?? []) {
    const mulaw = wavToMulaw(Buffer.from(audio, 'base64'));
    for (let i = 0; i < mulaw.length && !signal.aborted; i += 160) {
      onChunk(mulaw.subarray(i, i + 160).toString('base64'));
    }
  }
}
