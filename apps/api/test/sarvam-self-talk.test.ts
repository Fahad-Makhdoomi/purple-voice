import { describe, expect, it, vi } from 'vitest';
import type { SttEvents } from '../src/voice/engines/deepgram';
import { CascadedEngine, silenceLike } from '../src/voice/engines/cascaded';

const h = vi.hoisted(() => ({
  pushed: [] as string[],
  events: null as null | SttEvents,
}));

vi.mock('../src/voice/engines/sarvam-speech', () => ({
  SarvamStt: class {
    constructor(_k: string, _l: string, events: SttEvents) {
      h.events = events;
    }
    async connect() {}
    push(p: string) {
      h.pushed.push(p);
    }
    close() {}
  },
  // One second of audio per sentence, delivered at once.
  sarvamSpeak: async (_k: string, _v: string, _t: string, onChunk: (c: string) => void) => {
    onChunk(Buffer.alloc(8000, 0x7f).toString('base64'));
  },
}));

vi.mock('../src/voice/llm/openai', () => ({
  OpenAIConversation: class {
    async turn() {}
    noteInterrupted() {}
  },
}));

const LOUD = Buffer.alloc(160, 0x10).toString('base64');
const isSilence = (b64: string) => Buffer.from(b64, 'base64').every((b) => b === 0xff);
const tick = () => new Promise((r) => setTimeout(r, 20));

function engine() {
  h.pushed = [];
  return new CascadedEngine(
    {
      apiKey: 'k',
      model: 'sarvam-105b-conversations',
      voice: 'shubh',
      language: 'hi-IN',
      instructions: '',
      greeting: 'Namaste, main Purple Rocket se bol raha hoon.',
      tools: [],
      provider: 'SARVAM',
      speechApiKey: 'sk',
      speech: 'SARVAM',
    },
    {
      onAudio() {},
      onInterrupt() {},
      onTranscript() {},
      onToolCall: async () => '',
      onError() {},
    },
  );
}

describe('Sarvam calls do not hear the agent', () => {
  it('makes silence the same length as the frame it replaces', () => {
    const s = silenceLike(LOUD);
    expect(Buffer.from(s, 'base64')).toHaveLength(160);
    expect(isSilence(s)).toBe(true);
  });

  it('sends the recogniser silence while the agent speaks', async () => {
    const e = engine();
    await e.start();
    await tick();
    e.pushAudio(LOUD);
    expect(h.pushed).toHaveLength(1);
    expect(isSilence(h.pushed[0]!)).toBe(true);
    e.close();
  });

  it('sends the real line when the agent is quiet', async () => {
    const e = engine();
    // Nothing has been said yet: no greeting is queued until start().
    e.pushAudio(LOUD);
    expect(h.pushed[0]).toBe(LOUD);
    e.close();
  });
});
