import { describe, expect, it } from 'vitest';
import type { Agent } from '@prisma/client';
import { mulawDecode, mulawEncode } from '../src/voice/audio';
import { GATE_SETTINGS, NoiseGate, createNoiseGate, rms } from '../src/voice/noise-gate';
import { buildInstructions, OPENINGS } from '../src/voice/prompt';
import { secondsUntilNextCall } from '../src/jobs/dialer';

/** One 20 ms carrier frame of a 300 Hz tone at the given amplitude, as base64 μ-law. */
function frame(amplitude: number, phase = 0): string {
  const samples = new Int16Array(160);
  for (let i = 0; i < 160; i++)
    samples[i] = Math.round(amplitude * Math.sin((2 * Math.PI * 300 * (i + phase)) / 8000));
  return mulawEncode(samples).toString('base64');
}

const level = (b64: string) => rms(mulawDecode(Buffer.from(b64, 'base64')));

/** Pushes frames through the gate and returns the RMS of each output frame. */
function run(gate: NoiseGate, input: string[], agentSpeaking = false): number[] {
  return input
    .map((f) => gate.push(f, agentSpeaking))
    .filter((o) => o !== null)
    .map(level);
}

describe('caller noise gate', () => {
  const settings = GATE_SETTINGS.STANDARD!;

  it('silences steady background noise', () => {
    const out = run(new NoiseGate(settings), Array(100).fill(frame(80)));
    expect(out.every((l) => l === 0)).toBe(true);
  });

  it('passes the caller, including the start of the word and short pauses', () => {
    const gate = new NoiseGate(settings);
    const input = [
      ...Array(50).fill(frame(80)), // 1 s of background
      ...Array(25).fill(frame(4000)), // 0.5 s of speech
      ...Array(5).fill(frame(80)), // 100 ms pause between words
      ...Array(25).fill(frame(4000)),
    ];
    const out = run(gate, input);
    // Output frame i is input frame i, released 40 ms later. The look-ahead
    // keeps the start of the word (and the frame just before it).
    expect(out.slice(50, 105).every((l) => l > 0)).toBe(true);
    expect(out.slice(0, 49).every((l) => l === 0)).toBe(true);
  });

  it('ignores a click shorter than the attack time', () => {
    const gate = new NoiseGate(settings);
    const out = run(gate, [
      ...Array(50).fill(frame(80)),
      frame(6000),
      ...Array(20).fill(frame(80)),
    ]);
    expect(out.every((l) => l === 0)).toBe(true);
  });

  it('ignores background voices well below the caller once it has heard the caller', () => {
    const gate = new NoiseGate(settings);
    run(gate, [
      ...Array(20).fill(frame(80)),
      ...Array(100).fill(frame(5000)),
      ...Array(40).fill(frame(80)),
    ]);
    // A voice across the room at about a tenth of the caller's level.
    const out = run(gate, Array(30).fill(frame(500)));
    expect(out.every((l) => l === 0)).toBe(true);
  });

  it('wants louder speech to interrupt while the agent is talking', () => {
    const quietish = Array(30).fill(frame(500)); // above the bar, below it ×1.8
    const listening = run(new NoiseGate(GATE_SETTINGS.STRONG!), [
      ...Array(50).fill(frame(100)),
      ...quietish,
    ]);
    const talking = run(
      new NoiseGate(GATE_SETTINGS.STRONG!),
      [...Array(50).fill(frame(100)), ...quietish],
      true,
    );
    expect(listening.some((l) => l > 0)).toBe(true);
    expect(talking.every((l) => l === 0)).toBe(true);
  });

  it('is off when the agent turns the filter off', () => {
    expect(createNoiseGate('OFF')).toBeNull();
    expect(createNoiseGate('STANDARD')).toBeInstanceOf(NoiseGate);
  });
});

