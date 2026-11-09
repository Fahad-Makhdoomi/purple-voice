import { describe, expect, it } from 'vitest';
import { agentModelChoices, resolveAgentModel } from '@pv/shared';

const ws = { llmProvider: 'GEMINI' as const, model: 'gemini-2.5-flash' };

describe('per-agent AI model', () => {
  it('offers only vendors the platform has a key for', () => {
    const ids = agentModelChoices('CASCADED', ['ANTHROPIC']).map((m) => m.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.startsWith('ANTHROPIC:'))).toBe(true);
  });

  it('offers the engine own models for speech-to-speech', () => {
    expect(agentModelChoices('GEMINI_LIVE', []).map((m) => m.id)).toContain('gemini-3.8-live');
    expect(agentModelChoices('REALTIME', []).map((m) => m.id)).toContain('gpt-realtime-mini');
  });

  it('applies a valid pick and ignores anything else', () => {
    expect(resolveAgentModel('CASCADED', ws, 'ANTHROPIC:claude-haiku-5-5', ['ANTHROPIC'])).toEqual({
      llmProvider: 'ANTHROPIC',
      model: 'claude-haiku-5-5',
    });
    // Vendor without a platform key, unknown id, or no pick: workspace default.
    expect(resolveAgentModel('CASCADED', ws, 'OPENAI:gpt-4.1', ['ANTHROPIC'])).toBe(ws);
    expect(resolveAgentModel('CASCADED', ws, 'ANTHROPIC:made-up', ['ANTHROPIC'])).toBe(ws);
    expect(resolveAgentModel('CASCADED', ws, null, ['ANTHROPIC'])).toBe(ws);
    expect(resolveAgentModel('GEMINI_LIVE', ws, 'gpt-realtime', [])).toBe(ws);
  });

  it('switches the realtime model without changing vendor', () => {
    expect(resolveAgentModel('REALTIME', ws, 'gpt-realtime-mini', [])).toEqual({
      llmProvider: 'GEMINI',
      model: 'gpt-realtime-mini',
    });
  });
});
