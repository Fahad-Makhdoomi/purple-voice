import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { WebSocketServer } from 'ws';
import type { AddressInfo } from 'node:net';
import {
  GEMINI_LIVE_VOICES,
  SARVAM_V2_VOICES,
  SARVAM_VOICES,
  sarvamLanguage,
  speechModelFor,
  voiceForEngine,
  voicesForEngine,
} from '@pv/shared';
import { mulawEncode } from '../src/voice/audio';
import {
  SarvamStt,
  sarvamModelForVoice,
  sarvamSpeak,
  wavToMulaw,
} from '../src/voice/engines/sarvam-speech';

const closers: (() => void)[] = [];
afterEach(() => closers.splice(0).forEach((c) => c()));
const tick = () => new Promise((r) => setTimeout(r, 50));

function wav(samples: Int16Array, rate = 8000, format = 1): Buffer {
  const data =
    format === 7
      ? mulawEncode(samples)
      : Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(format, 20);
  h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * (format === 7 ? 1 : 2), 28);
  h.writeUInt16LE(format === 7 ? 1 : 2, 32);
  h.writeUInt16LE(format === 7 ? 8 : 16, 34);
  h.write('data', 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

describe('Sarvam language and voices', () => {
  it('maps agent languages to Sarvam codes', () => {
    expect(sarvamLanguage('hi')).toBe('hi-IN');
    expect(sarvamLanguage('en-US')).toBe('en-IN');
    expect(sarvamLanguage('ta-IN')).toBe('ta-IN');
    expect(sarvamLanguage('fr')).toBe('en-IN');
  });

  it('picks the Bulbul model from the voice', () => {
    expect(sarvamModelForVoice('shubh')).toBe('bulbul:v3');
    expect(sarvamModelForVoice('ritu_hi_sales')).toBe('bulbul:v4-flash');
    expect(SARVAM_VOICES.length).toBeGreaterThan(80);
  });

  it('lists the voices of the Bulbul model staff picked', () => {
    expect(speechModelFor('SARVAM')).toBe('bulbul:v3');
    expect(speechModelFor('SARVAM', 'bulbul:v9')).toBe('bulbul:v3');
    expect(speechModelFor('CASCADED', 'bulbul:v3')).toBe('');
    expect(voicesForEngine('SARVAM', 'bulbul:v3').map((v) => v.id)).toContain('shubh');
    expect(voicesForEngine('SARVAM', 'bulbul:v3').some((v) => v.id.includes('_'))).toBe(false);
    expect(voicesForEngine('SARVAM', 'bulbul:v4-flash').every((v) => v.id.includes('_'))).toBe(
      true,
    );
    expect(voicesForEngine('SARVAM', 'bulbul:v2').map((v) => v.id)).toEqual(
      SARVAM_V2_VOICES.map((v) => v.id),
    );
    // A v3 voice under v4-flash falls back to that model's first voice.
    expect(voiceForEngine('SARVAM', 'shubh', 'bulbul:v4-flash')).toBe(
      voicesForEngine('SARVAM', 'bulbul:v4-flash')[0]!.id,
    );
  });

  it('offers all 30 Gemini voices', () => {
    expect(GEMINI_LIVE_VOICES).toHaveLength(30);
    expect(new Set(GEMINI_LIVE_VOICES.map((v) => v.id)).size).toBe(30);
  });
});

describe('wavToMulaw', () => {
  it('encodes 8 kHz PCM WAV and passes μ-law WAV through', () => {
    const pcm = new Int16Array(800).fill(1000);
    expect(wavToMulaw(wav(pcm))).toEqual(mulawEncode(pcm));
    expect(wavToMulaw(wav(pcm, 8000, 7))).toEqual(mulawEncode(pcm));
  });

  it('refuses audio at another sample rate', () => {
    expect(() => wavToMulaw(wav(new Int16Array(100), 22050))).toThrow(/22050/);
  });
});

describe('SarvamStt', () => {
  it('sends 16 kHz PCM, and turns transcripts into finished caller turns', async () => {
    const received: Record<string, any>[] = [];
    let url = '';
    let key: unknown;
    const wss = new WebSocketServer({ port: 0 });
    closers.push(() => wss.close());
    wss.on('connection', (ws, req) => {
      url = req.url ?? '';
      key = req.headers['api-subscription-key'];
      ws.on('message', (raw) => received.push(JSON.parse(raw.toString())));
      ws.send(JSON.stringify({ type: 'events', data: { signal_type: 'START_SPEECH' } }));
      ws.send(JSON.stringify({ type: 'data', data: { transcript: 'नमस्ते, कौन बोल रहा है?' } }));
    });
    const events: string[] = [];
    const stt = new SarvamStt(
      'sk',
      'hi',
      {
        onTranscript: (t, f) => events.push(`${f ? 'final' : 'interim'}:${t}`),
        onUtteranceEnd: () => events.push('end'),
        onSpeechStarted: () => events.push('start'),
        onError: (e) => events.push(`error:${(e as Error).message}`),
      },
      `ws://127.0.0.1:${(wss.address() as AddressInfo).port}`,
    );
    await stt.connect();
    stt.push(Buffer.alloc(160, 0xff).toString('base64')); // 20 ms of μ-law
    await tick();
    expect(key).toBe('sk');
    expect(url).toContain('language-code=hi-IN');
    expect(url).toContain('sample_rate=16000');
    expect(received[0].audio.sample_rate).toBe('16000');
    expect(Buffer.from(received[0].audio.data, 'base64')).toHaveLength(640); // 320 samples
    expect(events).toEqual(['start', 'final:नमस्ते, कौन बोल रहा है?', 'end']);
    stt.close();
  });
});

describe('sarvamSpeak', () => {
  it('asks Bulbul for 8 kHz audio and delivers 20 ms μ-law frames', async () => {
    let seen: { key?: unknown; body?: any } = {};
    const pcm = new Int16Array(4000).fill(500); // 0.5 s
    const server: Server = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        seen = { key: req.headers['api-subscription-key'], body: JSON.parse(body) };
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ audios: [wav(pcm).toString('base64')] }));
      });
    });
    await new Promise<void>((r) => server.listen(0, r));
    closers.push(() => server.close());
    const chunks: Buffer[] = [];
    await sarvamSpeak(
      'sk',
      'ritu_hi_sales',
      'नमस्ते',
      (c) => chunks.push(Buffer.from(c, 'base64')),
      new AbortController().signal,
      'hi',
      undefined,
      `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    );
    expect(seen.key).toBe('sk');
    expect(seen.body).toMatchObject({
      speaker: 'ritu_hi_sales',
      model: 'bulbul:v4-flash',
      language_code: 'hi-IN',
      speech_sample_rate: 8000,
    });
    expect(chunks.every((c) => c.length === 160)).toBe(true);
    expect(Buffer.concat(chunks)).toEqual(mulawEncode(pcm));
  });
});

describe('Gemini thinking on calls', () => {
  it('uses the least thinking each generation allows', async () => {
    const { callThinking } = await import('../src/voice/llm/gemini');
    expect(callThinking('gemini-2.5-flash')).toEqual({ thinkingBudget: 0 });
    expect(callThinking('gemini-2.5-pro')).toEqual({ thinkingBudget: 128 });
    expect(callThinking('gemini-3-flash')?.thinkingLevel).toBe('MINIMAL');
    expect(callThinking('gemini-3-pro')?.thinkingLevel).toBe('LOW');
    expect(callThinking('gemini-2.0-flash')).toBeUndefined();
  });
});
