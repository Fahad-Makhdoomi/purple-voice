import {
  Behavior,
  GoogleGenAI,
  Modality,
  type FunctionCall,
  type FunctionResponse,
  type LiveCallbacks,
  type LiveConnectConfig,
  type LiveServerContent,
  type LiveServerMessage,
  type Session,
} from '@google/genai';
import { logger } from '../../lib/logger';
import {
  Downsampler24kTo8k,
  Upsampler8kTo16k,
  mulawDecode,
  mulawEncode,
  pcm16ToBuffer,
} from '../audio';
import type { EngineCallbacks, EngineConfig, VoiceEngine } from './types';

/** The parts of a Live session the engine uses. */
export type LiveSession = Pick<
  Session,
  'sendRealtimeInput' | 'sendClientContent' | 'sendToolResponse' | 'close'
>;

/** Opens a Live connection; resolves once the server has accepted the setup. */
export type LiveConnect = (params: {
  model: string;
  config: LiveConnectConfig;
  callbacks: LiveCallbacks;
}) => Promise<LiveSession>;

const INPUT_MIME = 'audio/pcm;rate=16000';
const CONNECT_TIMEOUT_MS = 10_000;
/** Caller audio held while a connection is replaced: 2 s of 16 kHz 16-bit mono. */
const MAX_HELD_BYTES = 2 * 16_000 * 2;
/** Pause before each attempt to replace a connection. */
const RECONNECT_DELAYS_MS = [0, 500, 1500, 3000];

interface Connection {
  session?: LiveSession;
  /** Set once we stop using this connection; anything it sends after that is ignored. */
  retired: boolean;
}

function defaultConnect(apiKey: string): LiveConnect {
  const ai = new GoogleGenAI({ apiKey });
  return (params) => ai.live.connect(params);
}

function closeQuietly(session: LiveSession) {
  try {
    session.close();
  } catch {
    // Already closed.
  }
}

/**
 * Gemini Live, speech-to-speech: one Gemini key, no Deepgram. Gemini hears
 * 16 kHz PCM and speaks 24 kHz PCM, so caller μ-law is decoded and upsampled
 * on the way in and the agent's voice is filtered, downsampled and μ-law
 * encoded on the way out (see ../audio).
 *
 * Gemini closes each WebSocket after about ten minutes and warns first with
 * goAway; calls can last an hour. We keep the latest session-resumption
 * handle and move the conversation to a fresh connection, holding up to two
 * seconds of caller audio while we switch. A socket that drops unexpectedly
 * is resumed the same way. The greeting is only ever sent once.
 *
 * Barge-in: the server's own voice detection interrupts the model; we clear
 * the carrier's queue so the caller stops hearing the old turn at once.
 */
export class GeminiLiveEngine implements VoiceEngine {
  private readonly connect: LiveConnect;
  private active?: Connection;
  private closed = false;
  /** A replacement connection is being opened; caller audio is held meanwhile. */
  private resuming = false;
  /** Latest resumable session handle: a new connection continues this conversation. */
  private handle?: string;
  private held: Buffer[] = [];
  private heldBytes = 0;
  private readonly upsampler = new Upsampler8kTo16k();
  private readonly downsampler = new Downsampler24kTo8k();
  private callerText = '';
  private agentText = '';

  constructor(
    private readonly config: EngineConfig,
    private readonly cb: EngineCallbacks,
    connect?: LiveConnect,
  ) {
    this.connect = connect ?? defaultConnect(config.apiKey);
  }

  async start(): Promise<void> {
    let conn: Connection;
    try {
      conn = await this.open();
    } catch (err) {
      if (this.closed) return; // the call ended while we were connecting
      throw err;
    }
    this.active = conn;

    // Speak first: the exact greeting if one is set, otherwise open naturally.
    // Resumed connections already have this in their history.
    const text = this.config.greeting
      ? `Say exactly this, then wait for the reply: "${this.config.greeting}"`
      : 'Open the call: greet the person briefly and say why you are calling.';
    this.send(conn, (s) =>
      s.sendClientContent({ turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true }),
    );
  }

