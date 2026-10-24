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
  SARVAM: [
    {
      id: 'sarvam-105b-conversations',
      label: 'Sarvam 105B Conversations',
      hint: 'Built for voice agents, Indian languages',
    },
    { id: 'sarvam-105b', label: 'Sarvam 105B', hint: 'Deeper reasoning, slower' },
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
  SARVAM: 'sarvam-105b-conversations',
};

/** OpenAI Realtime (speech-to-speech) models for the REALTIME engine. */
export const REALTIME_MODELS: ModelOption[] = [
  { id: 'gpt-realtime', label: 'GPT Realtime' },
  { id: 'gpt-realtime-mini', label: 'GPT Realtime mini', hint: 'Lower cost' },
];

/** Every OpenAI Realtime voice (marin and cedar sound the most natural). */
export const REALTIME_VOICES: ModelOption[] = [
  { id: 'marin', label: 'Marin — natural, warm', hint: 'Recommended' },
  { id: 'cedar', label: 'Cedar — natural, deep', hint: 'Recommended' },
  { id: 'alloy', label: 'Alloy — neutral, balanced' },
  { id: 'ash', label: 'Ash — clear, confident' },
  { id: 'ballad', label: 'Ballad — soft, expressive' },
  { id: 'coral', label: 'Coral — warm, friendly' },
  { id: 'echo', label: 'Echo — calm, steady' },
  { id: 'sage', label: 'Sage — gentle, thoughtful' },
  { id: 'shimmer', label: 'Shimmer — bright, energetic' },
  { id: 'verse', label: 'Verse — versatile, expressive' },
];

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

