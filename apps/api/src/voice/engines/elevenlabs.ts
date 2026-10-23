import WebSocket from 'ws';
import { logger } from '../../lib/logger';
import {
  Downsampler24kTo8k,
  Upsampler8kTo16k,
  mulawDecode,
  mulawEncode,
  pcm16FromBytes,
  pcm16ToBuffer,
} from '../audio';
import {
  DEFAULT_OPENING,
  type EngineCallbacks,
  type EngineConfig,
  type VoiceEngine,
} from './types';

/**
 * ElevenLabs Agents (conversational AI) over its WebSocket API. The agent
 * itself (voice, language model, knowledge base) lives in ElevenLabs and its
 * id is the engine's `model`. We override its prompt, first message and
 * language per call, so Purple Voice's prompt assembly, call context and
 * contact variables still drive the conversation.
 *
 * Audio: an agent set to "μ-law 8000 Hz" in ElevenLabs passes through
 * untouched, like OpenAI Realtime. Other formats are announced in the
 * `conversation_initiation_metadata` event and converted here (PCM 16/24 kHz
 * out, PCM 16 kHz in).
 *
 * Tools: ElevenLabs only calls tools configured on the agent. Client tools
 * named like ours (check_availability, book_appointment, transfer_call,
 * end_call, send_email, send_whatsapp) are executed here and answered; any
 * other tool is answered with an error.
 */

const BASE_URL = 'wss://api.elevenlabs.io/v1/convai/conversation';
const CONNECT_TIMEOUT_MS = 10_000;

type AudioFormat = 'ulaw_8000' | 'pcm_16000' | 'pcm_24000';
const SUPPORTED_OUTPUT: AudioFormat[] = ['ulaw_8000', 'pcm_16000', 'pcm_24000'];
const SUPPORTED_INPUT: AudioFormat[] = ['ulaw_8000', 'pcm_16000'];

/** 16 kHz → 8 kHz: a [1 2 1] smoothing filter, then every second sample. */
class Downsampler16kTo8k {
  private carry = -1;
  private prev = 0;
  private prev2 = 0;

  process(pcm: Uint8Array): Int16Array {
    const bytes = this.carry >= 0 ? Buffer.concat([Buffer.from([this.carry]), pcm]) : pcm;
    this.carry = bytes.length % 2 === 1 ? bytes[bytes.length - 1]! : -1;
    const samples = pcm16FromBytes(bytes.subarray(0, bytes.length - (bytes.length % 2)));
    const out: number[] = [];
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i]!;
      // Keep every second input sample, smoothed with its two predecessors.
      if (i % 2 === 1) out.push((this.prev2 + 2 * this.prev + s) >> 2);
      this.prev2 = this.prev;
      this.prev = s;
    }
    return Int16Array.from(out);
  }
}

export class ElevenLabsEngine implements VoiceEngine {
  private ws?: WebSocket;
  private closed = false;
  private outputFormat: AudioFormat = 'ulaw_8000';
  private inputFormat: AudioFormat = 'ulaw_8000';
  private up?: Upsampler8kTo16k;
  private down24?: Downsampler24kTo8k;
  private down16?: Downsampler16kTo8k;
  /** Ignore audio of a turn the caller has cut off, until the agent's next turn begins. */
  private dropAudioUntilEventId = 0;
  private ready = false;

  constructor(
    private readonly config: EngineConfig,
    private readonly cb: EngineCallbacks,
    /** Overridable for tests. */
    private readonly baseUrl = BASE_URL,
  ) {}

