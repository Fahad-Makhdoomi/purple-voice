import { createHash } from 'node:crypto';
import type { VoiceGender, VoiceOption } from '@pv/shared';
import { logger } from '../lib/logger';

/**
 * The voices on a workspace's ElevenLabs account: premade, cloned, designed
 * and anything added from the Voice Library. Listed with the workspace's own
 * key, cached briefly so opening the agent form stays quick.
 */

const CACHE_MS = 10 * 60_000;
const MAX_PAGES = 10;
const cache = new Map<
  string,
  { at: number; voices: VoiceOption[]; previews: Map<string, string> }
>();

interface ApiVoice {
  voice_id: string;
  name?: string;
  category?: string;
  labels?: Record<string, string>;
  verified_languages?: { language?: string; accent?: string }[];
  preview_url?: string | null;
}

/** ElevenLabs labels: gender "female"/"male"/"neutral", accent "american", "british"… */
function gender(l: Record<string, string>): VoiceGender | undefined {
  const g = l.gender?.toLowerCase();
  return g === 'female' || g === 'male' ? g : g ? 'neutral' : undefined;
}

const titleCase = (s: string) =>
  s
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');

/** The voice's tone and use as filterable tags ("warm", "conversational"…). */
function styles(l: Record<string, string>): string[] {
  return [
    ...new Set(
      [l.descriptive ?? l.descriptions ?? l.description, l.use_case, l.age]
        .filter((x): x is string => !!x)
        .flatMap((x) => x.split(/[,_]/))
        .map((x) => x.trim().toLowerCase().replace(/\s+/g, ' '))
        .filter(Boolean),
    ),
  ];
}

function toOption(v: ApiVoice): VoiceOption {
  const l = v.labels ?? {};
  const languages = (v.verified_languages ?? [])
    .map((x) => x.language)
    .filter((x): x is string => !!x);
  return {
    id: v.voice_id,
    label: v.name || v.voice_id,
    hint: describeVoice(v),
    gender: gender(l),
    accent: l.accent ? titleCase(l.accent) : undefined,
    // One language: the voice speaks it. Several (or none listed): multilingual.
    language: new Set(languages).size === 1 ? LANGUAGE_NAMES[languages[0]!] : undefined,
    styles: styles(l),
    custom: v.category === 'cloned' || v.category === 'professional' || v.category === 'generated',
  };
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  hi: 'Hindi',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  it: 'Italian',
};

function describeVoice(v: ApiVoice): string | undefined {
  const l = v.labels ?? {};
  const languages = (v.verified_languages ?? [])
    .map((x) => x.language)
    .filter((x): x is string => !!x);
  const parts = [
    languages.length > 1 ? `${languages.length} languages` : (languages[0] ?? l.language),
    l.accent,
    l.gender,
    l.descriptive ?? l.descriptions ?? l.use_case,
    v.category === 'cloned' || v.category === 'professional' ? 'custom' : undefined,
  ].filter((x): x is string => !!x);
  return parts.length ? [...new Set(parts)].join(' · ') : undefined;
}

export async function listElevenLabsVoices(
  apiKey: string,
  baseUrl = 'https://api.elevenlabs.io',
): Promise<VoiceOption[]> {
  const cacheKey = createHash('sha256').update(apiKey).digest('hex');
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.voices;

  const voices: VoiceOption[] = [];
  const previews = new Map<string, string>();
  let token: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL('/v2/voices', baseUrl);
    url.searchParams.set('page_size', '100');
    if (token) url.searchParams.set('next_page_token', token);
    const res = await fetch(url, {
      headers: { 'xi-api-key': apiKey },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`ElevenLabs voices failed: ${res.status}`);
    const body = (await res.json()) as {
      voices?: ApiVoice[];
      has_more?: boolean;
      next_page_token?: string | null;
    };
    for (const v of body.voices ?? []) {
      voices.push(toOption(v));
      if (v.preview_url?.startsWith('https://')) previews.set(v.voice_id, v.preview_url);
    }
    if (!body.has_more || !body.next_page_token) break;
    token = body.next_page_token;
  }
  voices.sort((a, b) => a.label.localeCompare(b.label));
  cache.set(cacheKey, { at: Date.now(), voices, previews });
  return voices;
}

/** The ready-made sample ElevenLabs keeps for a voice on the account, if it has one. */
export async function elevenLabsPreviewUrl(
  apiKey: string,
  voiceId: string,
): Promise<string | null> {
  await tryListElevenLabsVoices(apiKey);
  const hit = cache.get(createHash('sha256').update(apiKey).digest('hex'));
  return hit?.previews.get(voiceId) ?? null;
}

/** Like `listElevenLabsVoices`, but a failure (bad key, outage) returns null instead of throwing. */
export async function tryListElevenLabsVoices(apiKey: string): Promise<VoiceOption[] | null> {
  try {
    const voices = await listElevenLabsVoices(apiKey);
    return voices.length ? voices : null;
  } catch (err) {
    logger.warn({ err }, 'Could not list ElevenLabs voices');
    return null;
  }
}
