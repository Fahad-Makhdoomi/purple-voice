import { describe, expect, it } from 'vitest';
import { agentEngineChoices, engineSettingsFor, type EngineSettings } from '@pv/shared';

/** The live platform default: Sarvam speech with Gemini thinking. */
const sarvam: EngineSettings = {
  voiceEngine: 'SARVAM',
  llmProvider: 'GEMINI',
  model: 'gemini-2.5-flash',
  speechModel: 'bulbul:v4-flash',
};

describe('per-agent voice engines', () => {
  it('offers every engine the keys allow, the workspace engine first', () => {
    expect(agentEngineChoices(sarvam, ['GEMINI', 'ELEVENLABS', 'SARVAM'])).toEqual([
      'SARVAM',
      'ELEVENLABS',
      'GEMINI_LIVE',
    ]);
    expect(
      agentEngineChoices(sarvam, ['GEMINI', 'ELEVENLABS', 'SARVAM', 'OPENAI', 'DEEPGRAM']),
    ).toEqual(['SARVAM', 'ELEVENLABS', 'REALTIME', 'GEMINI_LIVE', 'CASCADED']);
  });

  it('keeps the workspace LLM for a speech pipeline and uses the engine default model otherwise', () => {
    expect(engineSettingsFor(sarvam, 'ELEVENLABS', ['GEMINI', 'ELEVENLABS'])).toEqual({
      voiceEngine: 'ELEVENLABS',
      llmProvider: 'GEMINI',
      model: 'gemini-2.5-flash',
      speechModel: 'eleven_flash_v2_5',
    });
    expect(engineSettingsFor(sarvam, 'GEMINI_LIVE', ['GEMINI'])?.voiceEngine).toBe('GEMINI_LIVE');
    expect(engineSettingsFor(sarvam, null, [])).toBe(sarvam);
  });

  it('refuses an engine whose keys are missing', () => {
    expect(engineSettingsFor(sarvam, 'REALTIME', ['GEMINI'])).toBeNull();
    expect(engineSettingsFor(sarvam, 'CASCADED', ['GEMINI', 'SARVAM'])).toBeNull();
  });

  it('falls back to an LLM vendor with a key when the workspace one has none', () => {
    const realtime: EngineSettings = {
      voiceEngine: 'REALTIME',
      llmProvider: 'SARVAM',
      model: 'gpt-realtime',
      speechModel: '',
    };
    expect(engineSettingsFor(realtime, 'ELEVENLABS', ['OPENAI', 'ELEVENLABS'])).toMatchObject({
      llmProvider: 'OPENAI',
      model: 'gpt-4.1',
    });
  });
});
