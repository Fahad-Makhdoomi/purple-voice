import { describe, expect, it } from 'vitest';
import { SpeechFilter } from '../src/voice/speakable';

const PROMPT = `You are Ava, a friendly sales assistant for Sunrise Solar.
Say: Hi, this is Ava from Sunrise Solar, do you have a quick minute to talk about your power bill?
## Your general goal
Book a free home solar assessment with the homeowner.
- Never use lists, markdown, emojis, URLs or symbols; spell out numbers the way people say them.
- If the caller asks about pricing, tell them installs start at four thousand dollars.`;

const f = new SpeechFilter(PROMPT);

describe('SpeechFilter', () => {
  it('keeps normal speech, including scripted lines from the prompt', () => {
    expect(f.clean('Great, does Tuesday at ten work for you?')).toBe(
      'Great, does Tuesday at ten work for you?',
    );
    expect(
      f.clean(
        'Hi, this is Ava from Sunrise Solar, do you have a quick minute to talk about your power bill?',
      ),
    ).toContain('Hi, this is Ava');
    expect(f.clean('Installs start at four thousand dollars.')).toBe(
      'Installs start at four thousand dollars.',
    );
  });

  it('strips markdown, speaker labels and stage directions', () => {
    expect(f.clean('**Agent:** Hello there! (pause) How are you?')).toBe(
      'Hello there! How are you?',
    );
    expect(f.clean('- *Sure*, I can help.')).toBe('Sure, I can help.');
    expect(f.clean('## Your general goal\nHappy to help.')).toBe('Happy to help.');
    expect(f.clean('[waits for reply]')).toBeNull();
  });

  it('drops the instructions being read out', () => {
    expect(f.clean('You are Ava, a friendly sales assistant for Sunrise Solar.')).toBeNull();
    expect(
      f.clean(
        'Never use lists, markdown, emojis, URLs or symbols; spell out numbers the way people say them.',
      ),
    ).toBeNull();
    expect(
      f.clean(
        'If the caller asks about pricing, tell them installs start at four thousand dollars.',
      ),
    ).toBeNull();
    expect(f.clean('Your goal is to book a free home solar assessment.')).toBeNull();
    expect(f.clean("Here's how I would say it: hi there.")).toBeNull();
  });
});

describe('placeholders', () => {
  it('never says an unfilled placeholder', () => {
    expect(f.clean('Hello {name}, ek second ap se baat ho sakti hai?')).toBe(
      'Hello, ek second ap se baat ho sakti hai?',
    );
    expect(f.clean('Hi {{first_name}}!')).toBe('Hi!');
  });
});
