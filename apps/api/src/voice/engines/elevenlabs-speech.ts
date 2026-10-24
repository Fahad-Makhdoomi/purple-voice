import WebSocket from 'ws';
import { isoLanguage } from '@pv/shared';
import type { SttEvents } from './deepgram';

/**
 * ElevenLabs realtime speech-to-text (Scribe v2 Realtime) and streaming
 * text-to-speech, both in 8 kHz μ-law so carrier audio needs no conversion.
 * Drop-in for the Deepgram pair in the cascaded engine.
 */

const STT_URL = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';
const TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
/** Default: the low-latency multilingual model (32 languages). Staff can pick another. */
const TTS_MODEL = 'eleven_flash_v2_5';

export class ElevenLabsStt {
  private ws?: WebSocket;

  constructor(
    private readonly apiKey: string,
    private readonly language: string,
    private readonly events: SttEvents,
    /** Overridable for tests. */
    private readonly url = STT_URL,
  ) {}

  async connect(): Promise<void> {
    const params = new URLSearchParams({
      model_id: 'scribe_v2_realtime',
      audio_format: 'ulaw_8000',
      language_code: isoLanguage(this.language),
      // ElevenLabs ends the caller's turn after this much silence.
      commit_strategy: 'vad',
      vad_silence_threshold_secs: '0.6',
    });
    const ws = new WebSocket(`${this.url}?${params}`, { headers: { 'xi-api-key': this.apiKey } });
    this.ws = ws;
    ws.on('message', (raw) => {
      let msg: Record<string, any>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      switch (msg.message_type) {
        case 'partial_transcript':
          if (msg.text?.trim()) this.events.onTranscript(msg.text, false);
          break;
        case 'committed_transcript':
          if (msg.text?.trim()) {
            this.events.onTranscript(msg.text, true);
            this.events.onUtteranceEnd();
          }
          break;
        default:
          // Errors arrive as their own message types (auth_error, quota_exceeded, …).
          if (typeof msg.message_type === 'string' && msg.error) {
            this.events.onError(new Error(`ElevenLabs STT ${msg.message_type}: ${msg.error}`));
          }
      }
    });
    ws.on('error', (err) => this.events.onError(err));
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('ElevenLabs STT timed out')), 10_000);
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
    this.ws.send(
      JSON.stringify({
        message_type: 'input_audio_chunk',
        audio_base_64: payloadB64,
        commit: false,
        sample_rate: 8000,
      }),
    );
  }

  close() {
    this.ws?.close();
  }
}

/**
 * Speaks `text` in `voice` (an ElevenLabs voice id) and streams μ-law audio
 * as it is produced. Resolves when the audio is fully received or aborted.
 */
export async function elevenLabsSpeak(
  apiKey: string,
  voice: string,
  text: string,
  onChunk: (payloadB64: string) => void,
  signal: AbortSignal,
  language = 'en',
  model = TTS_MODEL,
  baseUrl = TTS_URL,
): Promise<void> {
  const res = await fetch(
    `${baseUrl}/${encodeURIComponent(voice)}/stream?output_format=ulaw_8000`,
    {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: model, language_code: language }),
      signal,
    },
  );
  if (!res.ok || !res.body) throw new Error(`ElevenLabs TTS failed: ${res.status}`);

  // 20 ms frames (160 bytes) keep playback and barge-in responsive.
  let pending = Buffer.alloc(0);
  const reader = res.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done || signal.aborted) break;
    pending = Buffer.concat([pending, Buffer.from(value)]);
    const whole = pending.length - (pending.length % 160);
    if (whole > 0) {
      onChunk(pending.subarray(0, whole).toString('base64'));
      pending = pending.subarray(whole);
    }
  }
  if (pending.length && !signal.aborted) onChunk(pending.toString('base64'));
}