  pushAudio(payloadB64: string) {
    // Before the first connection is up there is nobody to hear it.
    if (this.closed || !this.active) return;
    const samples = this.upsampler.process(mulawDecode(Buffer.from(payloadB64, 'base64')));
    const pcm = pcm16ToBuffer(samples);
    if (this.resuming) this.hold(pcm);
    else this.sendAudio(this.active, pcm);
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.flushAgent();
    this.held = [];
    this.heldBytes = 0;
    if (this.active) this.retire(this.active);
  }

  private liveConfig(): LiveConnectConfig {
    const { instructions, voice, tools } = this.config;
    return {
      // The language is set in the instructions ("Speak in …"), not here.
      responseModalities: [Modality.AUDIO],
      systemInstruction: instructions,
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      // Without compression an audio session ends at 15 minutes.
      contextWindowCompression: { slidingWindow: {} },
      sessionResumption: this.handle ? { handle: this.handle } : {},
      tools: tools.length
        ? [
            {
              functionDeclarations: tools.map((t) => ({
                name: t.name,
                description: t.description,
                parametersJsonSchema: t.parameters,
                // Newer Live models run tools in the background and keep
                // talking; ours (availability, booking, transfer, hang-up)
                // need the answer before the model goes on.
                behavior: Behavior.BLOCKING,
              })),
            },
          ]
        : undefined,
    };
  }

