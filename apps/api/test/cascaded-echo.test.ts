import { describe, expect, it, vi } from 'vitest';
import type { SttEvents } from '../src/voice/engines/deepgram';
import { CascadedEngine, words } from '../src/voice/engines/cascaded';

// vi.mock calls below are hoisted above these imports.
const h = vi.hoisted(() => ({
  stt: null as null | { events: SttEvents },
  turns: [] as string[],
  reply: 'Sure, we have slots on Tuesday and Thursday afternoon.',
}));

vi.mock('../src/voice/engines/elevenlabs-speech', () => ({
  ElevenLabsStt: class {
    constructor(_k: string, _l: string, events: SttEvents) {
      h.stt = { events };
    }
    async connect() {}
    push() {}
    close() {}
  },
  // 2 s of audio per sentence, delivered at once.
  elevenLabsSpeak: async (_k: string, _v: string, _t: string, onChunk: (c: string) => void) => {
    onChunk(Buffer.alloc(16_000, 0x7f).toString('base64'));
  },
}));

vi.mock('../src/voice/llm/openai', () => ({
  OpenAIConversation: class {
    async turn(text: string, handlers: { onText(d: string): void }) {
      h.turns.push(text);
      handlers.onText(h.reply);
    }
    noteInterrupted() {}
  },
}));

function engine() {
  h.turns = [];
  const interrupts: number[] = [];
  const e = new CascadedEngine(
    {
      apiKey: 'k',
      model: 'gpt-4.1',
      voice: 'v',
      language: 'en-US',
      instructions: '',
      greeting: 'Hi, this is Ava from Sunrise Solar. Do you have a minute?',
      tools: [],
      provider: 'OPENAI',
      speechApiKey: 'xi',
      speech: 'ELEVENLABS',
    },
    {
      onAudio() {},
      onInterrupt: () => interrupts.push(Date.now()),
      onTranscript() {},
      onToolCall: async () => '',
      onError() {},
    },
  );
  return { e, interrupts };
}

const tick = () => new Promise((r) => setTimeout(r, 20));

describe('cascaded engine echo suppression', () => {
  it('normalises words across punctuation and case', () => {
    expect(words('Hi, THIS is Ava!')).toEqual(['hi', 'this', 'is', 'ava']);
  });

  it('ignores its own greeting echoed back by the line', async () => {
    const { e, interrupts } = engine();
    await e.start();
    await tick();
    h.stt!.events.onTranscript('this is Ava from Sunrise Solar', false);
    h.stt!.events.onTranscript('Hi this is Ava from Sunrise Solar', true);
    h.stt!.events.onUtteranceEnd();
    await tick();
    expect(interrupts).toHaveLength(0);
    expect(h.turns).toHaveLength(0);
    e.close();
  });

  it('still lets the caller interrupt and answers them', async () => {
    const { e, interrupts } = engine();
    await e.start();
    await tick();
    h.stt!.events.onTranscript('sorry who is calling', false);
    h.stt!.events.onTranscript('sorry who is calling', true);
    h.stt!.events.onUtteranceEnd();
    await tick();
    expect(interrupts.length).toBeGreaterThan(0);
    expect(h.turns).toEqual(['sorry who is calling']);
    e.close();
  });
});
