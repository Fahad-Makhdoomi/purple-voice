import {
  Behavior,
  Modality,
  type FunctionDeclaration,
  type LiveCallbacks,
  type LiveConnectConfig,
  type LiveSendClientContentParameters,
  type LiveSendRealtimeInputParameters,
  type LiveSendToolResponseParameters,
  type LiveServerMessage,
  type Tool,
} from '@google/genai';
import { DEFAULT_VOICE, GEMINI_LIVE_MODELS } from '@pv/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mulawDecode, mulawEncode, pcm16ToBuffer } from '../src/voice/audio';
import {
  GeminiLiveEngine,
  type LiveConnect,
  type LiveSession,
} from '../src/voice/engines/gemini-live';
import type { EngineConfig } from '../src/voice/engines/types';
import { toolsForAgent } from '../src/voice/tools';

const MODEL = GEMINI_LIVE_MODELS[0].id;
const VOICE = DEFAULT_VOICE.GEMINI_LIVE;

class FakeSession implements LiveSession {
  audio: { data: string; mimeType: string }[] = [];
  content: LiveSendClientContentParameters[] = [];
  toolResponses: LiveSendToolResponseParameters[] = [];
  closed = false;
  sendRealtimeInput(params: LiveSendRealtimeInputParameters) {
    this.audio.push(params.audio as { data: string; mimeType: string });
  }
  sendClientContent(params: LiveSendClientContentParameters) {
    this.content.push(params);
  }
  sendToolResponse(params: LiveSendToolResponseParameters) {
    this.toolResponses.push(params);
  }
  close() {
    this.closed = true;
  }
}

interface FakeConnection {
  model: string;
  config: LiveConnectConfig;
  callbacks: LiveCallbacks;
  session: FakeSession;
}

function setup(overrides: Partial<EngineConfig> = {}) {
  const conns: FakeConnection[] = [];
  /** How the next connect attempts behave. */
  let mode: 'ok' | 'reject' | 'refuse' = 'ok';
  const connect: LiveConnect = ({ model, config, callbacks }) => {
    const session = new FakeSession();
    conns.push({ model, config, callbacks, session });
    if (mode === 'reject') return Promise.reject(new Error('unreachable'));
    if (mode === 'refuse') {
      // The server closes the socket before setup completes; connect never settles.
      callbacks.onclose?.({ code: 1008, reason: 'model not found' } as never);
      return new Promise(() => undefined);
    }
    return Promise.resolve(session);
  };
  const cb = {
    onAudio: vi.fn<(payload: string) => void>(),
    onInterrupt: vi.fn<() => void>(),
    onTranscript: vi.fn<(role: 'agent' | 'caller', text: string) => void>(),
    onToolCall: vi.fn(async (_name: string, _input: unknown) => 'ok'),
    onError: vi.fn<(err: unknown) => void>(),
    onFatal: vi.fn<(err: unknown) => void>(),
  };
  const engine = new GeminiLiveEngine(
    {
      apiKey: 'test-key',
      model: MODEL,
      voice: VOICE,
      language: 'en-US',
      instructions: 'You are Sam from Acme.',
      greeting: 'Hi, this is Sam from Acme.',
      tools: toolsForAgent({
        appointmentBookingEnabled: true,
        transferEnabled: true,
        transferNumber: '+14155550100',
      }),
      ...overrides,
    },
    cb,
    connect,
  );
  return {
    engine,
    conns,
    cb,
    setMode: (m: typeof mode) => (mode = m),
    /** Delivers a server message on connection `i`. */
    server: (i: number, msg: Record<string, unknown>) =>
      conns[i].callbacks.onmessage(msg as unknown as LiveServerMessage),
    /** The server drops connection `i`. */
    drop: (i: number) => conns[i].callbacks.onclose?.({ code: 1011, reason: 'internal' } as never),
  };
}

/** 20 ms of a 440 Hz tone as the carrier sends it: 160 bytes of μ-law, base64. */
function callerChunk(): string {
  const samples = new Int16Array(160);
  for (let i = 0; i < 160; i++)
    samples[i] = Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / 8000));
  return mulawEncode(samples).toString('base64');
}

