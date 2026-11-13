import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  isElevenLabsVoiceId,
  isoLanguage,
  voicesForEngine,
  type VoiceEngine,
  type VoiceOption,
} from '@pv/shared';
import type { CredentialProvider } from '@prisma/client';
import { env } from '../config/env';
import { HttpError } from '../lib/http-error';
import { logger } from '../lib/logger';
import { findApiKey } from './ai-keys';
import { engineSettings } from './ai-settings';
import { elevenLabsPreviewUrl, tryListElevenLabsVoices } from './elevenlabs-voices';
import { sarvamModelForVoice } from '../voice/engines/sarvam-speech';

/**
 * Short audio samples so subscribers can hear a voice before they pick it.
 * Spoken by the workspace's own voice engine on our keys (ElevenLabs: the
 * voice's ready-made preview when it has one), then kept on disk, so each
 * voice costs one tiny synthesis however often it is played.
 */

/** What each engine needs a key for. */
const ENGINE_KEY: Record<VoiceEngine, CredentialProvider> = {
  REALTIME: 'OPENAI',
  GEMINI_LIVE: 'GEMINI',
  CASCADED: 'DEEPGRAM',
  ELEVENLABS: 'ELEVENLABS',
  SARVAM: 'SARVAM',
};

/** One short sales-call line per language; anything else is previewed in English. */
const SAMPLES: Record<string, string> = {
  en: 'Hi, thanks for taking my call. I’m your assistant from Purple Voice, and I can help you book an appointment. Would tomorrow morning work for you?',
  es: 'Hola, gracias por atender mi llamada. Soy su asistente de Purple Voice y puedo ayudarle a reservar una cita. ¿Le viene bien mañana por la mañana?',
  fr: 'Bonjour, merci de prendre mon appel. Je suis votre assistant Purple Voice et je peux vous aider à prendre rendez-vous. Demain matin, cela vous conviendrait-il ?',
  de: 'Hallo, danke, dass Sie meinen Anruf annehmen. Ich bin Ihr Assistent von Purple Voice und helfe Ihnen gern, einen Termin zu vereinbaren. Passt Ihnen morgen Vormittag?',
  pt: 'Olá, obrigado por atender. Sou o assistente da Purple Voice e posso ajudar a marcar um horário. Amanhã de manhã seria bom para você?',
  it: 'Buongiorno, grazie per aver risposto. Sono l’assistente di Purple Voice e posso aiutarla a fissare un appuntamento. Domani mattina le andrebbe bene?',
  nl: 'Hallo, bedankt dat u opneemt. Ik ben de assistent van Purple Voice en ik help u graag een afspraak te maken. Past morgenochtend u?',
  hi: 'नमस्ते! Purple Voice में आपका स्वागत है। क्या कल सुबह आपसे बात करने का सही समय होगा?',
  hinglish: 'Hi! Purple Voice में आपका स्वागत है। क्या कल morning में बात करने का सही time होगा?',
  bn: 'নমস্কার! Purple Voice-এ আপনাকে স্বাগত। আগামীকাল সকালে কথা বলার জন্য কি ভালো সময় হবে?',
  gu: 'નમસ્તે! Purple Voice માં આપનું સ્વાગત છે. શું આવતીકાલે સવારે વાત કરવાનો સારો સમય રહેશે?',
  kn: 'ನಮಸ್ಕಾರ! Purple Voice ಗೆ ಸ್ವಾಗತ. ನಾಳೆ ಬೆಳಿಗ್ಗೆ ಮಾತನಾಡಲು ಒಳ್ಳೆಯ ಸಮಯವೇ?',
  mr: 'नमस्कार! Purple Voice मध्ये आपले स्वागत आहे. उद्या सकाळी बोलायला चांगली वेळ आहे का?',
  pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! Purple Voice ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਕੀ ਕੱਲ੍ਹ ਸਵੇਰੇ ਗੱਲ ਕਰਨ ਲਈ ਚੰਗਾ ਸਮਾਂ ਹੋਵੇਗਾ?',
  te: 'నమస్కారం! Purple Voice కి స్వాగతం. రేపు ఉదయం మాట్లాడటానికి మంచి సమయమేనా?',
  ta: 'வணக்கம்! Purple Voice-க்கு வரவேற்கிறோம். நாளை காலை பேச உங்களுக்கு வசதியாக இருக்குமா?',
  ml: 'നമസ്കാരം! Purple Voice-ലേക്ക് സ്വാഗതം. നാളെ രാവിലെ സംസാരിക്കാൻ സൗകര്യമാണോ?',
};

