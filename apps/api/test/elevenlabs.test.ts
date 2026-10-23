import { afterEach, describe, expect, it } from 'vitest';
import { WebSocketServer, type WebSocket } from 'ws';
import type { AddressInfo } from 'node:net';
import { ElevenLabsEngine } from '../src/voice/engines/elevenlabs';
import type { EngineCallbacks, EngineConfig } from '../src/voice/engines/types';

const servers: WebSocketServer[] = [];
afterEach(() => servers.splice(0).forEach((s) => s.close()));

async function setup(format = 'ulaw_8000', overrides: Partial<EngineConfig> = {}) {
  const received: Record<string, any>[] = [];
  let url = '';
  let headers: Record<string, unknown> = {};
  let socket!: WebSocket;
  const wss = new WebSocketServer({ port: 0 });
  servers.push(wss);
  wss.on('connection', (ws, req) => {
    socket = ws;
    url = req.url ?? '';
    headers = req.headers;
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      received.push(msg);
      if (msg.type === 'conversation_initiation_client_data') {
        ws.send(
          JSON.stringify({
            type: 'conversation_initiation_metadata',
            conversation_initiation_metadata_event: {
              conversation_id: 'c1',
              agent_output_audio_format: format,
              user_input_audio_format: format === 'pcm_24000' ? 'pcm_16000' : format,
            },
          }),
        );
      }
    });
  });
  const audio: string[] = [];
  const transcripts: [string, string][] = [];
  const tools: [string, unknown][] = [];
  let interrupts = 0;
  const cb: EngineCallbacks = {
    onAudio: (a) => audio.push(a),
    onInterrupt: () => interrupts++,
    onTranscript: (r, t) => transcripts.push([r, t]),
    onToolCall: async (n, i) => {
      tools.push([n, i]);
      return 'ok';
    },
    onError: () => {},
  };
  const config: EngineConfig = {
    apiKey: 'xi-key',
    model: 'agent_123',
    voice: 'agent-default',
    language: 'en-US',
    instructions: 'Be helpful.',
    greeting: 'Hello there',
    tools: [],
    ...overrides,
  };
  const port = (wss.address() as AddressInfo).port;
  const engine = new ElevenLabsEngine(config, cb, `ws://127.0.0.1:${port}`);
  await engine.start();
  return {
    engine,
    received,
    audio,
    transcripts,
    tools,
    interrupts: () => interrupts,
    send: (e: unknown) => socket.send(JSON.stringify(e)),
    url: () => url,
    headers: () => headers,
  };
}

const tick = () => new Promise((r) => setTimeout(r, 50));

describe('ElevenLabsEngine', () => {
  it('connects with the agent id and key and overrides the prompt, first message and language', async () => {
    const t = await setup();
    expect(t.url()).toContain('agent_id=agent_123');
    expect(t.headers()['xi-api-key']).toBe('xi-key');
    expect(t.received[0]!.conversation_config_override.agent).toEqual({
      prompt: { prompt: 'Be helpful.' },
      first_message: 'Hello there',
      language: 'en',
    });
    t.engine.close();
  });

  it('passes μ-law through both ways and relays transcripts and interruptions', async () => {
    const t = await setup();
    t.engine.pushAudio('AAAA');
    t.send({ type: 'audio', audio_event: { audio_base_64: 'BBBB', event_id: 1 } });
    t.send({ type: 'user_transcript', user_transcription_event: { user_transcript: ' hi ' } });
    t.send({ type: 'agent_response', agent_response_event: { agent_response: 'Hello' } });
    t.send({ type: 'interruption', interruption_event: { event_id: 1 } });
    t.send({ type: 'audio', audio_event: { audio_base_64: 'CCCC', event_id: 1 } });
    t.send({ type: 'audio', audio_event: { audio_base_64: 'DDDD', event_id: 2 } });
    await tick();
    expect(t.received.some((m) => m.user_audio_chunk === 'AAAA')).toBe(true);
    expect(t.audio).toEqual(['BBBB', 'DDDD']);
    expect(t.transcripts).toEqual([
      ['caller', 'hi'],
      ['agent', 'Hello'],
    ]);
    expect(t.interrupts()).toBe(1);
    t.engine.close();
  });

  it('answers pings and runs client tools', async () => {
    const t = await setup();
    t.send({ type: 'ping', ping_event: { event_id: 7 } });
    t.send({
      type: 'client_tool_call',
      client_tool_call: {
        tool_name: 'end_call',
        tool_call_id: 'tc1',
        parameters: { reason: 'done' },
      },
    });
    await tick();
    expect(t.received).toContainEqual({ type: 'pong', event_id: 7 });
    expect(t.tools).toEqual([['end_call', { reason: 'done' }]]);
    expect(t.received).toContainEqual({
      type: 'client_tool_result',
      tool_call_id: 'tc1',
      result: 'ok',
      is_error: false,
    });
    t.engine.close();
  });

  it('converts PCM 24 kHz agent audio to μ-law 8 kHz and leaves first_message to the agent when no greeting is set', async () => {
    const t = await setup('pcm_24000', { greeting: '' });
    const agent = t.received[0]!.conversation_config_override.agent;
    expect(agent.first_message).toBeUndefined();
    expect(agent.prompt.prompt).toContain('Be helpful.');
    const pcm = Buffer.alloc(2 * 2400); // 100 ms of silence at 24 kHz
    t.send({ type: 'audio', audio_event: { audio_base_64: pcm.toString('base64'), event_id: 1 } });
    await tick();
    const out = Buffer.from(t.audio.join(''), 'base64');
    expect(out.length).toBeGreaterThan(700);
    expect(out.length).toBeLessThanOrEqual(800);
    t.engine.close();
  });

  it('refuses to start without an agent id', async () => {
    const engine = new ElevenLabsEngine(
      {
        apiKey: 'k',
        model: '',
        voice: '',
        language: 'en',
        instructions: '',
        greeting: '',
        tools: [],
      },
      {
        onAudio() {},
        onInterrupt() {},
        onTranscript() {},
        onToolCall: async () => '',
        onError() {},
      },
    );
    await expect(engine.start()).rejects.toThrow(/agent id/);
  });
});
