import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { WebSocketServer } from 'ws';
import type { AddressInfo } from 'node:net';
import { ElevenLabsStt, elevenLabsSpeak } from '../src/voice/engines/elevenlabs-speech';

const closers: (() => void)[] = [];
afterEach(() => closers.splice(0).forEach((c) => c()));

const tick = () => new Promise((r) => setTimeout(r, 50));

describe('ElevenLabsStt', () => {
  it('streams μ-law, sends the key, and maps partial and committed transcripts', async () => {
    const received: Record<string, any>[] = [];
    let url = '';
    let key: unknown;
    const wss = new WebSocketServer({ port: 0 });
    closers.push(() => wss.close());
    wss.on('connection', (ws, req) => {
      url = req.url ?? '';
      key = req.headers['xi-api-key'];
      ws.on('message', (raw) => received.push(JSON.parse(raw.toString())));
      ws.send(JSON.stringify({ message_type: 'partial_transcript', text: 'hel' }));
      ws.send(JSON.stringify({ message_type: 'committed_transcript', text: 'hello there' }));
    });
    const events: string[] = [];
    const stt = new ElevenLabsStt(
      'xi-key',
      'en-GB',
      {
        onTranscript: (t, f) => events.push(`${f ? 'final' : 'interim'}:${t}`),
        onUtteranceEnd: () => events.push('end'),
        onSpeechStarted: () => undefined,
        onError: (e) => events.push(`error:${(e as Error).message}`),
      },
      `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`,
    );
    await stt.connect();
    stt.push('AAAA');
    await tick();
    expect(key).toBe('xi-key');
    expect(url).toContain('audio_format=ulaw_8000');
    expect(url).toContain('language_code=en');
    expect(url).toContain('commit_strategy=vad');
    expect(received).toEqual([
      {
        message_type: 'input_audio_chunk',
        audio_base_64: 'AAAA',
        commit: false,
        sample_rate: 8000,
      },
    ]);
    expect(events).toEqual(['interim:hel', 'final:hello there', 'end']);
    stt.close();
  });
});

describe('elevenLabsSpeak', () => {
  it('requests μ-law for the voice and delivers whole 20 ms frames', async () => {
    let seen: { url?: string; key?: unknown; body?: string } = {};
    const server: Server = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        seen = { url: req.url, key: req.headers['xi-api-key'], body };
        res.end(Buffer.alloc(400, 0x7f));
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    closers.push(() => server.close());
    const chunks: string[] = [];
    await elevenLabsSpeak(
      'xi-key',
      'voice123',
      'Hi!',
      (c) => chunks.push(c),
      new AbortController().signal,
      'en',
      undefined,
      `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    );
    expect(seen.url).toBe('/voice123/stream?output_format=ulaw_8000');
    expect(seen.key).toBe('xi-key');
    expect(JSON.parse(seen.body!)).toMatchObject({ text: 'Hi!', language_code: 'en' });
    const total = chunks.reduce((n, c) => n + Buffer.from(c, 'base64').length, 0);
    expect(total).toBe(400);
  });
});