/** Language names on voices (VoiceOption.language) → sample keys. */
const LANGUAGE_NAMES: Record<string, string> = {
  English: 'en',
  Spanish: 'es',
  Hindi: 'hi',
  Hinglish: 'hinglish',
  Bengali: 'bn',
  Gujarati: 'gu',
  Kannada: 'kn',
  Marathi: 'mr',
  Punjabi: 'pa',
  Telugu: 'te',
  Tamil: 'ta',
  Malayalam: 'ml',
};

/** A voice tied to one language speaks it; any other voice speaks the agent's language. */
export function previewLanguage(voice: VoiceOption | undefined, agentLanguage?: string): string {
  const own = voice?.language ? LANGUAGE_NAMES[voice.language] : undefined;
  if (own) return own;
  const lang = agentLanguage ? isoLanguage(agentLanguage) : 'en';
  return SAMPLES[lang] ? lang : 'en';
}

/** BCP-47 code for the sample language (Sarvam wants the -IN forms). */
function sarvamCode(lang: string): string {
  if (lang === 'en') return 'en-IN';
  if (lang === 'hinglish') return 'hi-IN';
  return `${lang}-IN`;
}

export interface VoicePreview {
  audio: Buffer;
  contentType: string;
}

const DIR = path.resolve(process.cwd(), env.RECORDINGS_LOCAL_PATH, '..', 'voice-previews');
const inflight = new Map<string, Promise<VoicePreview>>();

const EXT: Record<string, string> = { 'audio/mpeg': 'mp3', 'audio/wav': 'wav' };

async function fromDisk(key: string): Promise<VoicePreview | null> {
  for (const [contentType, ext] of Object.entries(EXT)) {
    try {
      return { audio: await readFile(path.join(DIR, `${key}.${ext}`)), contentType };
    } catch {
      /* not cached in this format */
    }
  }
  return null;
}

async function toDisk(key: string, p: VoicePreview): Promise<void> {
  try {
    await mkdir(DIR, { recursive: true });
    const file = path.join(DIR, `${key}.${EXT[p.contentType] ?? 'bin'}`);
    await writeFile(`${file}.tmp`, p.audio);
    await rename(`${file}.tmp`, file);
  } catch (err) {
    logger.warn({ err }, 'Could not cache a voice preview');
  }
}

/** 16-bit mono PCM → a playable WAV file. */
export function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

const TIMEOUT = 20_000;

async function audioFrom(res: Response, vendor: string): Promise<Buffer> {
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`${vendor} preview failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function openAiSpeak(key: string, voice: string, text: string): Promise<VoicePreview> {
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'gpt-4o-mini-tts', voice, input: text, response_format: 'mp3' }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  return { audio: await audioFrom(res, 'OpenAI'), contentType: 'audio/mpeg' };
}

/** Gemini's speech models speak the same 30 prebuilt voices as Gemini Live. */
const GEMINI_TTS_MODELS = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-flash-tts'];

async function geminiSpeak(key: string, voice: string, text: string): Promise<VoicePreview> {
  let lastError: unknown;
  for (const model of GEMINI_TTS_MODELS) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT * 2),
      },
    );
    if (res.status === 404) {
      lastError = new Error(`Gemini model ${model} not found`);
      continue;
    }
    if (!res.ok) throw new Error(`Gemini preview failed: ${res.status}`);
    const body = (await res.json()) as {
      candidates?: {
        content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] };
      }[];
    };
    const part = body.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) throw new Error('Gemini preview returned no audio');
    const rate = Number(/rate=(\d+)/.exec(part.inlineData.mimeType ?? '')?.[1]) || 24_000;
    return {
      audio: pcmToWav(Buffer.from(part.inlineData.data, 'base64'), rate),
      contentType: 'audio/wav',
    };
  }
  throw lastError;
}

async function deepgramSpeak(key: string, voice: string, text: string): Promise<VoicePreview> {
  const res = await fetch(
    `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voice)}&encoding=mp3`,
    {
      method: 'POST',
      headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(TIMEOUT),
    },
  );
  return { audio: await audioFrom(res, 'Deepgram'), contentType: 'audio/mpeg' };
}

async function elevenLabsSpeak(
  key: string,
  voice: string,
  text: string,
  model: string,
): Promise<VoicePreview> {
  // The voice's own sample, when ElevenLabs has one: free, and how its creator meant it to sound.
  const ready = await elevenLabsPreviewUrl(key, voice);
  if (ready) {
    const res = await fetch(ready, { signal: AbortSignal.timeout(TIMEOUT) });
    if (res.ok) {
      const type = res.headers.get('content-type') ?? 'audio/mpeg';
      return {
        audio: Buffer.from(await res.arrayBuffer()),
        contentType: type.includes('wav') ? 'audio/wav' : 'audio/mpeg',
      };
    }
  }
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: model || 'eleven_flash_v2_5' }),
      signal: AbortSignal.timeout(TIMEOUT),
    },
  );
  return { audio: await audioFrom(res, 'ElevenLabs'), contentType: 'audio/mpeg' };
}

async function sarvamSpeakPreview(
  key: string,
  voice: string,
  text: string,
  lang: string,
  speechModel: string,
): Promise<VoicePreview> {
  const model = speechModel === 'bulbul:v2' ? 'bulbul:v2' : sarvamModelForVoice(voice);
  const res = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: { 'api-subscription-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      language_code: sarvamCode(lang),
      speaker: voice,
      model,
      speech_sample_rate: 22050,
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Sarvam preview failed: ${res.status}`);
  const body = (await res.json()) as { audios?: string[] };
  const audio = body.audios?.[0];
  if (!audio) throw new Error('Sarvam preview returned no audio');
  return { audio: Buffer.from(audio, 'base64'), contentType: 'audio/wav' };
}

