import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import {
  agentSchema,
  aiSettingsSchema,
  credentialProviderParamSchema,
  DEFAULT_LLM_MODEL,
  DEFAULT_VOICE,
  LLM_MODELS,
  REALTIME_SUMMARY_MODEL,
  requiredProviders,
  summaryModelForEngine,
  voicesForEngine,
  type VoiceEngine,
} from '@pv/shared';
import type { AiStatus } from '../src/services/ai-settings';

// No database here: the AI status and the phone-number count are stubbed.
const mocks = vi.hoisted(() => ({ getAiStatus: vi.fn(), phoneNumbers: vi.fn() }));
vi.mock('../src/services/ai-settings', () => ({ getAiStatus: mocks.getAiStatus }));
vi.mock('../src/lib/prisma', () => ({
  prisma: { phoneNumber: { count: mocks.phoneNumbers } },
}));

import { agentReadiness } from '../src/services/agent-readiness';
import { aiRouter } from '../src/modules/workspace/ai';

/** Words that would tell a subscriber which vendor or model powers their agents. */
const VENDOR_WORDS = [
  'openai',
  'anthropic',
  'claude',
  'gemini',
  'deepgram',
  'gpt',
  'realtime',
  'elevenlabs',
];

function status(voiceEngine: VoiceEngine, ready: boolean): AiStatus {
  return {
    settings: {
      voiceEngine,
      llmProvider: 'ANTHROPIC',
      model: DEFAULT_LLM_MODEL.ANTHROPIC,
      source: 'workspace',
    },
    keys: requiredProviders(voiceEngine, 'ANTHROPIC').map((provider) => ({
      provider,
      source: ready ? 'platform' : null,
    })),
    ready,
  };
}

beforeEach(() => {
  mocks.getAiStatus.mockReset();
  mocks.phoneNumbers.mockReset().mockResolvedValue(1);
});

describe('AI settings schema', () => {
  it('defaults the LLM vendor and accepts model ids staff type themselves', () => {
    const parsed = aiSettingsSchema.parse({ voiceEngine: 'GEMINI_LIVE', model: 'gemini-3.8-live' });
    expect(parsed.llmProvider).toBe('OPENAI');
    expect(
      aiSettingsSchema.safeParse({ voiceEngine: 'CASCADED', model: 'vendor/custom-model:v2' })
        .success,
    ).toBe(true);
  });

  it('rejects empty or malformed models and unknown engines', () => {
    expect(aiSettingsSchema.safeParse({ voiceEngine: 'CASCADED', model: '' }).success).toBe(false);
    expect(aiSettingsSchema.safeParse({ voiceEngine: 'CASCADED', model: 'a b' }).success).toBe(
      false,
    );
    expect(aiSettingsSchema.safeParse({ voiceEngine: 'WHISPER', model: 'gpt-4.1' }).success).toBe(
      false,
    );
  });

  it('reads a vendor from a URL case-insensitively and refuses unknown ones', () => {
    expect(credentialProviderParamSchema.parse('openai')).toBe('OPENAI');
    expect(credentialProviderParamSchema.parse(' Deepgram ')).toBe('DEEPGRAM');
    const bad = credentialProviderParamSchema.safeParse('nope');
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe('Unknown provider');
  });

  it('drops AI-layer fields a subscriber sends with an agent', () => {
    const agent = agentSchema.parse({
      name: 'Ava',
      voice: 'Puck',
      systemPrompt: 'You are Ava, a friendly consultant for a solar company.',
      voiceEngine: 'REALTIME',
      llmProvider: 'ANTHROPIC',
      llmModel: 'claude-opus-5-5',
    });
    expect(agent).not.toHaveProperty('voiceEngine');
    expect(agent).not.toHaveProperty('llmProvider');
    expect(agent).not.toHaveProperty('llmModel');
  });
});

describe('engines', () => {
  it('needs only a Gemini key for Gemini Live, no Deepgram', () => {
    expect(requiredProviders('GEMINI_LIVE', 'OPENAI')).toEqual(['GEMINI']);
    expect(requiredProviders('CASCADED', 'ANTHROPIC')).toEqual(['ANTHROPIC', 'DEEPGRAM']);
    expect(requiredProviders('ELEVENLABS', 'OPENAI')).toEqual(['OPENAI', 'ELEVENLABS']);
  });

  it('summarises speech-to-speech calls on a text model of the same vendor', () => {
    expect(summaryModelForEngine('REALTIME', 'ANTHROPIC', 'gpt-realtime')).toEqual({
      provider: 'OPENAI',
      model: REALTIME_SUMMARY_MODEL,
    });
    expect(LLM_MODELS.OPENAI.map((m) => m.id)).toContain(REALTIME_SUMMARY_MODEL);
    expect(summaryModelForEngine('GEMINI_LIVE', 'OPENAI', 'gemini-3.8-live')).toEqual({
      provider: 'GEMINI',
      model: DEFAULT_LLM_MODEL.GEMINI,
    });
    expect(summaryModelForEngine('CASCADED', 'ANTHROPIC', 'claude-haiku-5-5')).toEqual({
      provider: 'ANTHROPIC',
      model: 'claude-haiku-5-5',
    });
  });
});

describe('agent readiness', () => {
  const agent = {
    id: 'agent_1',
    appointmentBookingEnabled: false,
    calendarIntegrationId: null,
    transferEnabled: false,
    transferNumber: null,
  };

  it('blocks activation on one vendor-free AI item until staff finish the setup', async () => {
    mocks.getAiStatus.mockResolvedValue(status('CASCADED', false));
    const items = await agentReadiness('ws_1', agent);
    expect(items.map((i) => i.key)).toEqual(['ai', 'number']);
    expect(items[0]).toEqual({
      key: 'ai',
      label: 'AI voice set up by the Purple Voice team',
      ok: false,
      blocking: true,
    });
    const text = JSON.stringify(items).toLowerCase();
    for (const word of VENDOR_WORDS) expect(text).not.toContain(word);
  });

  it('passes the AI item once every key the engine needs is available', async () => {
    mocks.getAiStatus.mockResolvedValue(status('GEMINI_LIVE', true));
    const items = await agentReadiness('ws_1', { ...agent, transferEnabled: true });
    expect(items.find((i) => i.key === 'ai')?.ok).toBe(true);
    expect(items.find((i) => i.key === 'transfer')).toMatchObject({ ok: false, blocking: true });
  });
});

describe('GET /api/app/ai', () => {
  const app = express();
  app.use((req, _res, next) => {
    req.workspaceId = 'ws_1';
    next();
  });
  app.use('/ai', aiRouter);

  it.each(['REALTIME', 'GEMINI_LIVE', 'CASCADED', 'ELEVENLABS'] as const)(
    'shows a %s workspace its voices and readiness, nothing about vendors or keys',
    async (engine) => {
      mocks.getAiStatus.mockResolvedValue(status(engine, engine !== 'CASCADED'));
      const res = await request(app).get('/ai').expect(200);
      expect(Object.keys(res.body).sort()).toEqual(['defaultVoice', 'ready', 'voices']);
      expect(res.body.voices).toEqual(voicesForEngine(engine));
      expect(res.body.defaultVoice).toBe(DEFAULT_VOICE[engine]);
      expect(res.body.ready).toBe(engine !== 'CASCADED');
      const text = JSON.stringify(res.body).toLowerCase();
      for (const word of VENDOR_WORDS) expect(text).not.toContain(word);
      expect(mocks.getAiStatus).toHaveBeenCalledWith('ws_1');
    },
  );
});
