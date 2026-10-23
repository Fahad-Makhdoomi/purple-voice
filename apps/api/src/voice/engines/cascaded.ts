import type { AiProvider, NoiseFilter } from '@prisma/client';
import { isoLanguage } from '@pv/shared';
import { logger } from '../../lib/logger';
import { ClaudeConversation } from '../llm/claude';
import { OpenAIConversation } from '../llm/openai';
import { GeminiConversation } from '../llm/gemini';
import type { LlmConversation } from '../llm/types';
import { mulawDurationMs } from '../transports';
import { SpeechFilter } from '../speakable';
import { DeepgramStt, deepgramSpeak } from './deepgram';
import { ElevenLabsStt, elevenLabsSpeak } from './elevenlabs-speech';
import { SarvamStt, sarvamSpeak } from './sarvam-speech';
import {
  DEFAULT_OPENING,
  type EngineCallbacks,
  type EngineConfig,
  type VoiceEngine,
} from './types';

/** Words the caller must say over the agent before it stops talking. */
const INTERRUPT_WORDS: Record<NoiseFilter, number> = { OFF: 1, STANDARD: 2, STRONG: 3 };
/** How long after the agent stops that its echo can still reach the recogniser. */
const ECHO_TAIL_MS = 1500;
/** How far back the agent's own words are remembered for echo checks. */
const ECHO_MEMORY_MS = 20_000;
/** Share of a heard phrase that must be the agent's own recent words to count as echo. */
const ECHO_OVERLAP = 0.6;

export function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{M}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Speech-to-text → any LLM → text-to-speech, with Deepgram, ElevenLabs or Sarvam
 * (`speech`) doing the hearing and speaking.
 *
 * The caller's words stream to the speech vendor; when it marks the end of
 * their utterance, the text goes to the LLM. The reply streams back and is
 * cut at sentence boundaries, each sentence synthesised and played in
 * order, so the agent starts talking after the first sentence rather than
 * the whole answer. If the caller speaks over the agent, playback is
 * cleared and the in-flight LLM turn is aborted.
 */
export class CascadedEngine implements VoiceEngine {
  private stt: DeepgramStt | ElevenLabsStt | SarvamStt;
  private llm: LlmConversation;
  private pendingUserText = '';
  private turnAbort: AbortController | null = null;
  private synthesizing = false;
  /** When the audio already sent to the carrier finishes playing. */
  private playbackEndsAt = 0;
  private spokenThisTurn = '';
  private speechQueue: Promise<void> = Promise.resolve();
  private closed = false;
  /** Sentences the agent spoke recently, to recognise them when the line echoes them back. */
  private recentSpeech: { words: Set<string>; at: number }[] = [];
  /** Keeps markdown, labels and read-back instructions out of the voice. */
  private readonly filter: SpeechFilter;

  constructor(
    private readonly config: EngineConfig & {
      provider: AiProvider;
      speechApiKey: string;
      /** Who hears and speaks; Deepgram unless set. */
      speech?: 'DEEPGRAM' | 'ELEVENLABS' | 'SARVAM';
    },
    private readonly cb: EngineCallbacks,
  ) {
    const Stt =
      config.speech === 'ELEVENLABS'
        ? ElevenLabsStt
        : config.speech === 'SARVAM'
          ? SarvamStt
          : DeepgramStt;
    this.stt = new Stt(config.speechApiKey, config.language, {
      onTranscript: (text, final) => {
        // The phone line can carry the agent's own voice back to the
        // recogniser. Heard that way it is not the caller: answering it is
        // how an agent ends up talking to itself.
        if (this.isEcho(text)) return;
        if (final) this.pendingUserText = `${this.pendingUserText} ${text}`.trim();
        // Only real words over the agent's voice interrupt it: a cough or a
        // stray background word doesn't. Noisier settings need more words.
        const count = text.trim().split(/\s+/).filter(Boolean).length;
        if (this.isSpeaking() && count >= INTERRUPT_WORDS[config.noiseFilter ?? 'STANDARD'])
          this.interrupt();
      },
      onUtteranceEnd: () => this.onUtteranceEnd(),
      onSpeechStarted: () => undefined,
      onError: (err) => this.cb.onError(err),
    });

    this.filter = new SpeechFilter(config.instructions);
    // A text model opens the call from a system cue plus the person's "Hello?",
    // never from instructions sent as the caller's words (which it may read back).
    const instructions = config.greeting
      ? config.instructions
      : `${config.instructions}\n\n## Starting the call\n${config.opening ?? DEFAULT_OPENING} Your first reply is exactly the words you say out loud when the line connects, nothing else.`;
    const args = [config.apiKey, config.model, instructions, config.tools] as const;
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
      void this.respond('Hello?');
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

  /** Mostly the agent's own recent words, heard while (or just after) it spoke. */
  private isEcho(text: string): boolean {
    const now = Date.now();
    if (!this.isSpeaking() && now > this.playbackEndsAt + ECHO_TAIL_MS) return false;
    this.recentSpeech = this.recentSpeech.filter((s) => now - s.at < ECHO_MEMORY_MS);
    const heard = words(text);
    if (!heard.length) return true;
    const own = (w: string) => this.recentSpeech.some((s) => s.words.has(w));
    return heard.filter(own).length / heard.length >= ECHO_OVERLAP;
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
    // The caller finished a turn over the agent: stop the agent properly
    // (carrier queue cleared) before answering, so two replies never overlap.
    if (this.isSpeaking()) this.interrupt();
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
      // Speak whole sentences (or lines) as soon as they're complete.
      const match = force ? buffer : buffer.match(/^[\s\S]*?(?:[.!?…।](\s|$)|\n)/)?.[0];
      if (!match || !match.trim()) {
        if (force) buffer = '';
        return;
      }
      buffer = buffer.slice(match.length);
      const spoken = this.filter.clean(match);
      if (spoken) {
        full += `${spoken} `;
        this.say(spoken, abort.signal);
      }
      if (!force) flush(false);
    };

    try {
      await this.llm.turn(userText, {
        signal: abort.signal,
        onText: (delta) => {
          buffer += delta;
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
      if (!abort.signal.aborted && full.trim()) {
        this.cb.onTranscript('agent', full.trim());
        // Logged in full: a later interruption mustn't log this turn a second time.
        this.spokenThisTurn = '';
      }
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
      this.recentSpeech.push({ words: new Set(words(text)), at: Date.now() });
      try {
        const onChunk = (chunk: string) => {
          this.playbackEndsAt = Math.max(Date.now(), this.playbackEndsAt) + mulawDurationMs(chunk);
          this.cb.onAudio(chunk);
        };
        if (this.config.speech === 'ELEVENLABS') {
          await elevenLabsSpeak(
            this.config.speechApiKey,
            this.config.voice,
            text,
            onChunk,
            signal,
            isoLanguage(this.config.language),
          );
        } else if (this.config.speech === 'SARVAM') {
          await sarvamSpeak(
            this.config.speechApiKey,
            this.config.voice,
            text,
            onChunk,
            signal,
            this.config.language,
          );
        } else {
          await deepgramSpeak(this.config.speechApiKey, this.config.voice, text, onChunk, signal);
        }
        if (!signal.aborted) this.spokenThisTurn += ` ${text}`;
      } catch (err) {
        if (!signal.aborted) logger.warn({ err }, 'Text-to-speech failed');
      } finally {
        this.synthesizing = false;
      }
    });
  }
}
