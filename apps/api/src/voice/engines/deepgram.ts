import WebSocket from 'ws';

/**
 * Deepgram streaming speech-to-text and text-to-speech, both in 8 kHz
 * μ-law so carrier audio needs no conversion in either direction.
 */

export interface SttEvents {
  /** Interim or final text; `final` segments are stable. */
  onTranscript(text: string, final: boolean): void;
  /** The caller has finished their turn. */
  onUtteranceEnd(): void;
  onSpeechStarted(): void;
  onError(err: unknown): void;
}

export class DeepgramStt {
  private ws?: WebSocket;
  private keepAlive?: NodeJS.Timeout;

  constructor(
    private readonly apiKey: string,
    private readonly language: string,
    private readonly events: SttEvents,
  ) {}

  async connect(): Promise<void> {
    const params = new URLSearchParams({
      model: 'nova-3',
      encoding: 'mulaw',
      sample_rate: '8000',
      channels: '1',
      language: this.language.startsWith('en') ? this.language : this.language.slice(0, 2),
      punctuate: 'true',
      smart_format: 'true',
      interim_results: 'true',
      endpointing: '300',
      utterance_end_ms: '1000',
      vad_events: 'true',
    });
    const ws = new WebSocket(`wss://api.deepgram.com/v1/listen?${params}`, {
      headers: { Authorization: `Token ${this.apiKey}` },
    });
    this.ws = ws;
    await new Promise<void>((resolve, reject) => {
      ws.once('open', () => resolve());
      ws.once('error', reject);
    });

    ws.on('message', (raw) => {
      let msg: Record<string, any>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      if (msg.type === 'Results') {
        const text: string = msg.channel?.alternatives?.[0]?.transcript ?? '';
        if (text) this.events.onTranscript(text, !!msg.is_final);
        if (msg.speech_final) this.events.onUtteranceEnd();
      } else if (msg.type === 'UtteranceEnd') {
        this.events.onUtteranceEnd();
      } else if (msg.type === 'SpeechStarted') {
        this.events.onSpeechStarted();
      }
    });
    ws.on('error', (err) => this.events.onError(err));
    // Deepgram closes idle streams after ~10 s without audio or a keep-alive.
    this.keepAlive = setInterval(() => this.sendJson({ type: 'KeepAlive' }), 8000);
  }

  push(payloadB64: string) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(Buffer.from(payloadB64, 'base64'));
  }

  private sendJson(msg: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close() {
    clearInterval(this.keepAlive);
    this.sendJson({ type: 'CloseStream' });
    setTimeout(() => this.ws?.close(), 500);
  }
}

/**
 * Speaks `text` and streams μ-law audio chunks as Deepgram produces them.
 * Resolves when the audio is fully received or the signal aborts.
 */
export async function deepgramSpeak(
  apiKey: string,
  voice: string,
  text: string,
  onChunk: (payloadB64: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voice)}&encoding=mulaw&sample_rate=8000&container=none`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Deepgram TTS failed: ${res.status}`);

  // Send in 20 ms frames (160 bytes) so playback and barge-in stay responsive.
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