/** `count` samples of a 24 kHz tone as Gemini sends it: PCM16LE, base64. */
function modelAudio(count: number, hz = 1000): string {
  const samples = new Int16Array(count);
  for (let i = 0; i < count; i++)
    samples[i] = Math.round(8000 * Math.sin((2 * Math.PI * hz * i) / 24_000));
  return pcm16ToBuffer(samples).toString('base64');
}

function audioMessage(data: string) {
  return {
    serverContent: {
      modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data } }] },
    },
  };
}

const tick = () => new Promise((r) => setImmediate(r));

afterEach(() => {
  vi.useRealTimers();
});

describe('Gemini Live engine', () => {
  it('connects audio-only with transcription, compression, resumption and blocking tools', async () => {
    const { engine, conns } = setup();
    await engine.start();
    expect(conns).toHaveLength(1);
    const { model, config } = conns[0];
    expect(model).toBe(MODEL);
    expect(config.responseModalities).toEqual([Modality.AUDIO]);
    expect(config.systemInstruction).toBe('You are Sam from Acme.');
    expect(config.speechConfig).toEqual({
      voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
    });
    expect(config.inputAudioTranscription).toEqual({});
    expect(config.outputAudioTranscription).toEqual({});
    expect(config.contextWindowCompression).toEqual({ slidingWindow: {} });
    expect(config.sessionResumption).toEqual({});
    // Settings some Live models reject are never sent.
    for (const key of ['thinkingConfig', 'enableAffectiveDialog', 'proactivity'])
      expect(config).not.toHaveProperty(key);

    const declarations = (config.tools as Tool[])[0].functionDeclarations as FunctionDeclaration[];
    expect(declarations.map((d) => d.name)).toEqual([
      'check_availability',
      'book_appointment',
      'transfer_call',
      'end_call',
    ]);
    for (const d of declarations) {
      expect(d.behavior).toBe(Behavior.BLOCKING);
      expect(d.parametersJsonSchema).toMatchObject({ type: 'object' });
    }
  });

  it('says the exact greeting once', async () => {
    const { engine, conns } = setup();
    await engine.start();
    expect(conns[0].session.content).toEqual([
      {
        turns: [
          {
            role: 'user',
            parts: [
              { text: 'Say exactly this, then wait for the reply: "Hi, this is Sam from Acme."' },
            ],
          },
        ],
        turnComplete: true,
      },
    ]);
  });

  it('opens the call itself when no greeting is set', async () => {
    const { engine, conns } = setup({ greeting: '' });
    await engine.start();
    expect(conns[0].session.content).toHaveLength(1);
    expect(JSON.stringify(conns[0].session.content[0])).toContain('Open the call');
  });

  it('forwards caller audio as 16 kHz PCM once connected', async () => {
    const { engine, conns } = setup();
    engine.pushAudio(callerChunk()); // before start: nobody to hear it
    await engine.start();
    engine.pushAudio(callerChunk());
    const sent = conns[0].session.audio;
    expect(sent).toHaveLength(1);
    expect(sent[0].mimeType).toBe('audio/pcm;rate=16000');
    expect(Buffer.from(sent[0].data, 'base64')).toHaveLength(640); // 160 samples → 320, 2 bytes each
  });

  it('plays 24 kHz model audio to the carrier as 8 kHz μ-law', async () => {
    const { engine, cb, server } = setup();
    await engine.start();
    server(0, audioMessage(modelAudio(2400)));
    expect(cb.onAudio).toHaveBeenCalledTimes(1);
    const mulaw = Buffer.from(cb.onAudio.mock.calls[0][0], 'base64');
    expect(mulaw).toHaveLength(800);
    const level = Math.max(...mulawDecode(mulaw.subarray(100)).map(Math.abs));
    expect(level).toBeGreaterThan(7000);
  });

  it('clears the carrier and starts the next turn fresh when the caller barges in', async () => {
    const a = setup();
    await a.engine.start();
    a.server(0, audioMessage(modelAudio(1201, 700)));
    a.server(0, { serverContent: { outputTranscription: { text: 'Our plans start at' } } });
    a.server(0, { serverContent: { interrupted: true } });
    expect(a.cb.onInterrupt).toHaveBeenCalledTimes(1);
    expect(a.cb.onTranscript).toHaveBeenCalledWith('agent', 'Our plans start at —');

    // The next turn's audio is not smeared with the interrupted one.
    a.server(0, audioMessage(modelAudio(600)));
    const b = setup();
    await b.engine.start();
    b.server(0, audioMessage(modelAudio(600)));
    expect(a.cb.onAudio.mock.calls.at(-1)).toEqual(b.cb.onAudio.mock.calls[0]);
  });

  it('writes whole transcript lines, caller before agent', async () => {
    const { engine, cb, server } = setup();
    await engine.start();
    server(0, { serverContent: { inputTranscription: { text: 'Hi,' } } });
    server(0, { serverContent: { inputTranscription: { text: ' who is' } } });
    server(0, { serverContent: { outputTranscription: { text: 'This is Sam' } } });
    server(0, { serverContent: { inputTranscription: { text: ' this?' } } });
    expect(cb.onTranscript).not.toHaveBeenCalled();
    server(0, { serverContent: { outputTranscription: { text: ' from Acme.' } } });
    server(0, { serverContent: { turnComplete: true } });
    expect(cb.onTranscript.mock.calls).toEqual([
      ['caller', 'Hi, who is this?'],
      ['agent', 'This is Sam from Acme.'],
    ]);

    server(0, { serverContent: { inputTranscription: { text: 'Sounds good.', finished: true } } });
    expect(cb.onTranscript).toHaveBeenLastCalledWith('caller', 'Sounds good.');
    server(0, { serverContent: { outputTranscription: { text: 'Bye now.' } } });
    engine.close();
    expect(cb.onTranscript).toHaveBeenLastCalledWith('agent', 'Bye now.');
  });

  it('runs tool calls and answers with the same id', async () => {
    const { engine, cb, conns, server } = setup();
    cb.onToolCall.mockResolvedValueOnce('Open slots: 10:00, 14:00');
    await engine.start();
    server(0, {
      toolCall: {
        functionCalls: [{ id: 'fc-1', name: 'check_availability', args: { date: '2026-10-20' } }],
      },
    });
    await tick();
    expect(cb.onToolCall).toHaveBeenCalledWith('check_availability', { date: '2026-10-20' });
    expect(conns[0].session.toolResponses).toEqual([
      {
        functionResponses: [
          {
            id: 'fc-1',
            name: 'check_availability',
            response: { result: 'Open slots: 10:00, 14:00' },
          },
        ],
      },
    ]);
  });

  it('leaves a successful hang-up unanswered but reports a failed transfer', async () => {
    const { engine, cb, conns, server } = setup();
    await engine.start();
    cb.onToolCall.mockResolvedValueOnce('Call ending.');
    server(0, {
      toolCall: { functionCalls: [{ id: 'fc-2', name: 'end_call', args: { reason: 'done' } }] },
    });
    await tick();
    expect(conns[0].session.toolResponses).toEqual([]);

    cb.onToolCall.mockResolvedValueOnce('Error: transfer is not available on this call');
    server(0, {
      toolCall: {
        functionCalls: [{ id: 'fc-3', name: 'transfer_call', args: { reason: 'human' } }],
      },
    });
    await tick();
    expect(conns[0].session.toolResponses).toHaveLength(1);
    expect(conns[0].session.toolResponses[0].functionResponses).toEqual([
      {
        id: 'fc-3',
        name: 'transfer_call',
        response: { result: 'Error: transfer is not available on this call' },
      },
    ]);
  });

  it('moves to a new connection on goAway with the latest handle and no second greeting', async () => {
    const { engine, cb, conns, server } = setup();
    await engine.start();
    server(0, { sessionResumptionUpdate: { newHandle: 'h1', resumable: true } });
    server(0, { sessionResumptionUpdate: { newHandle: 'h2', resumable: true } });
    server(0, { sessionResumptionUpdate: { newHandle: '', resumable: false } }); // mid-turn: keeps h2

    server(0, { goAway: { timeLeft: '10s' } });
    engine.pushAudio(callerChunk()); // arrives while we switch: held, not lost
    await tick();

    expect(conns).toHaveLength(2);
    expect(conns[1].config.sessionResumption).toEqual({ handle: 'h2' });
    expect(conns[1].session.content).toEqual([]); // no second greeting
    expect(conns[0].session.closed).toBe(true);
    expect(conns[0].session.audio).toHaveLength(0);
    expect(conns[1].session.audio).toHaveLength(1);
    expect(Buffer.from(conns[1].session.audio[0].data, 'base64')).toHaveLength(640);

    engine.pushAudio(callerChunk());
    expect(conns[1].session.audio).toHaveLength(2);
    // The old connection is no longer listened to.
    server(0, audioMessage(modelAudio(2400)));
    expect(cb.onAudio).not.toHaveBeenCalled();
    server(1, audioMessage(modelAudio(2400)));
    expect(cb.onAudio).toHaveBeenCalledTimes(1);
    expect(cb.onFatal).not.toHaveBeenCalled();
  });

  it('tells the new session about a tool that finished during a reconnect', async () => {
    const { engine, cb, conns, server, drop } = setup();
    await engine.start();
    server(0, { sessionResumptionUpdate: { newHandle: 'h1', resumable: true } });
    let finish!: (v: string) => void;
    cb.onToolCall.mockReturnValueOnce(new Promise<string>((r) => (finish = r)));
    server(0, {
      toolCall: { functionCalls: [{ id: 'fc-9', name: 'book_appointment', args: {} }] },
    });
    drop(0);
    await tick();
    expect(conns).toHaveLength(2);
    finish('Booked for 10:00');
    await tick();
    expect(conns[0].session.toolResponses).toEqual([]);
    expect(conns[1].session.toolResponses).toEqual([]);
    expect(conns[1].session.content).toEqual([
      {
        turns: [
          { role: 'user', parts: [{ text: '(book_appointment already ran: Booked for 10:00)' }] },
        ],
        turnComplete: false,
      },
    ]);
  });

  it('tells a fresh session the call is under way when there was no handle yet', async () => {
    const { engine, conns, drop } = setup();
    await engine.start();
    drop(0);
    await tick();
    expect(conns).toHaveLength(2);
    expect(conns[1].config.sessionResumption).not.toHaveProperty('handle', expect.anything());
    expect(conns[1].session.content).toHaveLength(1);
    expect(conns[1].session.content[0].turnComplete).toBe(true);
  });

  it('resumes when the socket drops unexpectedly', async () => {
    const { engine, cb, conns, server, drop } = setup();
    await engine.start();
    server(0, { sessionResumptionUpdate: { newHandle: 'h1', resumable: true } });
    drop(0);
    await tick();
    expect(conns).toHaveLength(2);
    expect(conns[1].config.sessionResumption).toEqual({ handle: 'h1' });
    expect(conns[1].session.content).toEqual([]);
    expect(cb.onError).not.toHaveBeenCalled();
  });

  it('gives up and reports once reconnecting keeps failing', async () => {
    vi.useFakeTimers();
    const { engine, cb, conns, setMode, drop } = setup();
    await engine.start();
    setMode('reject');
    drop(0);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(conns).toHaveLength(5); // the first connection, then four attempts
    expect(cb.onError).toHaveBeenCalledTimes(1);
    expect(cb.onFatal).toHaveBeenCalledTimes(1);
  });

  it('fails to start when the server refuses the setup', async () => {
    const { engine, setMode } = setup();
    setMode('refuse');
    await expect(engine.start()).rejects.toThrow(/1008: model not found/);
  });

  it('closes the session on close() and does not reconnect', async () => {
    const { engine, conns, drop } = setup();
    await engine.start();
    engine.close();
    expect(conns[0].session.closed).toBe(true);
    drop(0);
    await tick();
    engine.pushAudio(callerChunk());
    expect(conns).toHaveLength(1);
    expect(conns[0].session.audio).toHaveLength(0);
  });
});
