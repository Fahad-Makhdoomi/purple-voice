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

export type VoiceGender = 'female' | 'male' | 'neutral';

/** A voice an agent can speak with, described so subscribers can filter and compare. */
export interface VoiceOption extends ModelOption {
  gender?: VoiceGender;
  /** Accent or region, e.g. "American", "British", "Indian". */
  accent?: string;
  /** The one language the voice is made for; unset when it speaks every language the AI does. */
  language?: string;
  /** Tone and best use, lower case: "warm", "professional", "sales"… */
  styles?: string[];
  /** Cloned or designed for this account (ElevenLabs). */
  custom?: boolean;
}

const F = 'female' as const;
const M = 'male' as const;
const N = 'neutral' as const;
function voice(
  id: string,
  label: string,
  gender: VoiceGender,
  styles: string[],
  extra: Partial<VoiceOption> = {},
): VoiceOption {
  return { id, label, gender, styles, ...extra };
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
export const REALTIME_VOICES: VoiceOption[] = [
  voice('marin', 'Marin', F, ['natural', 'warm'], { hint: 'Recommended' }),
  voice('cedar', 'Cedar', M, ['natural', 'deep'], { hint: 'Recommended' }),
  voice('alloy', 'Alloy', N, ['neutral', 'balanced']),
  voice('ash', 'Ash', M, ['clear', 'confident']),
  voice('ballad', 'Ballad', M, ['soft', 'expressive']),
  voice('coral', 'Coral', F, ['warm', 'friendly']),
  voice('echo', 'Echo', M, ['calm', 'steady']),
  voice('sage', 'Sage', F, ['gentle', 'thoughtful']),
  voice('shimmer', 'Shimmer', F, ['bright', 'energetic']),
  voice('verse', 'Verse', M, ['versatile', 'expressive']),
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
export const GEMINI_LIVE_VOICES: VoiceOption[] = [
  voice('Zephyr', 'Zephyr', F, ['bright']),
  voice('Puck', 'Puck', M, ['upbeat']),
  voice('Charon', 'Charon', M, ['informative']),
  voice('Kore', 'Kore', F, ['firm']),
  voice('Fenrir', 'Fenrir', M, ['excitable']),
  voice('Leda', 'Leda', F, ['youthful']),
  voice('Orus', 'Orus', M, ['firm']),
  voice('Aoede', 'Aoede', F, ['breezy']),
  voice('Callirrhoe', 'Callirrhoe', F, ['easy-going']),
  voice('Autonoe', 'Autonoe', F, ['bright']),
  voice('Enceladus', 'Enceladus', M, ['breathy']),
  voice('Iapetus', 'Iapetus', M, ['clear']),
  voice('Umbriel', 'Umbriel', M, ['easy-going']),
  voice('Algieba', 'Algieba', M, ['smooth']),
  voice('Despina', 'Despina', F, ['smooth']),
  voice('Erinome', 'Erinome', F, ['clear']),
  voice('Algenib', 'Algenib', M, ['gravelly']),
  voice('Rasalgethi', 'Rasalgethi', M, ['informative']),
  voice('Laomedeia', 'Laomedeia', F, ['upbeat']),
  voice('Achernar', 'Achernar', F, ['soft']),
  voice('Alnilam', 'Alnilam', M, ['firm']),
  voice('Schedar', 'Schedar', M, ['even']),
  voice('Gacrux', 'Gacrux', F, ['mature']),
  voice('Pulcherrima', 'Pulcherrima', F, ['forward']),
  voice('Achird', 'Achird', M, ['friendly']),
  voice('Zubenelgenubi', 'Zubenelgenubi', M, ['casual']),
  voice('Vindemiatrix', 'Vindemiatrix', F, ['gentle']),
  voice('Sadachbia', 'Sadachbia', M, ['lively']),
  voice('Sadaltager', 'Sadaltager', M, ['knowledgeable']),
  voice('Sulafat', 'Sulafat', F, ['warm']),
];

/**
 * ElevenLabs default voices for the ELEVENLABS engine (id = ElevenLabs voice id),
 * shown when the account's own voice list can't be fetched.
 */
export const ELEVENLABS_VOICES: VoiceOption[] = [
  voice('EXAVITQu4vr4xnSDxMOL', 'Sarah', F, ['soft', 'professional'], { accent: 'American' }),
  voice('FGY2WhTYpPnrIDTdsKH5', 'Laura', F, ['upbeat', 'quirky'], { accent: 'American' }),
  voice('9BWtsMINqrJLrRacOk9x', 'Aria', F, ['expressive', 'husky'], { accent: 'American' }),
  voice('XrExE9yKIg1WjnnlVkGX', 'Matilda', F, ['friendly', 'warm'], { accent: 'American' }),
  voice('cgSgspJ2msm6clMCkdW9', 'Jessica', F, ['expressive', 'conversational'], {
    accent: 'American',
  }),
  voice('Xb7hH8MSUJpSbSDYk0k2', 'Alice', F, ['confident', 'clear'], { accent: 'British' }),
  voice('pFZP5JQG7iQjIQuC4Bku', 'Lily', F, ['warm', 'velvety'], { accent: 'British' }),
  voice('XB0fDUnXU5powFXDhCwa', 'Charlotte', F, ['calm', 'smooth'], { accent: 'Swedish' }),
  voice('SAz9YHcvj6GT2YYXdXww', 'River', N, ['confident', 'relaxed'], { accent: 'American' }),
  voice('CwhRBWXzGAHq8TQ4Fs17', 'Roger', M, ['confident', 'casual'], { accent: 'American' }),
  voice('TX3LPaxmHKxFdv7VOQHJ', 'Liam', M, ['articulate', 'young'], { accent: 'American' }),
  voice('bIHbv24MWmeRgasZH58o', 'Will', M, ['friendly', 'relaxed'], { accent: 'American' }),
  voice('cjVigY5qzO86Huf0OWal', 'Eric', M, ['friendly', 'smooth'], { accent: 'American' }),
  voice('iP95p4xoKVk53GoZ742B', 'Chris', M, ['casual', 'natural'], { accent: 'American' }),
  voice('nPczCjzI2devNBz1zQrb', 'Brian', M, ['deep', 'warm'], { accent: 'American' }),
  voice('pqHfZKP75CvOlQylNhV4', 'Bill', M, ['trustworthy', 'mature'], { accent: 'American' }),
  voice('JBFqnCBsd6RMkjVDRZzb', 'George', M, ['warm', 'storyteller'], { accent: 'British' }),
  voice('onwK4e9ZLuTAKqWW03F9', 'Daniel', M, ['authoritative', 'professional'], {
    accent: 'British',
  }),
  voice('N2lVS1w4EtoT3dr4eOWO', 'Callum', M, ['intense', 'husky'], { accent: 'Transatlantic' }),
  voice('IKne3meq5aSn9XLyUdCD', 'Charlie', M, ['natural', 'confident'], { accent: 'Australian' }),
  // Classic voices, still available to accounts that use them.
  voice('21m00Tcm4TlvDq8ikWAM', 'Rachel', F, ['calm', 'clear'], { accent: 'American' }),
  voice('MF3mGyEYCl7XYWbV9V6O', 'Elli', F, ['young', 'warm'], { accent: 'American' }),
  voice('AZnzlk1XvdvUeBnXmlld', 'Domi', F, ['strong', 'confident'], { accent: 'American' }),
  voice('pNInz6obpgDQGcFmaJgB', 'Adam', M, ['deep', 'steady'], { accent: 'American' }),
  voice('ErXwobaYiN019PkySvjV', 'Antoni', M, ['well-rounded', 'friendly'], { accent: 'American' }),
  voice('TxGEqnHWrfWFTfGW9XjX', 'Josh', M, ['young', 'upbeat'], { accent: 'American' }),
  voice('yoZ06aMxZJJ28mfd3POQ', 'Sam', M, ['raspy', 'direct'], { accent: 'American' }),
];

/** Sarvam voices before they are described (see sarvamVoice below). */
const SARVAM_RAW: ModelOption[] = [
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
const SARVAM_V2_RAW: ModelOption[] = [
  { id: 'anushka', label: 'Anushka', hint: 'female' },
  { id: 'manisha', label: 'Manisha', hint: 'female' },
  { id: 'vidya', label: 'Vidya', hint: 'female' },
  { id: 'arya', label: 'Arya', hint: 'female' },
  { id: 'abhilash', label: 'Abhilash', hint: 'male' },
  { id: 'karun', label: 'Karun', hint: 'male' },
  { id: 'hitesh', label: 'Hitesh', hint: 'male' },
];

/** Sarvam speakers by first name. */
const SARVAM_FEMALE = new Set(
  'ritu priya neha pooja simran kavya ishita shreya roopa tanya shruti suhani kavitha rupali shalini sanchita zarina amelia sophia aparna sarika chaitra aarti anushka manisha vidya arya'.split(
    ' ',
  ),
);
const SARVAM_PERSONA_LANGUAGE: Record<string, string> = {
  bn: 'Bengali',
  en: 'English',
  enhi: 'Hinglish',
  gu: 'Gujarati',
  hi: 'Hindi',
  kn: 'Kannada',
  mr: 'Marathi',
  pa: 'Punjabi',
  te: 'Telugu',
};

function sarvamVoice(v: ModelOption): VoiceOption {
  const [name, lang, ...style] = v.id.split('_');
  const persona = lang !== undefined;
  return {
    ...v,
    gender: SARVAM_FEMALE.has(name!) ? 'female' : 'male',
    accent: 'Indian',
    language: persona ? SARVAM_PERSONA_LANGUAGE[lang] : undefined,
    styles: persona
      ? style.map((x) => (x === 'conversation' ? 'conversational' : x))
      : ['conversational'],
  };
}

/**
 * Sarvam Bulbul voices for the SARVAM engine, described for filtering. Plain
 * names are bulbul:v3 (any supported language); name_language_style ids are
 * bulbul:v4-flash personas; bulbul:v2 has its own short list.
 */
export const SARVAM_VOICES: VoiceOption[] = SARVAM_RAW.map(sarvamVoice);
export const SARVAM_V2_VOICES: VoiceOption[] = SARVAM_V2_RAW.map(sarvamVoice);

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

/** Every Deepgram Aura-2 voice (English and Spanish) for the CASCADED engine. */
export const CASCADED_VOICES: VoiceOption[] = [
  voice('aura-2-amalthea-en', 'Amalthea', F, ['engaging', 'cheerful'], {
    accent: 'Filipino',
    language: 'English',
  }),
  voice('aura-2-andromeda-en', 'Andromeda', F, ['casual', 'expressive'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-apollo-en', 'Apollo', M, ['confident', 'casual'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-arcas-en', 'Arcas', M, ['natural', 'smooth'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-aries-en', 'Aries', M, ['warm', 'energetic'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-asteria-en', 'Asteria', F, ['clear', 'confident'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-athena-en', 'Athena', F, ['calm', 'professional'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-atlas-en', 'Atlas', M, ['enthusiastic', 'approachable'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-aurora-en', 'Aurora', F, ['cheerful', 'energetic'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-callista-en', 'Callista', F, ['clear', 'professional'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-cora-en', 'Cora', F, ['smooth', 'caring'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-cordelia-en', 'Cordelia', F, ['approachable', 'warm'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-delia-en', 'Delia', F, ['casual', 'friendly'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-draco-en', 'Draco', M, ['warm', 'trustworthy'], {
    accent: 'British',
    language: 'English',
  }),
  voice('aura-2-electra-en', 'Electra', F, ['professional', 'engaging'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-harmonia-en', 'Harmonia', F, ['empathetic', 'calm'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-helena-en', 'Helena', F, ['caring', 'natural'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-hera-en', 'Hera', F, ['smooth', 'professional'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-hermes-en', 'Hermes', M, ['expressive', 'professional'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-hyperion-en', 'Hyperion', M, ['caring', 'warm'], {
    accent: 'Australian',
    language: 'English',
  }),
  voice('aura-2-iris-en', 'Iris', F, ['cheerful', 'approachable'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-janus-en', 'Janus', F, ['southern', 'trustworthy'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-juno-en', 'Juno', F, ['natural', 'engaging'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-jupiter-en', 'Jupiter', M, ['expressive', 'deep'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-luna-en', 'Luna', F, ['friendly', 'natural'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-mars-en', 'Mars', M, ['smooth', 'patient'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-minerva-en', 'Minerva', F, ['positive', 'friendly'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-neptune-en', 'Neptune', M, ['professional', 'patient'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-odysseus-en', 'Odysseus', M, ['calm', 'smooth'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-ophelia-en', 'Ophelia', F, ['expressive', 'cheerful'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-orion-en', 'Orion', M, ['approachable', 'calm'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-orpheus-en', 'Orpheus', M, ['professional', 'confident'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-pandora-en', 'Pandora', F, ['smooth', 'calm'], {
    accent: 'British',
    language: 'English',
  }),
  voice('aura-2-phoebe-en', 'Phoebe', F, ['energetic', 'warm'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-pluto-en', 'Pluto', M, ['smooth', 'empathetic'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-saturn-en', 'Saturn', M, ['knowledgeable', 'deep'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-selene-en', 'Selene', F, ['expressive', 'energetic'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-thalia-en', 'Thalia', F, ['clear', 'energetic'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-theia-en', 'Theia', F, ['expressive', 'polite'], {
    accent: 'Australian',
    language: 'English',
  }),
  voice('aura-2-vesta-en', 'Vesta', F, ['natural', 'patient'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-zeus-en', 'Zeus', M, ['deep', 'trustworthy'], {
    accent: 'American',
    language: 'English',
  }),
  voice('aura-2-sirio-es', 'Sirio', M, ['calm', 'professional'], {
    accent: 'Mexican',
    language: 'Spanish',
  }),
  voice('aura-2-nestor-es', 'Nestor', M, ['calm', 'professional'], {
    accent: 'Spanish (Spain)',
    language: 'Spanish',
  }),
  voice('aura-2-carina-es', 'Carina', F, ['professional', 'energetic'], {
    accent: 'Spanish (Spain)',
    language: 'Spanish',
  }),
  voice('aura-2-celeste-es', 'Celeste', F, ['clear', 'friendly'], {
    accent: 'Colombian',
    language: 'Spanish',
  }),
  voice('aura-2-alvaro-es', 'Alvaro', M, ['calm', 'professional'], {
    accent: 'Spanish (Spain)',
    language: 'Spanish',
  }),
  voice('aura-2-diana-es', 'Diana', F, ['confident', 'friendly'], {
    accent: 'Spanish (Spain)',
    language: 'Spanish',
  }),
  voice('aura-2-aquila-es', 'Aquila', M, ['expressive', 'enthusiastic'], {
    accent: 'Latin American',
    language: 'Spanish',
  }),
  voice('aura-2-selena-es', 'Selena', F, ['approachable', 'friendly'], {
    accent: 'Latin American',
    language: 'Spanish',
  }),
  voice('aura-2-estrella-es', 'Estrella', F, ['natural', 'calm'], {
    accent: 'Mexican',
    language: 'Spanish',
  }),
  voice('aura-2-javier-es', 'Javier', M, ['approachable', 'professional'], {
    accent: 'Mexican',
    language: 'Spanish',
  }),
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
export function voicesForEngine(engine: VoiceEngine, speechModel?: string | null): VoiceOption[] {
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

/**
 * The AI models a subscriber can pick for one agent. The platform's own keys
 * pay for every one of them; nothing about keys or vendors' accounts is shown.
 * Speech-to-speech engines offer that engine's models; the other engines offer
 * the LLMs of every vendor the platform has a key for (id is `VENDOR:model`).
 */
export function agentModelChoices(
  engine: VoiceEngine,
  availableProviders: readonly AiProvider[],
): ModelOption[] {
  if (engine === 'REALTIME') return REALTIME_MODELS;
  if (engine === 'GEMINI_LIVE') return GEMINI_LIVE_MODELS;
  return availableProviders.flatMap((p) =>
    LLM_MODELS[p].map((m) => ({ ...m, id: `${p}:${m.id}` })),
  );
}

/**
 * The model an agent actually uses: its own pick when that is still on offer,
 * else the workspace's (so a changed engine never breaks an agent).
 */
export function resolveAgentModel(
  engine: VoiceEngine,
  workspace: { llmProvider: AiProvider; model: string },
  aiModel: string | null | undefined,
  availableProviders: readonly AiProvider[],
): { llmProvider: AiProvider; model: string } {
  if (!aiModel || !agentModelChoices(engine, availableProviders).some((m) => m.id === aiModel))
    return workspace;
  if (engine === 'REALTIME' || engine === 'GEMINI_LIVE')
    return { llmProvider: workspace.llmProvider, model: aiModel };
  const [provider, ...rest] = aiModel.split(':');
  return { llmProvider: provider as AiProvider, model: rest.join(':') };
}