/**
 * The preview of `voice` for a workspace, in the voice's own language or the
 * agent's (`agentLanguage`). 404 for a voice the workspace can't use; 409
 * while the AI voice isn't set up; 502 when the vendor fails.
 */
export async function voicePreview(
  workspaceId: string,
  voice: string,
  agentLanguage?: string,
  agentEngine?: VoiceEngine,
): Promise<VoicePreview> {
  const settings = await engineSettings(workspaceId, agentEngine);
  const engine = settings.voiceEngine;
  const key = await findApiKey(workspaceId, ENGINE_KEY[engine]);

  let offered: VoiceOption[] = voicesForEngine(engine, settings.speechModel);
  if (engine === 'ELEVENLABS' && key) offered = (await tryListElevenLabsVoices(key)) ?? offered;
  const option = offered.find((v) => v.id === voice);
  if (!option && !(engine === 'ELEVENLABS' && isElevenLabsVoiceId(voice))) {
    throw new HttpError(404, 'That voice isn’t available', 'not_found');
  }
  if (!key) {
    throw new HttpError(
      409,
      'Voice previews will work once our team finishes setting up your AI voice.',
      'ai_not_ready',
    );
  }

  const lang = previewLanguage(option, agentLanguage);
  const text = SAMPLES[lang]!;
  const cacheKey = createHash('sha256')
    .update([engine, settings.speechModel, voice, text].join('\n'))
    .digest('hex')
    .slice(0, 40);

  const cached = await fromDisk(cacheKey);
  if (cached) return cached;
  const pending = inflight.get(cacheKey);
  if (pending) return pending;

  const work = (async () => {
    try {
      let p: VoicePreview;
      switch (engine) {
        case 'REALTIME':
          p = await openAiSpeak(key, voice, text);
          break;
        case 'GEMINI_LIVE':
          p = await geminiSpeak(key, voice, text);
          break;
        case 'CASCADED':
          p = await deepgramSpeak(key, voice, text);
          break;
        case 'ELEVENLABS':
          p = await elevenLabsSpeak(key, voice, text, settings.speechModel);
          break;
        case 'SARVAM':
          p = await sarvamSpeakPreview(key, voice, text, lang, settings.speechModel);
          break;
      }
      if (!p.audio.length) throw new Error('Empty voice preview');
      await toDisk(cacheKey, p);
      return p;
    } catch (err) {
      logger.warn({ err, engine, voice }, 'Voice preview failed');
      throw new HttpError(
        502,
        'This voice’s sample couldn’t be played right now. Try again in a moment.',
        'preview_failed',
      );
    } finally {
      inflight.delete(cacheKey);
    }
  })();
  inflight.set(cacheKey, work);
  return work;
}