  /** Opens a connection with the latest resumption handle, if any. */
  private open(): Promise<Connection> {
    const conn: Connection = { retired: false };
    return new Promise<Connection>((resolve, reject) => {
      let settled = false;
      const fail = (err: unknown) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        conn.retired = true;
        reject(err);
      };
      const timer = setTimeout(
        () => fail(new Error('Gemini Live connection timed out')),
        CONNECT_TIMEOUT_MS,
      );

      this.connect({
        model: this.config.model,
        config: this.liveConfig(),
        callbacks: {
          onmessage: (msg) => {
            if (!conn.retired) this.onMessage(conn, msg);
          },
          onerror: (e) => {
            const err = new Error(`Gemini Live socket error: ${e?.message || 'unknown'}`);
            if (!settled) fail(err);
            else if (!conn.retired) this.cb.onError(err);
          },
          onclose: (e) => {
            // Before setup completes a close is a refusal (bad key, unknown model, ...).
            if (!settled) {
              fail(
                new Error(
                  `Gemini Live closed the connection (${e?.code ?? 'no code'}${e?.reason ? `: ${e.reason}` : ''})`,
                ),
              );
            } else if (!conn.retired) {
              conn.retired = true;
              this.onDropped(conn, e?.code, e?.reason);
            }
          },
        },
      }).then((session) => {
        if (settled || this.closed) {
          // Timed out, or the call ended while we were connecting.
          conn.retired = true;
          closeQuietly(session);
          fail(new Error('Voice engine closed'));
          return;
        }
        conn.session = session;
        settled = true;
        clearTimeout(timer);
        resolve(conn);
      }, fail);
    });
  }

  private retire(conn: Connection) {
    if (conn.retired) return;
    conn.retired = true;
    if (conn.session) closeQuietly(conn.session);
  }

  private send(conn: Connection, fn: (session: LiveSession) => void) {
    if (conn.retired || !conn.session) return;
    try {
      fn(conn.session);
    } catch (err) {
      logger.warn({ err }, 'Gemini Live send failed');
    }
  }

  private sendAudio(conn: Connection, pcm: Buffer) {
    this.send(conn, (s) =>
      s.sendRealtimeInput({ audio: { data: pcm.toString('base64'), mimeType: INPUT_MIME } }),
    );
  }

  /** Holds caller audio during a reconnect, keeping only the most recent two seconds. */
  private hold(pcm: Buffer) {
    this.held.push(pcm);
    this.heldBytes += pcm.length;
    while (this.heldBytes > MAX_HELD_BYTES) this.heldBytes -= this.held.shift()!.length;
  }

  private releaseHeld(conn: Connection) {
    const pcm = Buffer.concat(this.held);
    this.held = [];
    this.heldBytes = 0;
    if (pcm.length) this.sendAudio(conn, pcm);
  }

  private onDropped(conn: Connection, code?: number, reason?: string) {
    if (this.closed || conn !== this.active) return;
    logger.warn({ code, reason }, 'Gemini Live connection dropped; resuming');
    void this.resume(conn, 'dropped');
  }

  /**
   * Moves the conversation onto a new connection. On goAway the old one keeps
   * playing what it has already generated until the new one is ready.
   */
  private async resume(from: Connection, reason: 'go_away' | 'dropped') {
    if (this.resuming || this.closed) return;
    this.resuming = true;
    for (const [attempt, delay] of RECONNECT_DELAYS_MS.entries()) {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      if (this.closed) return;
      try {
        const next = await this.open();
        this.retire(from);
        this.active = next;
        this.resuming = false;
        this.releaseHeld(next);
        logger.info({ reason, attempt, resumed: !!this.handle }, 'Gemini Live connection replaced');
        return;
      } catch (err) {
        if (this.closed) return;
        logger.warn({ err, reason, attempt }, 'Gemini Live reconnect failed');
      }
    }
    this.resuming = false;
    if (!from.retired) {
      // goAway: the old connection still works until the server cuts it,
      // and that close will trigger another attempt.
      this.releaseHeld(from);
      return;
    }
    const err = new Error('Gemini Live connection lost and could not be restored');
    this.cb.onError(err);
    this.cb.onFatal?.(err);
  }

  private onMessage(conn: Connection, msg: LiveServerMessage) {
    const update = msg.sessionResumptionUpdate;
    if (update?.resumable && update.newHandle) this.handle = update.newHandle;

    if (msg.serverContent) this.onContent(msg.serverContent);
    if (msg.toolCall?.functionCalls?.length) void this.runTools(conn, msg.toolCall.functionCalls);
    if (msg.toolCallCancellation?.ids?.length) {
      logger.info({ ids: msg.toolCallCancellation.ids }, 'Gemini Live cancelled tool calls');
    }
    if (msg.goAway && conn === this.active) {
      logger.info({ timeLeft: msg.goAway.timeLeft }, 'Gemini Live going away; reconnecting');
      void this.resume(conn, 'go_away');
    }
  }

  private onContent(content: LiveServerContent) {
    if (content.interrupted) {
      this.cb.onInterrupt();
      this.downsampler.reset();
      this.flushAgent(true);
    }

    const heard = content.inputTranscription;
    if (heard?.text) {
      // The caller has started a new line: whatever the agent said came first.
      if (!this.callerText) this.flushAgent();
      this.callerText += heard.text;
    }
    if (heard?.finished) this.flushCaller();

    if (content.outputTranscription?.text) this.agentText += content.outputTranscription.text;

    for (const part of content.modelTurn?.parts ?? []) {
      // Gemini Live always speaks 24 kHz 16-bit PCM.
      const audio = part.inlineData;
      if (audio?.data && audio.mimeType?.startsWith('audio/')) this.play(audio.data);
    }

    if (content.outputTranscription?.finished || content.turnComplete) this.flushAgent();
  }

  private play(pcmB64: string) {
    const samples = this.downsampler.process(Buffer.from(pcmB64, 'base64'));
    if (samples.length) this.cb.onAudio(mulawEncode(samples).toString('base64'));
  }

  private flushCaller() {
    const text = this.callerText.replace(/\s+/g, ' ').trim();
    this.callerText = '';
    if (text) this.cb.onTranscript('caller', text);
  }

  /** Emits the agent's line, after any caller line it was answering. */
  private flushAgent(interrupted = false) {
    this.flushCaller();
    const text = this.agentText.replace(/\s+/g, ' ').trim();
    this.agentText = '';
    if (text) this.cb.onTranscript('agent', interrupted ? `${text} —` : text);
  }

  private async runTools(conn: Connection, calls: FunctionCall[]) {
    const functionResponses: FunctionResponse[] = [];
    let finished = false;
    for (const call of calls) {
      const name = call.name ?? '';
      const result = await this.cb
        .onToolCall(name, call.args ?? {})
        .catch((err: Error) => `Error: ${err.message}`);
      functionResponses.push({ id: call.id, name, response: { result } });
      if ((name === 'end_call' || name === 'transfer_call') && !result.startsWith('Error')) {
        finished = true;
      }
    }
    // After hanging up or transferring there is nobody left to talk to: an
    // unanswered blocking call keeps the model quiet while the line closes.
    if (finished || this.closed) return;
    if (conn.retired) {
      logger.warn(
        { tools: calls.map((c) => c.name) },
        'Gemini Live connection changed while a tool ran; result not delivered',
      );
      return;
    }
    this.send(conn, (s) => s.sendToolResponse({ functionResponses }));
  }
}