describe('campaign pause between calls', () => {
  const now = new Date('2026-10-16T10:00:00Z');
  const ago = (s: number) => new Date(now.getTime() - s * 1000);

  it('waits the delay after the last call started', () => {
    expect(secondsUntilNextCall(20, { createdAt: ago(5), endedAt: null }, null, now)).toBe(15);
    expect(secondsUntilNextCall(20, { createdAt: ago(25), endedAt: null }, null, now)).toBe(0);
  });

  it('waits the delay after the last call ended', () => {
    expect(secondsUntilNextCall(30, { createdAt: ago(300), endedAt: ago(10) }, ago(10), now)).toBe(
      20,
    );
  });

  it('starts at once for a campaign that has not called yet', () => {
    expect(secondsUntilNextCall(20, null, null, now)).toBe(0);
  });
});

describe('incoming calls and call-backs', () => {
  const agent = {
    name: 'Ava',
    systemPrompt: 'You are Ava from Northwind Solar.',
    greeting: 'Hi {{first_name}}, this is Ava calling about your solar quote.',
    goal: 'Book a consultation.',
    knowledge: '',
    language: 'en-US',
    timezone: 'UTC',
    inboundGreeting: 'Northwind Solar customer care, this is Ava.',
    inboundInstructions: 'Act as customer care.',
    callbackGreeting: 'Hi {{first_name}}, thanks for calling back!',
    callbackInstructions: 'Pick up where the last call left off.',
  } as Agent;
  const base = { workspace: { name: 'Northwind' }, toolNames: [] };
  const contact = { name: 'Sam Lee', company: null, email: null, fields: null } as never;

  it('uses the outbound line and goal for calls the agent makes', () => {
    const r = buildInstructions({
      ...base,
      agent,
      contact,
      call: { direction: 'OUTBOUND', fromNumber: '+1500', toNumber: '+1600' },
    });
    expect(r.kind).toBe('outbound');
    expect(r.greeting).toBe('Hi Sam, this is Ava calling about your solar quote.');
    expect(r.instructions).toContain('## Goal of this call\nBook a consultation.');
    expect(r.instructions).toContain('voicemail');
  });

  it('answers inbound calls with the inbound line and instructions, never the pitch', () => {
    const r = buildInstructions({
      ...base,
      agent,
      contact: null,
      call: { direction: 'INBOUND', fromNumber: '+1600', toNumber: '+1500' },
    });
    expect(r.kind).toBe('inbound');
    expect(r.greeting).toBe('Northwind Solar customer care, this is Ava.');
    expect(r.instructions).toContain('Act as customer care.');
    expect(r.instructions).not.toContain('calling about your solar quote');
    expect(r.instructions).not.toContain('voicemail');
    expect(r.opening).toBe(OPENINGS.inbound);
  });

  it('knows a call-back: who, when and what happened last time', () => {
    const r = buildInstructions({
      ...base,
      agent,
      contact,
      call: { direction: 'INBOUND', fromNumber: '+1600', toNumber: '+1500' },
      previous: {
        at: new Date('2026-10-15T15:00:00Z'),
        summary: 'Asked for a quote by email.',
        campaignGoal: 'Solar quotes',
      },
    });
    expect(r.kind).toBe('callback');
    expect(r.greeting).toBe('Hi Sam, thanks for calling back!');
    expect(r.instructions).toContain('Pick up where the last call left off.');
    expect(r.instructions).toContain('Sam Lee is calling you back');
    expect(r.instructions).toContain('Asked for a quote by email.');
  });

  it('falls back to the inbound line for call-backs without their own', () => {
    const r = buildInstructions({
      ...base,
      agent: { ...agent, callbackGreeting: '', callbackInstructions: '' },
      contact: null,
      call: { direction: 'INBOUND', fromNumber: '+1600', toNumber: '+1500' },
      previous: { at: new Date(), summary: null, campaignGoal: null },
    });
    expect(r.greeting).toBe('Northwind Solar customer care, this is Ava.');
    expect(r.instructions).toContain('Act as customer care.');
  });
});
