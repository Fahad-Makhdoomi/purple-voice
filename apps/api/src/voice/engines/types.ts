import type { NoiseFilter } from '@prisma/client';
import type { ToolDefinition, ToolExecutor } from '../tools';

export interface EngineCallbacks {
  /** μ-law 8 kHz audio for the caller, base64. */
  onAudio(payloadB64: string): void;
  /** The caller started talking over the agent: drop queued audio. */
  onInterrupt(): void;
  onTranscript(role: 'agent' | 'caller', text: string): void;
  onToolCall: ToolExecutor;
  onError(err: unknown): void;
  /** The engine lost its model connection for good; the call cannot go on. */
  onFatal?(err: unknown): void;
}

export interface EngineConfig {
  apiKey: string;
  model: string;
  voice: string;
  language: string;
  instructions: string;
  greeting: string;
  /** What to do first when there is no fixed greeting (differs for incoming calls). */
  opening?: string;
  /**
   * How hard to resist background noise. Maps to each engine's own voice
   * detection: stricter speech-start detection and longer required speech
   * before the caller counts as interrupting.
   */
  noiseFilter?: NoiseFilter;
  tools: ToolDefinition[];
}

export const DEFAULT_OPENING =
  'Open the call: greet the person briefly and say why you are calling.';

/** Turns caller audio into agent audio. One instance per call. */
export interface VoiceEngine {
  start(): Promise<void>;
  /** Caller audio, μ-law 8 kHz base64. */
  pushAudio(payloadB64: string): void;
  close(): void;
}
