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
/** No reply text this long after the caller finished: say a short filler so the line isn't dead. */
const FILLER_AFTER_MS = 2200;
/** Silence on both sides this long: check the caller is still there (at most twice in a row). */
const NUDGE_AFTER_MS = 8000;
const MAX_NUDGES = 2;

const FILLERS: Record<'hi' | 'en', string[]> = {
  hi: ['Hmm, ek second.', 'Achha, ek pal.', 'Ji, dekhti hoon.'],
  en: ['Hmm, one moment.', 'Okay, let me check.', 'Sure, one second.'],
};
const NUDGES: Record<'hi' | 'en', string> = {
  hi: 'Hello, kya aap mujhe sun pa rahe hain?',
  en: 'Hello, can you hear me?',
};

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
  /** The last time anyone spoke (the caller started, or the agent's audio ended). */
  private lastActivity = Date.now();
  private nudges = 0;
  private fillerIndex = 0;
  private idleTimer?: NodeJS.Timeout;

  constructor(
    private readonly config: EngineConfig & {
      provider: AiProvider;
      speechApiKey: string;
      /** Who hears and speaks; Deepgram unless set. */
      speech?: 'DEEPGRAM' | 'ELEVENLABS' | 'SARVAM';
      /** Text-to-speech model (ElevenLabs, Sarvam); the vendor default when unset. */
      speechModel?: string;
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
        this.heard();
        if (final) this.pendingUserText = `${this.pendingUserText} ${text}`.trim();
        // Only real words over the agent's voice interrupt it: a cough or a
        // stray background word doesn't. Noisier settings need more words.
        const count = text.trim().split(/\s+/).filter(Boolean).length;
        if (this.isSpeaking() && count >= INTERRUPT_WORDS[config.noiseFilter ?? 'STANDARD'])
          this.interrupt();
      },
      onUtteranceEnd: () => this.onUtteranceEnd(),
      onSpeechStarted: () => this.heard(),
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
          : new OpenAIConversation(...args, config.provider === 'SARVAM' ? 'SARVAM' : 'OPENAI');
  }

  async start(): Promise<void> {
    await this.stt.connect();
    this.idleTimer = setInterval(() => this.checkIdle(), 1000);
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
    clearInterval(this.idleTimer);
    this.turnAbort?.abort();
    this.stt.close();
  }

  private isSpeaking() {
    return this.synthesizing || Date.now() < this.playbackEndsAt;
  }

  private get lang(): 'hi' | 'en' {
    return isoLanguage(this.config.language) === 'hi' ? 'hi' : 'en';
  }

  /** The caller made a sound worth counting: they are there. */
  private heard() {
    this.lastActivity = Date.now();
    this.nudges = 0;
  }

  /**
   * A call where nobody speaks for a while is stuck: the caller didn't hear
   * the question, or their answer got lost. Ask if they can hear, twice at most.
   */
  private checkIdle() {
    if (this.closed || this.turnAbort || this.isSpeaking() || this.nudges >= MAX_NUDGES) return;
    const quietSince = Math.max(this.lastActivity, this.playbackEndsAt);
    if (Date.now() - quietSince < NUDGE_AFTER_MS) return;
    this.nudges++;
    this.lastActivity = Date.now();
    const line = NUDGES[this.lang];
    this.cb.onTranscript('agent', line);
    this.llm.noteInterrupted(line.replace(/[?]$/, ''));
    this.say(line, new AbortController().signal);
  }

  /** Mostly the agent's own recent words, heard while (or just after) it spoke. */
  private isEcho(text: string): boolean {
    const now = Date.now();
    if (!this.isSpeaking() && now > this.playbackEndsAt + ECHO_TAIL_MS) return false;
    this.recentSpeech = this.recentSpeech.filter((s) => now - s.at < ECHO_MEMORY_MS);
    const heard = words(text);
    if (!heard.length) return true;
    const own = (w: string) => this.recentSpeech.some((s) => s.words.has(w));
    // A short answer ("yes", "haan ji", "okay") right after the agent asked
    // something is the caller replying, even when the agent used that word:
    // treating it as echo leaves the agent waiting in silence.
    // Only well before the agent finishes is a short phrase of its own words echo.
    if (heard.length < 3) return this.playbackEndsAt - now > 1000 && heard.every(own);
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
    const startedAt = Date.now();
    let firstTextAt = 0;
    // A slow model shouldn't leave the caller in silence: a short filler first.
    const filler =
      userText === 'Hello?'
        ? undefined
        : setTimeout(() => {
            if (abort.signal.aborted || full || this.isSpeaking()) return;
            const options = FILLERS[this.lang];
            this.say(options[this.fillerIndex++ % options.length]!, abort.signal);
          }, FILLER_AFTER_MS);

    const flush = (force: boolean) => {
      // Speak whole sentences (or lines) as soon as they're complete.
      // The first words of a reply go out at the first comma once there are a
      // few of them, so the caller hears the agent sooner.
      const match = force
        ? buffer
        : (buffer.match(/^[\s\S]*?(?:[.!?…।](\s|$)|\n)/)?.[0] ??
          (!full ? buffer.match(/^(?:\S+\s+){3,}?\S+[,;:،](\s)/)?.[0] : undefined));
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
          if (!firstTextAt) firstTextAt = Date.now();
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
      clearTimeout(filler);
      await this.speechQueue;
      logger.info(
        {
          provider: this.config.provider,
          speech: this.config.speech ?? 'DEEPGRAM',
          firstTextMs: firstTextAt ? firstTextAt - startedAt : null,
          turnMs: Date.now() - startedAt,
        },
        'Cascaded turn timing',
      );
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
      clearTimeout(filler);
      if (this.turnAbort === abort) this.turnAbort = null;
    }
  }

  /**
   * Queues a sentence. Synthesis starts at once, so while one sentence plays
   * the next is already being made; playback stays strictly in order.
   */
  private say(text: string, signal: AbortSignal) {
    const chunks: string[] = [];
    let done = false;
    let failed: unknown;
    let wake: (() => void) | null = null;
    void this.synthesize(
      text,
      (chunk) => {
        chunks.push(chunk);
        wake?.();
      },
      signal,
    )
      .catch((err) => {
        failed = err;
      })
      .finally(() => {
        done = true;
        wake?.();
      });

    this.speechQueue = this.speechQueue.then(async () => {
      if (signal.aborted || this.closed) return;
      this.synthesizing = true;
      this.recentSpeech.push({ words: new Set(words(text)), at: Date.now() });
      try {
        while (!signal.aborted) {
          while (chunks.length && !signal.aborted) {
            const chunk = chunks.shift()!;
            this.playbackEndsAt =
              Math.max(Date.now(), this.playbackEndsAt) + mulawDurationMs(chunk);
            this.cb.onAudio(chunk);
          }
          if (done) break;
          await new Promise<void>((resolve) => (wake = resolve));
          wake = null;
        }
        if (failed && !signal.aborted) logger.warn({ err: failed }, 'Text-to-speech failed');
        else if (!signal.aborted) this.spokenThisTurn += ` ${text}`;
      } finally {
        this.synthesizing = false;
      }
    });
  }

  private synthesize(text: string, onChunk: (chunk: string) => void, signal: AbortSignal) {
    if (this.config.speech === 'ELEVENLABS') {
      return elevenLabsSpeak(
        this.config.speechApiKey,
        this.config.voice,
        text,
        onChunk,
        signal,
        isoLanguage(this.config.language),
        this.config.speechModel,
      );
    }
    if (this.config.speech === 'SARVAM') {
      return sarvamSpeak(
        this.config.speechApiKey,
        this.config.voice,
        text,
        onChunk,
        signal,
        this.config.language,
        this.config.speechModel,
      );
    }
    return deepgramSpeak(this.config.speechApiKey, this.config.voice, text, onChunk, signal);
  }
}
