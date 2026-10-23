import type { AiProvider, CredentialProvider, VoiceEngine } from './enums';

/**
 * The AI catalogue staff choose from when they set up a subscriber's AI
 * (Admin → Subscribers → AI). Staff can type any model id the vendor
 * supports; these are the suggestions the dropdown shows first.
 *
 * Latency matters on a phone call: every extra second of model time is a
 * second of silence on the line. The `hint` says which models answer fastest.
 */
export interface ModelOption {
  id: string;
  label: string;
  hint?: string;
}

export const LLM_MODELS: Record<AiProvider, ModelOption[]> = {
  ANTHROPIC: [
    { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', hint: 'Most capable' },
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', hint: 'Balanced speed and quality' },
    { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5', hint: 'Fastest replies on calls' },
  ],
  OPENAI: [
    { id: 'gpt-4.1', label: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini', hint: 'Fast' },
    { id: 'gpt-4o', label: 'GPT-4o' },
  ],
  GEMINI: [
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', hint: 'Fast' },
  ],
};

export const DEFAULT_LLM_MODEL: Record<AiProvider, string> = {
  ANTHROPIC: 'claude-opus-5-5',
  OPENAI: 'gpt-4.1',
  GEMINI: 'gemini-2.5-flash',
};

/** OpenAI Realtime (speech-to-speech) models for the REALTIME engine. */
export const REALTIME_MODELS: ModelOption[] = [
  { id: 'gpt-realtime', label: 'GPT Realtime' },
  { id: 'gpt-realtime-mini', label: 'GPT Realtime mini', hint: 'Lower cost' },
];

export const REALTIME_VOICES = [
  'marin',
  'cedar',
  'alloy',
  'ash',
  'ballad',
  'coral',
  'echo',
  'sage',
  'shimmer',
  'verse',
] as const;

/**
 * Gemini Live (speech-to-speech) models for the GEMINI_LIVE engine.
 * gemini-3.8-live is Google's default for low-latency voice agents; the
 * others are older generations kept for accounts that still use them.
 */
export const GEMINI_LIVE_MODELS: ModelOption[] = [
  { id: 'gemini-3.8-live', label: 'Gemini 3.8 Live', hint: 'Recommended' },
  { id: 'gemini-3.1-flash-live-preview', label: 'Gemini 3.1 Flash Live (preview)' },
  {
    id: 'gemini-2.5-flash-native-audio-preview-12-2025',
    label: 'Gemini 2.5 Flash native audio (preview)',
  },
];

/** Prebuilt Gemini voices. Each speaks every language the model supports. */
export const GEMINI_LIVE_VOICES: ModelOption[] = [
  { id: 'Puck', label: 'Puck — upbeat' },
  { id: 'Charon', label: 'Charon — informative' },
  { id: 'Kore', label: 'Kore — firm' },
  { id: 'Fenrir', label: 'Fenrir — excitable' },
  { id: 'Aoede', label: 'Aoede — breezy' },
  { id: 'Leda', label: 'Leda — youthful' },
  { id: 'Orus', label: 'Orus — firm' },
  { id: 'Zephyr', label: 'Zephyr — bright' },
];

/** ElevenLabs premade voices for the ELEVENLABS engine (id = ElevenLabs voice id). */
export const ELEVENLABS_VOICES: ModelOption[] = [
  { id: '21m00Tcm4TlvDq8ikWAM', label: 'Rachel — calm, clear (US)' },
  { id: 'EXAVITQu4vr4xnSDxMOL', label: 'Sarah — soft, friendly (US)' },
  { id: 'MF3mGyEYCl7XYWbV9V6O', label: 'Elli — young, warm (US)' },
  { id: 'AZnzlk1XvdvUeBnXmlld', label: 'Domi — strong, confident (US)' },
  { id: 'pNInz6obpgDQGcFmaJgB', label: 'Adam — deep, steady (US)' },
  { id: 'ErXwobaYiN019PkySvjV', label: 'Antoni — well-rounded (US)' },
  { id: 'TxGEqnHWrfWFTfGW9XjX', label: 'Josh — young, upbeat (US)' },
  { id: 'yoZ06aMxZJJ28mfd3POQ', label: 'Sam — raspy, direct (US)' },
];

/** Deepgram Aura voices for the CASCADED engine. */
export const CASCADED_VOICES: ModelOption[] = [
  { id: 'aura-2-thalia-en', label: 'Thalia — warm, clear (US)' },
  { id: 'aura-2-andromeda-en', label: 'Andromeda — calm, friendly (US)' },
  { id: 'aura-2-apollo-en', label: 'Apollo — confident (US)' },
  { id: 'aura-2-arcas-en', label: 'Arcas — natural, smooth (US)' },
  { id: 'aura-2-helena-en', label: 'Helena — caring (US)' },
  { id: 'aura-2-draco-en', label: 'Draco — warm (UK)' },
];

export const LANGUAGES = [
  { id: 'en-US', label: 'English (US)' },
  { id: 'en-GB', label: 'English (UK)' },
  { id: 'en-IN', label: 'English (India)' },
  { id: 'es', label: 'Spanish' },
  { id: 'fr', label: 'French' },
  { id: 'de', label: 'German' },
  { id: 'hi', label: 'Hindi' },
] as const;

/**
 * More languages for the ELEVENLABS engine: the ones ElevenLabs' low-latency
 * voice model speaks, which its realtime speech recognition also hears.
 */
export const ELEVENLABS_EXTRA_LANGUAGES = [
  { id: 'pt', label: 'Portuguese' },
  { id: 'it', label: 'Italian' },
  { id: 'nl', label: 'Dutch' },
  { id: 'ja', label: 'Japanese' },
  { id: 'ko', label: 'Korean' },
  { id: 'zh', label: 'Chinese' },
  { id: 'ar', label: 'Arabic' },
  { id: 'ru', label: 'Russian' },
  { id: 'tr', label: 'Turkish' },
  { id: 'pl', label: 'Polish' },
  { id: 'uk', label: 'Ukrainian' },
  { id: 'ta', label: 'Tamil' },
  { id: 'id', label: 'Indonesian' },
  { id: 'ms', label: 'Malay' },
  { id: 'fil', label: 'Filipino' },
  { id: 'vi', label: 'Vietnamese' },
  { id: 'sv', label: 'Swedish' },
  { id: 'da', label: 'Danish' },
  { id: 'no', label: 'Norwegian' },
  { id: 'fi', label: 'Finnish' },
  { id: 'cs', label: 'Czech' },
  { id: 'sk', label: 'Slovak' },
  { id: 'hu', label: 'Hungarian' },
  { id: 'ro', label: 'Romanian' },
  { id: 'bg', label: 'Bulgarian' },
  { id: 'el', label: 'Greek' },
  { id: 'hr', label: 'Croatian' },
] as const;

/** The languages an agent can speak under an engine. */
export function languagesForEngine(
  engine: VoiceEngine,
): ReadonlyArray<{ id: string; label: string }> {
  return engine === 'ELEVENLABS' ? [...LANGUAGES, ...ELEVENLABS_EXTRA_LANGUAGES] : LANGUAGES;
}

/** A language's name for any language an agent might have, whatever the engine. */
export function languageLabel(id: string): string {
  return [...LANGUAGES, ...ELEVENLABS_EXTRA_LANGUAGES].find((l) => l.id === id)?.label ?? id;
}

/** The language code speech vendors want: "en-US" → "en", "fil" stays "fil". */
export function isoLanguage(language: string): string {
  return language.split('-')[0]!.toLowerCase();
}

/** ElevenLabs voice ids are 20 letters and digits; any voice on the account (or added from the library) works. */
export function isElevenLabsVoiceId(voice: string | null | undefined): voice is string {
  return !!voice && /^[A-Za-z0-9]{10,40}$/.test(voice);
}

// ── Per-engine helpers ──────────────────────────────────────────────────────

/** The voices an agent can use under each engine. */
export function voicesForEngine(engine: VoiceEngine): ModelOption[] {
  switch (engine) {
    case 'REALTIME':
      return REALTIME_VOICES.map((id) => ({ id, label: id[0]!.toUpperCase() + id.slice(1) }));
    case 'GEMINI_LIVE':
      return GEMINI_LIVE_VOICES;
    case 'CASCADED':
      return CASCADED_VOICES;
    case 'ELEVENLABS':
      return ELEVENLABS_VOICES;
  }
}

export const DEFAULT_VOICE: Record<VoiceEngine, string> = {
  REALTIME: 'marin',
  GEMINI_LIVE: 'Puck',
  CASCADED: 'aura-2-thalia-en',
  ELEVENLABS: '21m00Tcm4TlvDq8ikWAM',
};

/** The voice to use: the agent's own if the engine offers it, else the engine default. */
export function voiceForEngine(engine: VoiceEngine, voice: string | null | undefined): string {
  if (engine === 'ELEVENLABS' && isElevenLabsVoiceId(voice)) return voice;
  return voice && voicesForEngine(engine).some((v) => v.id === voice)
    ? voice
    : DEFAULT_VOICE[engine];
}

/** Model suggestions for an engine (CASCADED and ELEVENLABS: for their LLM vendor). */
export function modelsForEngine(engine: VoiceEngine, llmProvider: AiProvider): ModelOption[] {
  if (engine === 'REALTIME') return REALTIME_MODELS;
  if (engine === 'GEMINI_LIVE') return GEMINI_LIVE_MODELS;
  return LLM_MODELS[llmProvider];
}

export function defaultModelForEngine(engine: VoiceEngine, llmProvider: AiProvider): string {
  if (engine === 'REALTIME') return REALTIME_MODELS[0]!.id;
  if (engine === 'GEMINI_LIVE') return GEMINI_LIVE_MODELS[0]!.id;
  return DEFAULT_LLM_MODEL[llmProvider];
}

/** OpenAI chat model for summarising REALTIME calls: fast and cheap, good at structured output. */
export const REALTIME_SUMMARY_MODEL = 'gpt-4.1-mini';

/**
 * The text model that writes post-call summaries. Speech-to-speech models
 * can't return text-only JSON, so REALTIME summarises on an OpenAI chat
 * model and GEMINI_LIVE on a Gemini text model; CASCADED and ELEVENLABS use
 * their own LLM.
 */
export function summaryModelForEngine(
  engine: VoiceEngine,
  llmProvider: AiProvider,
  model: string,
): { provider: AiProvider; model: string } {
  if (engine === 'REALTIME') return { provider: 'OPENAI', model: REALTIME_SUMMARY_MODEL };
  if (engine === 'GEMINI_LIVE') return { provider: 'GEMINI', model: DEFAULT_LLM_MODEL.GEMINI };
  return { provider: llmProvider, model };
}

/** API keys an engine needs before its agents can take calls. */
export function requiredProviders(
  engine: VoiceEngine,
  llmProvider: AiProvider,
): CredentialProvider[] {
  if (engine === 'REALTIME') return ['OPENAI'];
  if (engine === 'GEMINI_LIVE') return ['GEMINI'];
  if (engine === 'ELEVENLABS') return [llmProvider, 'ELEVENLABS'];
  return [llmProvider, 'DEEPGRAM'];
}
