import WebSocket from 'ws';
import { logger } from '../../lib/logger';
import { mulawDurationMs } from '../transports';
import type { EngineCallbacks, EngineConfig, VoiceEngine } from './types';

/**
 * OpenAI Realtime, speech-to-speech. Carrier μ-law goes straight in and
 * comes straight out (audio/pcmu both ways), so the server does no audio
 * processing at all — the main reason a 2-core VPS can carry many calls.
 *
 * Barge-in: when server VAD hears the caller, we clear the carrier's queue
 * and truncate the assistant item to what was actually played, so the
 * model's memory matches what the caller heard.
 */
export class OpenAIRealtimeEngine implements VoiceEngine {
  private ws?: WebSocket;
  private closed = false;
  private currentItemId: string | null = null;
  private responseStartedAt = 0;
  private responseAudioMs = 0;
  private handledCalls = new Set<string>();

  constructor(
    private readonly config: EngineConfig,
    private readonly cb: EngineCallbacks,
  ) {}

  async start(): Promise<void> {
    const ws = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(this.config.model)}`,
      {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      },
    );
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Realtime connection timed out')), 10_000);
      ws.once('open', () => {
        clearTimeout(timer);
        resolve();
      });
      ws.once('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    ws.on('message', (raw) => this.onMessage(raw.toString()));
    ws.on('error', (err) => this.cb.onError(err));
    ws.on('close', () => {
      this.closed = true;
    });

    this.send({
      type: 'session.update',
      session: {
        type: 'realtime',
        model: this.config.model,
        output_modalities: ['audio'],
        instructions: this.config.instructions,
        audio: {
          input: {
            format: { type: 'audio/pcmu' },
            turn_detection: {
              type: 'server_vad',
              silence_duration_ms: 500,
              prefix_padding_ms: 300,
            },
            transcription: {
              model: 'gpt-4o-mini-transcribe',
              language: this.config.language.slice(0, 2),
            },
          },
          output: { format: { type: 'audio/pcmu' }, voice: this.config.voice },
        },
        tools: this.config.tools.map((t) => ({
          type: 'function',
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        })),
        tool_choice: 'auto',
      },
    });

    // Speak first: the exact greeting if one is set, otherwise open naturally.
    this.send({
      type: 'response.create',
      response: {
        instructions: this.config.greeting
          ? `Say exactly this, then wait for the reply: "${this.config.greeting}"`
          : 'Open the call: greet the person briefly and say why you are calling.',
      },
    });
  }

  pushAudio(payloadB64: string) {
    this.send({ type: 'input_audio_buffer.append', audio: payloadB64 });
  }

  close() {
    this.closed = true;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close();
  }

  private send(event: Record<string, unknown>) {
    if (!this.closed && this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(event));
  }

  private onMessage(raw: string) {
    let event: Record<string, any>;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }

    switch (event.type) {
      // GA and preview event names are both handled.
      case 'response.output_audio.delta':
      case 'response.audio.delta': {
        if (this.currentItemId !== event.item_id) {
          this.currentItemId = event.item_id;
          this.responseStartedAt = Date.now();
          this.responseAudioMs = 0;
        }
        this.responseAudioMs += mulawDurationMs(event.delta);
        this.cb.onAudio(event.delta);
        break;
      }
      case 'input_audio_buffer.speech_started': {
        if (this.currentItemId) {
          const played = Math.min(Date.now() - this.responseStartedAt, this.responseAudioMs);
          this.cb.onInterrupt();
          this.send({
            type: 'conversation.item.truncate',
            item_id: this.currentItemId,
            content_index: 0,
            audio_end_ms: Math.max(0, played),
          });
          this.currentItemId = null;
        }
        break;
      }
      case 'conversation.item.input_audio_transcription.completed':
        if (event.transcript?.trim()) this.cb.onTranscript('caller', event.transcript.trim());
        break;
      case 'response.output_audio_transcript.done':
      case 'response.audio_transcript.done':
        if (event.transcript?.trim()) this.cb.onTranscript('agent', event.transcript.trim());
        break;
      case 'response.done':
        void this.handleToolCalls(event.response?.output ?? []);
        break;
      case 'error':
        logger.warn({ error: event.error }, 'Realtime API error event');
        break;
    }
  }

  private async handleToolCalls(output: Array<Record<string, any>>) {
    const calls = output.filter(
      (item) => item.type === 'function_call' && !this.handledCalls.has(item.call_id),
    );
    if (!calls.length) return;
    let continueConversation = false;
    for (const item of calls) {
      this.handledCalls.add(item.call_id);
      let args: unknown = {};
      try {
        args = JSON.parse(item.arguments || '{}');
      } catch {
        args = { __invalid: item.arguments };
      }
      const result = await this.cb
        .onToolCall(item.name, args)
        .catch((err: Error) => `Error: ${err.message}`);
      this.send({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: item.call_id, output: result },
      });
      // After hanging up or transferring there is nobody left to talk to.
      if (item.name !== 'end_call' && item.name !== 'transfer_call') continueConversation = true;
    }
    if (continueConversation) this.send({ type: 'response.create' });
  }
}
