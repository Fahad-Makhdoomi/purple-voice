import { describe, expect, it, vi } from 'vitest';
import type { SttEvents } from '../src/voice/engines/deepgram';
import { CascadedEngine, isBackchannel, soundKey, words } from '../src/voice/engines/cascaded';

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

function engine(greeting = 'Hi, this is Ava from Sunrise Solar. Do you have a minute?') {
  h.turns = [];
  const interrupts: number[] = [];
  const e = new CascadedEngine(
    {
      apiKey: 'k',
      model: 'gpt-4.1',
      voice: 'v',
      language: 'en-US',
      instructions: '',
      greeting,
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

describe('cascaded engine turn-taking', () => {
  it('answers a short reply right after the agent spoke, even with its own words', async () => {
    const { e } = engine();
    await e.start();
    await tick();
    // The greeting (2 s of audio) asked "Do you have a minute?"; the caller says "a minute, yes".
    await new Promise((r) => setTimeout(r, 2100));
    h.stt!.events.onTranscript('a minute', true);
    h.stt!.events.onUtteranceEnd();
    await tick();
    expect(h.turns).toEqual(['a minute']);
    e.close();
  });
});

describe('cascaded engine listening noises', () => {
  it('lets the agent finish over "haan ji" or a stray word, and never answers them', async () => {
    const { e, interrupts } = engine();
    await e.start();
    await tick();
    for (const heard of ['haan ji', 'हाँ जी', 'achha theek hai', 'okay', 'hello']) {
      h.stt!.events.onTranscript(heard, true);
      h.stt!.events.onUtteranceEnd();
    }
    await tick();
    expect(interrupts).toHaveLength(0);
    expect(h.turns).toHaveLength(0);
    e.close();
  });

  it('still answers "haan ji" once the agent has finished', async () => {
    const { e } = engine();
    await e.start();
    await new Promise((r) => setTimeout(r, 2100));
    h.stt!.events.onTranscript('haan ji', true);
    h.stt!.events.onUtteranceEnd();
    await tick();
    expect(h.turns).toEqual(['haan ji']);
    e.close();
  });

  it('knows a listening noise from a reply', () => {
    expect(isBackchannel('Haan ji, boliye.')).toBe(true);
    expect(isBackchannel('ठीक है')).toBe(true);
    expect(isBackchannel('haan, kitne ka hai?')).toBe(false);
    expect(isBackchannel('')).toBe(false);
  });
});

describe('cascaded engine echo across scripts', () => {
  it('hears a word the same in Latin and Devanagari', () => {
    for (const [latin, devanagari] of [
      ['bahut', 'बहुत'],
      ['badhiya', 'बढ़िया'],
      ['kashmir', 'कश्मीर'],
      ['booking', 'बुकिंग'],
      ['travels', 'ट्रैवल्स'],
      ['namaste', 'नमस्ते'],
    ]) {
      expect(soundKey(latin!)).toBe(soundKey(devanagari!));
    }
    // Short words would all sound alike, so they only match themselves.
    expect(soundKey('haan')).not.toBe(soundKey('hain'));
    expect(soundKey('nahi')).not.toBe(soundKey('booking'));
  });

  it('ignores its Hinglish greeting echoed back in Devanagari', async () => {
    const { e, interrupts } = engine(
      'Namaste, main Ava bol rahi hoon, aapka Kashmir trip kaisa raha?',
    );
    await e.start();
    await tick();
    h.stt!.events.onTranscript('नमस्ते मैं आवा बोल रही हूं आपका कश्मीर ट्रिप कैसा रहा', true);
    h.stt!.events.onUtteranceEnd();
    await tick();
    expect(interrupts).toHaveLength(0);
    expect(h.turns).toHaveLength(0);
    e.close();
  });
});