/** All 30 prebuilt Gemini voices. Each speaks every language the model supports. */
export const GEMINI_LIVE_VOICES: ModelOption[] = [
  { id: 'Zephyr', label: 'Zephyr — bright' },
  { id: 'Puck', label: 'Puck — upbeat' },
  { id: 'Charon', label: 'Charon — informative' },
  { id: 'Kore', label: 'Kore — firm' },
  { id: 'Fenrir', label: 'Fenrir — excitable' },
  { id: 'Leda', label: 'Leda — youthful' },
  { id: 'Orus', label: 'Orus — firm' },
  { id: 'Aoede', label: 'Aoede — breezy' },
  { id: 'Callirrhoe', label: 'Callirrhoe — easy-going' },
  { id: 'Autonoe', label: 'Autonoe — bright' },
  { id: 'Enceladus', label: 'Enceladus — breathy' },
  { id: 'Iapetus', label: 'Iapetus — clear' },
  { id: 'Umbriel', label: 'Umbriel — easy-going' },
  { id: 'Algieba', label: 'Algieba — smooth' },
  { id: 'Despina', label: 'Despina — smooth' },
  { id: 'Erinome', label: 'Erinome — clear' },
  { id: 'Algenib', label: 'Algenib — gravelly' },
  { id: 'Rasalgethi', label: 'Rasalgethi — informative' },
  { id: 'Laomedeia', label: 'Laomedeia — upbeat' },
  { id: 'Achernar', label: 'Achernar — soft' },
  { id: 'Alnilam', label: 'Alnilam — firm' },
  { id: 'Schedar', label: 'Schedar — even' },
  { id: 'Gacrux', label: 'Gacrux — mature' },
  { id: 'Pulcherrima', label: 'Pulcherrima — forward' },
  { id: 'Achird', label: 'Achird — friendly' },
  { id: 'Zubenelgenubi', label: 'Zubenelgenubi — casual' },
  { id: 'Vindemiatrix', label: 'Vindemiatrix — gentle' },
  { id: 'Sadachbia', label: 'Sadachbia — lively' },
  { id: 'Sadaltager', label: 'Sadaltager — knowledgeable' },
  { id: 'Sulafat', label: 'Sulafat — warm' },
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

/**
 * Sarvam Bulbul voices for the SARVAM engine. Plain names are bulbul:v3 (any
 * supported language); name_language_style ids are bulbul:v4-flash personas;
 * bulbul:v2 has its own short list (SARVAM_V2_VOICES).
 */
export const SARVAM_VOICES: ModelOption[] = [
  { id: 'shubh', label: 'Shubh', hint: 'All Indian languages' },
  { id: 'aditya', label: 'Aditya', hint: 'All Indian languages' },
  { id: 'ritu', label: 'Ritu', hint: 'All Indian languages' },
  { id: 'priya', label: 'Priya', hint: 'All Indian languages' },
  { id: 'neha', label: 'Neha', hint: 'All Indian languages' },
  { id: 'rahul', label: 'Rahul', hint: 'All Indian languages' },
  { id: 'pooja', label: 'Pooja', hint: 'All Indian languages' },
  { id: 'rohan', label: 'Rohan', hint: 'All Indian languages' },
  { id: 'simran', label: 'Simran', hint: 'All Indian languages' },
  { id: 'kavya', label: 'Kavya', hint: 'All Indian languages' },
  { id: 'amit', label: 'Amit', hint: 'All Indian languages' },
  { id: 'dev', label: 'Dev', hint: 'All Indian languages' },
  { id: 'ishita', label: 'Ishita', hint: 'All Indian languages' },
  { id: 'shreya', label: 'Shreya', hint: 'All Indian languages' },
  { id: 'ratan', label: 'Ratan', hint: 'All Indian languages' },
  { id: 'varun', label: 'Varun', hint: 'All Indian languages' },
  { id: 'manan', label: 'Manan', hint: 'All Indian languages' },
  { id: 'sumit', label: 'Sumit', hint: 'All Indian languages' },
  { id: 'roopa', label: 'Roopa', hint: 'All Indian languages' },
  { id: 'kabir', label: 'Kabir', hint: 'All Indian languages' },
  { id: 'aayan', label: 'Aayan', hint: 'All Indian languages' },
  { id: 'ashutosh', label: 'Ashutosh', hint: 'All Indian languages' },
  { id: 'advait', label: 'Advait', hint: 'All Indian languages' },
  { id: 'anand', label: 'Anand', hint: 'All Indian languages' },
  { id: 'tanya', label: 'Tanya', hint: 'All Indian languages' },
  { id: 'tarun', label: 'Tarun', hint: 'All Indian languages' },
  { id: 'sunny', label: 'Sunny', hint: 'All Indian languages' },
  { id: 'mani', label: 'Mani', hint: 'All Indian languages' },
  { id: 'gokul', label: 'Gokul', hint: 'All Indian languages' },
  { id: 'vijay', label: 'Vijay', hint: 'All Indian languages' },
  { id: 'shruti', label: 'Shruti', hint: 'All Indian languages' },
  { id: 'suhani', label: 'Suhani', hint: 'All Indian languages' },
  { id: 'mohit', label: 'Mohit', hint: 'All Indian languages' },
  { id: 'kavitha', label: 'Kavitha', hint: 'All Indian languages' },
  { id: 'rehan', label: 'Rehan', hint: 'All Indian languages' },
  { id: 'soham', label: 'Soham', hint: 'All Indian languages' },
  { id: 'rupali', label: 'Rupali', hint: 'All Indian languages' },
  { id: 'arnab_bn_conversation', label: 'Arnab — conversation', hint: 'Bengali persona' },
  { id: 'roopa_bn_conversational', label: 'Roopa — conversational', hint: 'Bengali persona' },
  { id: 'deven_en_conversation', label: 'Deven — conversation', hint: 'English persona' },
  { id: 'dev_en_conversational', label: 'Dev — conversational', hint: 'English persona' },
  { id: 'ishita_en_customer', label: 'Ishita — customer', hint: 'English persona' },
  { id: 'neha_en_customer', label: 'Neha — customer', hint: 'English persona' },
  { id: 'roopa_en_conversational', label: 'Roopa — conversational', hint: 'English persona' },
  { id: 'shalini_en_customer', label: 'Shalini — customer', hint: 'English persona' },
  { id: 'simran_en_conversation', label: 'Simran — conversation', hint: 'English persona' },
  { id: 'simran_en_customer', label: 'Simran — customer', hint: 'English persona' },
  { id: 'simran_en_sales', label: 'Simran — sales', hint: 'English persona' },
  { id: 'sanchita_en_insurance', label: 'Sanchita — insurance', hint: 'English persona' },
  { id: 'zarina_en_conversation', label: 'Zarina — conversation', hint: 'English persona' },
  { id: 'amelia_en_conversational', label: 'Amelia — conversational', hint: 'English persona' },
  { id: 'sophia_en_conversational', label: 'Sophia — conversational', hint: 'English persona' },
  { id: 'ishita_enhi_customer', label: 'Ishita — customer', hint: 'Hinglish persona' },
  {
    id: 'ishita_enhi_customer_expressive',
    label: 'Ishita — customer expressive',
    hint: 'Hinglish persona',
  },
  { id: 'shalini_enhi_customer', label: 'Shalini — customer', hint: 'Hinglish persona' },
  { id: 'shubh_enhi_banking', label: 'Shubh — banking', hint: 'Hinglish persona' },
  { id: 'simran_enhi_customer', label: 'Simran — customer', hint: 'Hinglish persona' },
  {
    id: 'simran_enhi_banking_expressive',
    label: 'Simran — banking expressive',
    hint: 'Hinglish persona',
  },
  { id: 'sunny_enhi_customer', label: 'Sunny — customer', hint: 'Hinglish persona' },
  { id: 'bhavik_gu_conversation', label: 'Bhavik — conversation', hint: 'Gujarati persona' },
  { id: 'pooja_gu_conversational', label: 'Pooja — conversational', hint: 'Gujarati persona' },
  { id: 'pooja_gu_customer', label: 'Pooja — customer', hint: 'Gujarati persona' },
  { id: 'aayan_hi_conversational', label: 'Aayan — conversational', hint: 'Hindi persona' },
  { id: 'amit_hi_conversational', label: 'Amit — conversational', hint: 'Hindi persona' },
  { id: 'aditya_hi_conversational', label: 'Aditya — conversational', hint: 'Hindi persona' },
  { id: 'aditya_hi_sales', label: 'Aditya — sales', hint: 'Hindi persona' },
  { id: 'aparna_hi_customer', label: 'Aparna — customer', hint: 'Hindi persona' },
  { id: 'aparna_hi_kyc', label: 'Aparna — kyc', hint: 'Hindi persona' },
  { id: 'ishita_hi_banking', label: 'Ishita — banking', hint: 'Hindi persona' },
  { id: 'kabir_hi_conversational', label: 'Kabir — conversational', hint: 'Hindi persona' },
  { id: 'kavya_hi_conversational', label: 'Kavya — conversational', hint: 'Hindi persona' },
  { id: 'manan_hi_conversational', label: 'Manan — conversational', hint: 'Hindi persona' },
  { id: 'mohit_hi_conversational', label: 'Mohit — conversational', hint: 'Hindi persona' },
  { id: 'rahul_hi_conversational', label: 'Rahul — conversational', hint: 'Hindi persona' },
  {
    id: 'ratan_hi_customer_expressive',
    label: 'Ratan — customer expressive',
    hint: 'Hindi persona',
  },
  { id: 'ritu_hi_conversation', label: 'Ritu — conversation', hint: 'Hindi persona' },
  { id: 'ritu_hi_customer', label: 'Ritu — customer', hint: 'Hindi persona' },
  { id: 'ritu_hi_customer_warm', label: 'Ritu — customer warm', hint: 'Hindi persona' },
  { id: 'ritu_hi_banking', label: 'Ritu — banking', hint: 'Hindi persona' },
  { id: 'ritu_hi_insurance', label: 'Ritu — insurance', hint: 'Hindi persona' },
  { id: 'ritu_hi_sales', label: 'Ritu — sales', hint: 'Hindi persona' },
  { id: 'roopa_hi_conversational', label: 'Roopa — conversational', hint: 'Hindi persona' },
  { id: 'sanchita_hi_assistant', label: 'Sanchita — assistant', hint: 'Hindi persona' },
  { id: 'sanchita_hi_banking', label: 'Sanchita — banking', hint: 'Hindi persona' },
  { id: 'sanchita_hi_kyc', label: 'Sanchita — kyc', hint: 'Hindi persona' },
  { id: 'sarika_hi_conversation', label: 'Sarika — conversation', hint: 'Hindi persona' },
  { id: 'shreya_hi_conversational', label: 'Shreya — conversational', hint: 'Hindi persona' },
  { id: 'shubh_hi_customer', label: 'Shubh — customer', hint: 'Hindi persona' },
  { id: 'simran_hi_assistant', label: 'Simran — assistant', hint: 'Hindi persona' },
  { id: 'simran_hi_conversation', label: 'Simran — conversation', hint: 'Hindi persona' },
  { id: 'simran_hi_sales', label: 'Simran — sales', hint: 'Hindi persona' },
  { id: 'sumit_hi_conversational', label: 'Sumit — conversational', hint: 'Hindi persona' },
  { id: 'tarun_hi_conversational', label: 'Tarun — conversational', hint: 'Hindi persona' },
  { id: 'tarun_hi_sales', label: 'Tarun — sales', hint: 'Hindi persona' },
  { id: 'chaitra_hi_customer', label: 'Chaitra — customer', hint: 'Hindi persona' },
  { id: 'aarti_hi_customer', label: 'Aarti — customer', hint: 'Hindi persona' },
  { id: 'chaitra_kn_conversation', label: 'Chaitra — conversation', hint: 'Kannada persona' },
  { id: 'chetan_kn_conversation', label: 'Chetan — conversation', hint: 'Kannada persona' },
  { id: 'ishita_mr_conversational', label: 'Ishita — conversational', hint: 'Marathi persona' },
  { id: 'nilesh_mr_conversation', label: 'Nilesh — conversation', hint: 'Marathi persona' },
  { id: 'ritu_mr_insurance', label: 'Ritu — insurance', hint: 'Marathi persona' },
  { id: 'anand_pa_conversation', label: 'Anand — conversation', hint: 'Punjabi persona' },
  { id: 'anand_pa_customer', label: 'Anand — customer', hint: 'Punjabi persona' },
  { id: 'jaspal_pa_banking', label: 'Jaspal — banking', hint: 'Punjabi persona' },
  { id: 'kavitha_te_conversation', label: 'Kavitha — conversation', hint: 'Telugu persona' },
  { id: 'pooja_te_conversation', label: 'Pooja — conversation', hint: 'Telugu persona' },
];

/** bulbul:v2 speakers (the older model; pitch and loudness controls). */
export const SARVAM_V2_VOICES: ModelOption[] = [
  { id: 'anushka', label: 'Anushka', hint: 'female' },
  { id: 'manisha', label: 'Manisha', hint: 'female' },
  { id: 'vidya', label: 'Vidya', hint: 'female' },
  { id: 'arya', label: 'Arya', hint: 'female' },
  { id: 'abhilash', label: 'Abhilash', hint: 'male' },
  { id: 'karun', label: 'Karun', hint: 'male' },
  { id: 'hitesh', label: 'Hitesh', hint: 'male' },
];

/**
 * The text-to-speech model the speech engines speak with, chosen by staff
 * next to the LLM. Deepgram has none to choose: its voice ids name the model.
 */
export const SPEECH_MODELS: Partial<Record<VoiceEngine, ModelOption[]>> = {
  SARVAM: [
    { id: 'bulbul:v3', label: 'Bulbul v3', hint: '37 voices, every Indian language' },
    {
      id: 'bulbul:v4-flash',
      label: 'Bulbul v4 Flash',
      hint: 'Persona voices per language and style',
    },
    { id: 'bulbul:v2', label: 'Bulbul v2', hint: 'Older model, 7 voices' },
  ],
  ELEVENLABS: [
    {
      id: 'eleven_flash_v2_5',
      label: 'Flash v2.5',
      hint: 'Fastest, 32 languages (recommended for calls)',
    },
    { id: 'eleven_turbo_v2_5', label: 'Turbo v2.5', hint: 'Fast, a little richer' },
    { id: 'eleven_multilingual_v2', label: 'Multilingual v2', hint: 'Best quality, slower' },
    { id: 'eleven_v3', label: 'Eleven v3', hint: 'Most expressive, slowest' },
  ],
};

/** The speech model an engine uses when staff haven't picked one ('' when it has no choice). */
export function speechModelFor(engine: VoiceEngine, speechModel?: string | null): string {
  const options = SPEECH_MODELS[engine];
  if (!options) return '';
  return speechModel && options.some((m) => m.id === speechModel) ? speechModel : options[0]!.id;
}

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

/** The Indian languages Sarvam both hears and speaks (Bulbul's set). */
export const SARVAM_LANGUAGES = [
  { id: 'en-IN', label: 'English (India)' },
  { id: 'hi', label: 'Hindi' },
  { id: 'bn-IN', label: 'Bengali' },
  { id: 'gu-IN', label: 'Gujarati' },
  { id: 'kn-IN', label: 'Kannada' },
  { id: 'ml-IN', label: 'Malayalam' },
  { id: 'mr-IN', label: 'Marathi' },
  { id: 'od-IN', label: 'Odia' },
  { id: 'pa-IN', label: 'Punjabi' },
  { id: 'ta-IN', label: 'Tamil' },
  { id: 'te-IN', label: 'Telugu' },
] as const;

/** An agent language as Sarvam names it ("hi" → "hi-IN", other English → "en-IN"). */
export function sarvamLanguage(language: string): string {
  const base = language.split('-')[0]!.toLowerCase();
  const known = SARVAM_LANGUAGES.find((l) => l.id.split('-')[0] === base);
  return known ? `${base}-IN` : 'en-IN';
}

/** The languages an agent can speak under an engine. */
export function languagesForEngine(
  engine: VoiceEngine,
): ReadonlyArray<{ id: string; label: string }> {
  if (engine === 'SARVAM') return SARVAM_LANGUAGES;
  return engine === 'ELEVENLABS' ? [...LANGUAGES, ...ELEVENLABS_EXTRA_LANGUAGES] : LANGUAGES;
}

/** A language's name for any language an agent might have, whatever the engine. */
export function languageLabel(id: string): string {
  return (
    [...LANGUAGES, ...ELEVENLABS_EXTRA_LANGUAGES, ...SARVAM_LANGUAGES].find((l) => l.id === id)
      ?.label ?? id
  );
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

/** The voices an agent can use under each engine (Sarvam: for its Bulbul model). */
export function voicesForEngine(engine: VoiceEngine, speechModel?: string | null): ModelOption[] {
  switch (engine) {
    case 'REALTIME':
      return REALTIME_VOICES;
    case 'GEMINI_LIVE':
      return GEMINI_LIVE_VOICES;
    case 'CASCADED':
      return CASCADED_VOICES;
    case 'ELEVENLABS':
      return ELEVENLABS_VOICES;
    case 'SARVAM': {
      const model = speechModelFor('SARVAM', speechModel);
      if (model === 'bulbul:v2') return SARVAM_V2_VOICES;
      const persona = model === 'bulbul:v4-flash';
      return SARVAM_VOICES.filter((v) => v.id.includes('_') === persona);
    }
  }
}

export const DEFAULT_VOICE: Record<VoiceEngine, string> = {
  REALTIME: 'marin',
  GEMINI_LIVE: 'Puck',
  CASCADED: 'aura-2-thalia-en',
  ELEVENLABS: '21m00Tcm4TlvDq8ikWAM',
  SARVAM: 'shubh',
};

/** The default voice of an engine (Sarvam: the first voice of its Bulbul model). */
export function defaultVoiceFor(engine: VoiceEngine, speechModel?: string | null): string {
  if (engine !== 'SARVAM') return DEFAULT_VOICE[engine];
  return voicesForEngine(engine, speechModel)[0]!.id;
}

/** The voice to use: the agent's own if the engine offers it, else the engine default. */
export function voiceForEngine(
  engine: VoiceEngine,
  voice: string | null | undefined,
  speechModel?: string | null,
): string {
  if (engine === 'ELEVENLABS' && isElevenLabsVoiceId(voice)) return voice;
  return voice && voicesForEngine(engine, speechModel).some((v) => v.id === voice)
    ? voice
    : defaultVoiceFor(engine, speechModel);
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
 * model and GEMINI_LIVE on a Gemini text model; CASCADED, ELEVENLABS and
 * SARVAM use their own LLM.
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
  // Sarvam can also be the LLM vendor; then one Sarvam key covers both.
  if (engine === 'SARVAM') return llmProvider === 'SARVAM' ? ['SARVAM'] : [llmProvider, 'SARVAM'];
  return [llmProvider, 'DEEPGRAM'];
}
