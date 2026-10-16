import type { AiProvider, NoiseFilter } from '@prisma/client';
import { logger } from '../../lib/logger';
import { ClaudeConversation } from '../llm/claude';
import { OpenAIConversation } from '../llm/openai';
import { GeminiConversation } from '../llm/gemini';
import type { LlmConversation } from '../llm/types';
import { mulawDurationMs } from '../transports';
import { DeepgramStt, deepgramSpeak } from './deepgram';
import type { EngineCallbacks, EngineConfig, VoiceEngine } from './types';

/** Words the caller must say over the agent before it stops talking. */
const INTERRUPT_WORDS: Record<NoiseFilter, number> = { OFF: 1, STANDARD: 2, STRONG: 3 };

/**
 * Speech-to-text → any LLM → text-to-speech.
 *
 * The caller's words stream to Deepgram; when Deepgram marks the end of
 * their utterance, the text goes to the LLM. The reply streams back and is
 * cut at sentence boundaries, each sentence synthesised and played in
 * order, so the agent starts talking after the first sentence rather than
 * the whole answer. If the caller speaks over the agent, playback is
 * cleared and the in-flight LLM turn is aborted.
 */
export class CascadedEngine implements VoiceEngine {
  private stt: DeepgramStt;
  private llm: LlmConversation;
  private pendingUserText = '';
  private turnAbort: AbortController | null = null;
  private synthesizing = false;
  /** When the audio already sent to the carrier finishes playing. */
  private playbackEndsAt = 0;
  private spokenThisTurn = '';
  private speechQueue: Promise<void> = Promise.resolve();
  private closed = false;

  constructor(
    private readonly config: EngineConfig & { provider: AiProvider; speechApiKey: string },
    private readonly cb: EngineCallbacks,
  ) {
    this.stt = new DeepgramStt(config.speechApiKey, config.language, {
      onTranscript: (text, final) => {
        if (final) this.pendingUserText = `${this.pendingUserText} ${text}`.trim();
        // Only real words over the agent's voice interrupt it: a cough or a
        // stray background word doesn't. Noisier settings need more words.
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        if (this.isSpeaking() && words >= INTERRUPT_WORDS[config.noiseFilter ?? 'STANDARD'])
          this.interrupt();
      },
      onUtteranceEnd: () => this.onUtteranceEnd(),
      onSpeechStarted: () => undefined,
      onError: (err) => this.cb.onError(err),
    });

    const args = [config.apiKey, config.model, config.instructions, config.tools] as const;
    this.llm =
      config.provider === 'ANTHROPIC'
        ? new ClaudeConversation(...args)
        : config.provider === 'GEMINI'
          ? new GeminiConversation(...args)
          : new OpenAIConversation(...args);
  }

  async start(): Promise<void> {
    await this.stt.connect();
    if (this.config.greeting) {
      this.cb.onTranscript('agent', this.config.greeting);
      this.say(this.config.greeting, new AbortController().signal);
    } else if (this.config.opening) {
      // No fixed line: let the model open (an incoming caller shouldn't hear silence).
      void this.respond(`(The call has just connected. ${this.config.opening})`);
    }
  }

  pushAudio(payloadB64: string) {
    this.stt.push(payloadB64);
  }

  close() {
    this.closed = true;
    this.turnAbort?.abort();
    this.stt.close();
  }

  private isSpeaking() {
    return this.synthesizing || Date.now() < this.playbackEndsAt;
  }

  private interrupt() {
    this.turnAbort?.abort();
    this.turnAbort = null;
    this.playbackEndsAt = 0;
    this.cb.onInterrupt();
    this.llm.noteInterrupted(this.spokenThisTurn);
    if (this.spokenThisTurn.trim())
      this.cb.onTranscript('agent', `${this.spokenThisTurn.trim()} —`);
    this.spokenThisTurn = '';
  }

  private onUtteranceEnd() {
    const text = this.pendingUserText.trim();
    this.pendingUserText = '';
    if (!text || this.closed) return;
    this.cb.onTranscript('caller', text);
    void this.respond(text);
  }

  private async respond(userText: string) {
    this.turnAbort?.abort();
    const abort = new AbortController();
    this.turnAbort = abort;
    this.spokenThisTurn = '';
    let buffer = '';
    let full = '';

    const flush = (force: boolean) => {
      // Speak whole sentences as soon as they're complete.
      const match = force ? buffer : buffer.match(/^[\s\S]*?[.!?…](\s|$)/)?.[0];
      if (!match || !match.trim()) return;
      buffer = buffer.slice(match.length);
      this.say(match.trim(), abort.signal);
      if (!force) flush(false);
    };

    try {
      await this.llm.turn(userText, {
        signal: abort.signal,
        onText: (delta) => {
          buffer += delta;
          full += delta;
          flush(false);
        },
        onToolCall: async (name, input) => {
          flush(true);
          // Let the caller hear "one moment" style lead-ins before the tool runs.
          await this.speechQueue;
          return this.cb.onToolCall(name, input);
        },
      });
      flush(true);
      await this.speechQueue;
      if (!abort.signal.aborted && full.trim()) this.cb.onTranscript('agent', full.trim());
    } catch (err) {
      if (!abort.signal.aborted) {
        logger.warn({ err }, 'LLM turn failed');
        this.cb.onError(err);
        this.say("Sorry, I didn't catch that. Could you say it again?", abort.signal);
      }
    } finally {
      if (this.turnAbort === abort) this.turnAbort = null;
    }
  }

  /** Queues a sentence for synthesis; sentences play strictly in order. */
  private say(text: string, signal: AbortSignal) {
    this.speechQueue = this.speechQueue.then(async () => {
      if (signal.aborted || this.closed) return;
      this.synthesizing = true;
      try {
        await deepgramSpeak(
          this.config.speechApiKey,
          this.config.voice,
          text,
          (chunk) => {
            this.playbackEndsAt =
              Math.max(Date.now(), this.playbackEndsAt) + mulawDurationMs(chunk);
            this.cb.onAudio(chunk);
          },
          signal,
        );
        if (!signal.aborted) this.spokenThisTurn += ` ${text}`;
      } catch (err) {
        if (!signal.aborted) logger.warn({ err }, 'Text-to-speech failed');
      } finally {
        this.synthesizing = false;
      }
    });
  }
}