  async start(): Promise<void> {
    if (!this.config.model) throw new Error('No ElevenLabs agent id is set for this workspace');
    const ws = new WebSocket(`${this.baseUrl}?agent_id=${encodeURIComponent(this.config.model)}`, {
      headers: { 'xi-api-key': this.config.apiKey },
    });
    this.ws = ws;

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('ElevenLabs connection timed out')),
        CONNECT_TIMEOUT_MS,
      );
      const fail = (err: Error) => {
        clearTimeout(timer);
        reject(err);
      };
      const onClose = (code: number, reason: Buffer) =>
        fail(new Error(`ElevenLabs closed the connection (${code} ${reason.toString()})`));
      ws.once('error', fail);
      ws.once('close', onClose);
      ws.on('message', (raw) => {
        try {
          if (this.onMessage(raw.toString())) {
            clearTimeout(timer);
            ws.off('error', fail);
            ws.off('close', onClose);
            resolve();
          }
        } catch (err) {
          fail(err as Error);
        }
      });
      ws.once('open', () => this.sendInit());
    });

    ws.on('error', (err) => this.cb.onError(err));
    ws.on('close', () => {
      const wasOpen = !this.closed;
      this.closed = true;
      if (wasOpen) this.cb.onFatal?.(new Error('ElevenLabs connection closed'));
    });
  }

  pushAudio(payloadB64: string) {
    if (!this.ready) return;
    let audio = payloadB64;
    if (this.inputFormat === 'pcm_16000') {
      this.up ??= new Upsampler8kTo16k();
      const pcm = this.up.process(mulawDecode(Buffer.from(payloadB64, 'base64')));
      audio = pcm16ToBuffer(pcm).toString('base64');
    }
    this.send({ user_audio_chunk: audio });
  }

  close() {
    this.closed = true;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.close();
  }

  private sendInit() {
    const { greeting, opening, instructions, language } = this.config;
    // With no fixed greeting the agent's own first message in ElevenLabs applies;
    // the opening guidance still reaches it through the prompt.
    const prompt = greeting ? instructions : `${instructions}\n\n${opening ?? DEFAULT_OPENING}`;
    this.send({
      type: 'conversation_initiation_client_data',
      conversation_config_override: {
        agent: {
          prompt: { prompt },
          ...(greeting ? { first_message: greeting } : {}),
          language: language.slice(0, 2).toLowerCase(),
        },
      },
    });
  }

  private send(event: Record<string, unknown>) {
    if (!this.closed && this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(event));
  }

  /** Handles one server event. Returns true on the one that completes the handshake. */
  private onMessage(raw: string): boolean {
    let event: Record<string, any>;
    try {
      event = JSON.parse(raw);
    } catch {
      return false;
    }

    switch (event.type) {
      case 'conversation_initiation_metadata': {
        const meta = event.conversation_initiation_metadata_event ?? {};
        const out = meta.agent_output_audio_format ?? 'ulaw_8000';
        const inp = meta.user_input_audio_format ?? 'ulaw_8000';
        if (!SUPPORTED_OUTPUT.includes(out) || !SUPPORTED_INPUT.includes(inp)) {
          this.close();
          throw new Error(
            `ElevenLabs agent audio is ${inp} in / ${out} out. Set it to μ-law 8000 Hz in the agent's settings.`,
          );
        }
        this.outputFormat = out;
        this.inputFormat = inp;
        this.ready = true;
        return true;
      }
      case 'audio': {
        const b64: string | undefined = event.audio_event?.audio_base_64;
        const id = Number(event.audio_event?.event_id ?? 0);
        if (!b64 || id <= this.dropAudioUntilEventId) return false;
        const out = this.toMulaw(b64);
        if (out) this.cb.onAudio(out);
        return false;
      }
      case 'interruption': {
        this.dropAudioUntilEventId = Math.max(
          this.dropAudioUntilEventId,
          Number(event.interruption_event?.event_id ?? 0),
        );
        this.down24?.reset();
        this.cb.onInterrupt();
        return false;
      }
      case 'user_transcript': {
        const text = event.user_transcription_event?.user_transcript?.trim();
        if (text) this.cb.onTranscript('caller', text);
        return false;
      }
      case 'agent_response': {
        const text = event.agent_response_event?.agent_response?.trim();
        if (text) this.cb.onTranscript('agent', text);
        return false;
      }
      case 'ping': {
        this.send({ type: 'pong', event_id: event.ping_event?.event_id });
        return false;
      }
      case 'client_tool_call': {
        void this.handleToolCall(event.client_tool_call ?? {});
        return false;
      }
      case 'error':
      case 'internal_error': {
        logger.warn({ event }, 'ElevenLabs error event');
        return false;
      }
    }
    return false;
  }

  private toMulaw(b64: string): string | null {
    if (this.outputFormat === 'ulaw_8000') return b64;
    const bytes = Buffer.from(b64, 'base64');
    let pcm: Int16Array;
    if (this.outputFormat === 'pcm_24000') {
      this.down24 ??= new Downsampler24kTo8k();
      pcm = this.down24.process(bytes);
    } else {
      this.down16 ??= new Downsampler16kTo8k();
      pcm = this.down16.process(bytes);
    }
    return pcm.length ? mulawEncode(pcm).toString('base64') : null;
  }

  private async handleToolCall(call: {
    tool_name?: string;
    tool_call_id?: string;
    parameters?: unknown;
  }) {
    if (!call.tool_call_id || !call.tool_name) return;
    let result: string;
    let isError = false;
    try {
      result = await this.cb.onToolCall(call.tool_name, call.parameters ?? {});
      isError = result.startsWith('Error:');
    } catch (err) {
      result = `Error: ${(err as Error).message}`;
      isError = true;
    }
    this.send({
      type: 'client_tool_result',
      tool_call_id: call.tool_call_id,
      result,
      is_error: isError,
    });
  }
}
