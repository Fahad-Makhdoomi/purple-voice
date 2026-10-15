import type { AiProvider } from './enums';

/**
 * Models offered in the agent builder. Subscribers can type any model id the
 * vendor supports; these are the suggestions the dropdown shows first.
 *
 * Latency matters on a phone call: every extra second of model time is a
 * second of silence on the line. The `hint` tells the subscriber which
 * models answer fastest.
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
