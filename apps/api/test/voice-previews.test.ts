import { describe, expect, it } from 'vitest';
import {
  CASCADED_VOICES,
  ELEVENLABS_VOICES,
  GEMINI_LIVE_VOICES,
  REALTIME_VOICES,
  SARVAM_V2_VOICES,
  SARVAM_VOICES,
  DEFAULT_VOICE,
  voicesForEngine,
  VOICE_ENGINES,
} from '@pv/shared';
import { pcmToWav, previewLanguage } from '../src/services/voice-previews';

describe('voice catalogue', () => {
  const all = [
    REALTIME_VOICES,
    GEMINI_LIVE_VOICES,
    ELEVENLABS_VOICES,
    SARVAM_VOICES,
    SARVAM_V2_VOICES,
    CASCADED_VOICES,
  ];

  it('describes every voice for the filters, with unique ids', () => {
    for (const list of all) {
      expect(new Set(list.map((v) => v.id)).size).toBe(list.length);
      for (const v of list) {
        expect(v.gender, v.id).toMatch(/^(female|male|neutral)$/);
        expect(v.styles?.length, v.id).toBeGreaterThan(0);
      }
    }
  });

  it('lists every Deepgram Aura-2 voice and keeps each engine default', () => {
    expect(CASCADED_VOICES.length).toBe(51);
    for (const engine of VOICE_ENGINES) {
      if (engine === 'SARVAM') continue;
      expect(voicesForEngine(engine).some((v) => v.id === DEFAULT_VOICE[engine])).toBe(true);
    }
  });
});

describe('voice previews', () => {
  it('speaks a single-language voice in its own language', () => {
    const hindi = SARVAM_VOICES.find((v) => v.id === 'ritu_hi_sales');
    expect(previewLanguage(hindi, 'en-US')).toBe('hi');
    const spanish = CASCADED_VOICES.find((v) => v.id.endsWith('-es'));
    expect(previewLanguage(spanish, 'en-US')).toBe('es');
  });

  it('speaks a multilingual voice in the agent language, else English', () => {
    expect(previewLanguage(REALTIME_VOICES[0], 'fr')).toBe('fr');
    expect(previewLanguage(REALTIME_VOICES[0], 'en-GB')).toBe('en');
    expect(previewLanguage(REALTIME_VOICES[0], 'sw')).toBe('en');
  });

  it('wraps PCM in a valid WAV header', () => {
    const wav = pcmToWav(Buffer.alloc(480), 24_000);
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav.subarray(8, 12).toString()).toBe('WAVE');
    expect(wav.readUInt32LE(24)).toBe(24_000);
    expect(wav.readUInt32LE(40)).toBe(480);
    expect(wav.length).toBe(44 + 480);
  });
});
