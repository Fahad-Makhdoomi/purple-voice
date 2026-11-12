import type {
  Agent,
  Call,
  CampaignContact,
  CredentialProvider,
  CrmLead,
  Integration,
  PhoneNumber,
  TelephonyAccount,
  Workspace,
} from '@prisma/client';
import { CREDENTIAL_PROVIDER_LABELS, voiceForEngine } from '@pv/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { signedCallbackUrl } from '../lib/signed-url';
import { legStreamUrl } from '../telephony/stream-urls';
import { emitEvent } from '../events';
import { findApiKey } from '../services/ai-keys';
import { aiSettingsForAgent } from '../services/ai-settings';
import { applyCallStatus, isTerminal, saveTranscript } from '../services/calls';
import {
  availableSlots,
  bookAppointment,
  cancelAppointment,
  rescheduleAppointment,
  upcomingForPhone,
} from '../services/calendar';
import { messagingChannels, sendAgentMessage } from '../services/messaging';
import { leadAsContact } from '../services/crm';
import type { TranscriptLine } from '../services/ai/summarize';
import { adapterForAccount, type TelephonyAdapter } from '../telephony';
import { buildInstructions, type PreviousCall } from './prompt';
import { createNoiseGate } from './noise-gate';
import { CallRecorder } from './recorder';
import { EchoGuard } from './echo-guard';
import { recordsCalls, saveRecording } from '../services/recordings';
import { TOOL_SCHEMAS, toolsForAgent, type ToolName } from './tools';
import { describe, isValidTimeZone, utcToZoned } from './time';
import { HttpError } from '../lib/http-error';
import { mulawDurationMs, type MediaTransport } from './transports';
import {
  TRANSFER_RING_SECONDS,
  TransferLeg,
  transferLegs,
  type TransferFailure,
} from './transfer-bridge';
import { OpenAIRealtimeEngine } from './engines/openai-realtime';
import { GeminiLiveEngine } from './engines/gemini-live';
import { CascadedEngine } from './engines/cascaded';
import type { VoiceEngine } from './engines/types';

type LoadedCall = Call & {
  agent: Agent | null;
  contact: CampaignContact | null;
  lead: CrmLead | null;
  campaign: { goal: string; personalization: string } | null;
  workspace: Workspace;
  phoneNumber: (PhoneNumber & { telephonyAccount: TelephonyAccount }) | null;
};

/** Emails and WhatsApp messages an agent may send on one call (abuse guard). */
const MAX_MESSAGES_PER_CHANNEL = 3;
/** Agent-sent emails + WhatsApp messages per business per 24 hours. */
const MAX_MESSAGES_PER_WORKSPACE_DAY = 300;
/** Per caller phone number per 24 hours, across calls. */
const MAX_MESSAGES_PER_CALLER_DAY = 6;

const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
const hostOf = (raw: string) => {
  try {
    return new URL(/^https?:/i.test(raw) ? raw : `https://${raw}`).hostname
      .replace(/^www\./, '')
      .toLowerCase();
  } catch {
    return null;
  }
};

/**
 * Links in an agent message must point at a site the business listed in the
 * agent's "What the agent may send"; any other link is removed, so a caller
 * can't have the business's own email account send phishing links.
 */
export function keepAllowedLinks(message: string, shareInfo: string): string {
  const allowed = new Set(
    (shareInfo.match(LINK) ?? []).map(hostOf).filter((h): h is string => !!h),
  );
  return message.replace(LINK, (url) => {
    const host = hostOf(url.replace(/[.,;:!?]+$/, ''));
    return host && allowed.has(host) ? url : '[link removed]';
  });
}
const TRANSCRIPT_FLUSH_MS = 15_000;
/** Longest call once transferred to a person; nginx holds /ws/ connections for a little over an hour. */
const TRANSFERRED_CALL_MAX_MS = 60 * 60_000;

const TRANSFER_FAILURES: Record<TransferFailure, string> = {
  no_answer: 'nobody answered',
  busy: 'the line was busy',
  failed: 'the call to the team could not be connected',
  timeout: 'nobody answered',
  caller_left: 'the caller hung up while it rang',
};

/**
 * One live call: the carrier's audio stream on one side, a voice engine on
 * the other, and the agent's tools in between. Lives exactly as long as the
 * media WebSocket.
 */
export class CallSession {
  private call!: LoadedCall;
  private adapter!: TelephonyAdapter;
  private engine?: VoiceEngine;
  private transcript: TranscriptLine[] = [];
  private ended = false;
  private playbackEndsAt = 0;
  private maxDurationTimer?: NodeJS.Timeout;
  private flushTimer?: NodeJS.Timeout;
  private providerCallId?: string;
  private sent = { EMAIL: 0, WHATSAPP: 0 };
  /** The one address this call may email. */
  private emailTo: string | null = null;
  /** Set when the workspace's plan records calls. */
  private recorder?: CallRecorder;
  /** Mutes the agent's own voice when the caller's line sends it back. */
  private readonly echo = new EchoGuard();
  /** A transfer to a person: ringing, or connected and carrying the call. */
  private leg?: TransferLeg;
  private startedAt = Date.now();

  constructor(
    private readonly callId: string,
    private readonly transport: MediaTransport,
  ) {}

  async start(): Promise<void> {
    const call = await prisma.call.findUnique({
      where: { id: this.callId },
      include: {
        agent: true,
        contact: true,
        lead: true,
        campaign: { select: { goal: true, personalization: true } },
        workspace: true,
        phoneNumber: { include: { telephonyAccount: true } },
      },
    });
    if (!call?.agent || !call.phoneNumber || isTerminal(call.status)) {
      this.transport.close();
      return;
    }
    this.call = call;
    this.providerCallId = call.providerCallId ?? undefined;
    this.adapter = adapterForAccount(call.phoneNumber.telephonyAccount);
    this.transcript = Array.isArray(call.transcript)
      ? (call.transcript as unknown as TranscriptLine[])
      : [];

    this.transport.onStart(({ providerCallId }) => {
      if (providerCallId && !this.providerCallId) this.providerCallId = providerCallId;
    });
    this.transport.onStop(() => void this.end('stream_closed'));

    try {
      if (await recordsCalls(call.workspaceId)) this.recorder = new CallRecorder();
      this.engine = await this.createEngine(call.agent);
      const gate = createNoiseGate(call.agent.noiseFilter);
      this.transport.onAudio((payload) => {
        // The recording keeps what the caller actually said, before the noise gate.
        this.recorder?.remote(payload);
        // While a transfer rings the agent hears nothing; once connected, the person does.
        if (this.leg) return this.leg.fromCaller(payload);
        const heard = this.echo.process(payload);
        const audio = gate ? gate.push(heard, Date.now() < this.playbackEndsAt) : heard;
        if (audio) this.engine?.pushAudio(audio);
      });
      await this.engine.start();
    } catch (err) {
      logger.error({ err, callId: this.callId }, 'Could not start voice engine');
      this.engine?.close();
      this.engine = undefined;
      // Subscribers see this on the call page, and never AI vendors or models
      // (staff choose those): the detail stays in the log above.
      await prisma.call.update({
        where: { id: this.callId },
        data: {
          errorMessage:
            "The AI voice couldn't start, so the call was ended. Our team can see why in the server logs.",
        },
      });
      await this.hangup();
      return;
    }

    this.maxDurationTimer = setTimeout(() => {
      this.note('Maximum call duration reached');
      void this.hangup();
    }, call.agent.maxCallDurationSec * 1000);
    this.flushTimer = setInterval(
      () => void saveTranscript(this.callId, this.transcript),
      TRANSCRIPT_FLUSH_MS,
    );

    await emitEvent(call.workspaceId, 'call.started', {
      callId: call.id,
      direction: call.direction,
      fromNumber: call.fromNumber,
      toNumber: call.toNumber,
      agentId: call.agentId,
      campaignId: call.campaignId,
    });
  }

  /** For a call-back: the last call this agent made to the caller from this number. */
  private async previousCall(agent: Agent): Promise<PreviousCall | null> {
    if (!this.call.isCallback) return null;
    const prior = await prisma.call.findFirst({
      where: {
        workspaceId: this.call.workspaceId,
        agentId: agent.id,
        direction: 'OUTBOUND',
        toNumber: this.call.fromNumber,
        createdAt: { lt: this.call.createdAt },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, summary: true, campaign: { select: { goal: true } } },
    });
    return prior
      ? { at: prior.createdAt, summary: prior.summary, campaignGoal: prior.campaign?.goal || null }
      : null;
  }

  private async createEngine(agent: Agent): Promise<VoiceEngine> {
    const tools = toolsForAgent(agent, await messagingChannels(this.call.workspaceId));
    const { instructions, greeting, opening } = buildInstructions({
      agent,
      workspace: this.call.workspace,
      call: this.call,
      // Calling a CRM lead outside a campaign: the lead stands in for the contact.
      contact: this.call.contact ?? (this.call.lead ? leadAsContact(this.call.lead) : null),
      campaignGoal: this.call.campaign?.goal,
      personalization: this.call.campaign?.personalization,
      previous: await this.previousCall(agent),
      toolNames: tools.map((t) => t.name),
      recorded: !!this.recorder,
    });
    const callbacks = {
      onAudio: (payload: string) => {
        // During a transfer the caller hears the ringing tone, then the person.
        if (this.leg) return;
        this.recorder?.local(payload);
        const playAt = Math.max(Date.now(), this.playbackEndsAt);
        this.echo.agentAudio(payload, playAt);
        this.playbackEndsAt = playAt + mulawDurationMs(payload);
        this.transport.sendAudio(payload);
      },
      onInterrupt: () => {
        if (this.leg) return;
        this.recorder?.interrupt();
        this.echo.agentStopped();
        this.playbackEndsAt = 0;
        this.transport.clearAudio();
      },
      onTranscript: (role: 'agent' | 'caller', text: string) =>
        this.transcript.push({ role, text, at: new Date().toISOString() }),
      onToolCall: (name: string, input: unknown) => this.runTool(name, input),
      onError: (err: unknown) => logger.warn({ err, callId: this.callId }, 'Voice engine error'),
      onFatal: () => {
        this.note('Voice engine disconnected');
        void this.hangup();
      },
    };

    // The AI layer is the workspace's, chosen by staff; the agent only picks
    // its voice, and falls back to the engine's default if that engine lacks it.
    const settings = await aiSettingsForAgent(this.call.workspaceId, agent.aiModel);
    const engineConfig = {
      model: settings.model,
      voice: voiceForEngine(settings.voiceEngine, agent.voice, settings.speechModel),
      language: agent.language,
      instructions,
      greeting,
      opening,
      noiseFilter: agent.noiseFilter,
      tools,
    };

    switch (settings.voiceEngine) {
      case 'REALTIME':
        return new OpenAIRealtimeEngine(
          { ...engineConfig, apiKey: await this.requireKey('OPENAI') },
          callbacks,
        );
      case 'GEMINI_LIVE':
        return new GeminiLiveEngine(
          { ...engineConfig, apiKey: await this.requireKey('GEMINI') },
          callbacks,
        );
      case 'CASCADED':
      case 'ELEVENLABS':
      case 'SARVAM': {
        // Same pipeline either way; only who hears and speaks differs.
        const speech = settings.voiceEngine === 'CASCADED' ? 'DEEPGRAM' : settings.voiceEngine;
        const [apiKey, speechApiKey] = await Promise.all([
          this.requireKey(settings.llmProvider),
          this.requireKey(speech),
        ]);
        return new CascadedEngine(
          {
            ...engineConfig,
            provider: settings.llmProvider,
            apiKey,
            speechApiKey,
            speech,
            speechModel: settings.speechModel || undefined,
          },
          callbacks,
        );
      }
    }
  }

  private async requireKey(provider: CredentialProvider): Promise<string> {
    const key = await findApiKey(this.call.workspaceId, provider);
    if (!key) {
      throw new Error(
        `No ${CREDENTIAL_PROVIDER_LABELS[provider]} key for this workspace or the platform`,
      );
    }
    return key;
  }

  private note(text: string) {
    this.transcript.push({ role: 'system', text, at: new Date().toISOString() });
  }

  /** Lets the caller hear the last sentence before we hang up or transfer. */
  private async waitForPlayback() {
    const wait = Math.max(0, this.playbackEndsAt - Date.now()) + 400;
    await new Promise((r) => setTimeout(r, Math.min(wait, 15_000)));
  }

  private async runTool(name: string, rawInput: unknown): Promise<string> {
    const schema = TOOL_SCHEMAS[name as ToolName];
    if (!schema) return `Error: unknown tool ${name}`;
    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) {
      return `Error: invalid input — ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`;
    }
    const agent = this.call.agent!;

    try {
      switch (name as ToolName) {
        case 'check_availability': {
          const { date, days } = parsed.data as { date: string; days?: number };
          return await this.availability(agent, date, days ?? 1);
        }
        case 'book_appointment': {
          const input = parsed.data as {
            start: string;
            name: string;
            email?: string;
            notes?: string;
          };
          return await this.book(agent, input);
        }
        case 'find_my_appointments':
          return await this.myAppointments();
        case 'reschedule_appointment': {
          const input = parsed.data as { appointment_id: string; start: string };
          return await this.reschedule(input.appointment_id, input.start);
        }
        case 'cancel_appointment':
          return await this.cancel((parsed.data as { appointment_id: string }).appointment_id);
        case 'transfer_call':
          return await this.transfer(agent, (parsed.data as { reason: string }).reason);
        case 'send_email': {
          const input = parsed.data as { to: string; subject: string; message: string };
          return await this.sendMessage(agent, 'EMAIL', input.to, input.message, input.subject);
        }
        case 'send_whatsapp': {
          const input = parsed.data as { to?: string; message: string };
          const theirs =
            this.call.direction === 'OUTBOUND' ? this.call.toNumber : this.call.fromNumber;
          return await this.sendMessage(agent, 'WHATSAPP', input.to || theirs, input.message);
        }
        case 'end_call': {
          this.note(`Agent ended the call: ${(parsed.data as { reason: string }).reason}`);
          void this.waitForPlayback().then(() => this.hangup());
          return 'Call ending.';
        }
      }
    } catch (err) {
      logger.warn({ err, tool: name, callId: this.callId }, 'Tool failed');
      // Staff see why on the call page (a carrier refusing a transfer, a calendar error).
      this.note(`${name.replace(/_/g, ' ')} failed: ${(err as Error).message}`);
      return `Error: ${(err as Error).message}`;
    }
    return 'Error: unhandled tool';
  }

  /**
   * Puts the caller through to the agent's transfer number by calling it
   * ourselves and joining the two calls (transfer-bridge.ts), not through
   * the carrier's transfer. The agent drops out once the person answers; if
   * nobody does, the agent hears why and carries on with the caller.
   */
  private async transfer(agent: Agent, reason: string): Promise<string> {
    const to = agent.transferNumber;
    const from = this.call.phoneNumber?.e164;
    if (!to || !from || this.leg || this.ended)
      return 'Error: transfer is not available on this call';
    this.note(`Transferring to ${to}: ${reason}`);
    await this.waitForPlayback();
    if (this.ended) return 'Error: the caller hung up';

    const provider = this.call.provider;
    const caller = this.call.direction === 'OUTBOUND' ? this.call.toNumber : this.call.fromNumber;
    // The person hears who is being put through and why before the caller joins.
    const plainReason = /^[\p{Script=Latin}\p{N}\p{P}\s]+$/u.test(reason) ? ` ${reason}.` : '';
    const leg = new TransferLeg(
      this.callId,
      caller,
      `Call from ${agent.name} at ${this.call.workspace.name}.${plainReason} Connecting you now.`,
      {
        dial: async () =>
          (
            await this.adapter.placeCall({
              from,
              to,
              answerUrl: signedCallbackUrl(provider, 'leg-voice', 'callId', this.callId),
              statusUrl: signedCallbackUrl(provider, 'leg-status', 'callId', this.callId),
              streamUrl: legStreamUrl(provider, this.callId),
              ringTimeoutSec: TRANSFER_RING_SECONDS,
            })
          ).providerCallId,
        hangup: (id) => this.adapter.hangup(id),
        toCaller: (payload) => this.transport.sendAudio(payload),
        clearCaller: () => this.transport.clearAudio(),
        onPersonAudio: (payload) => this.recorder?.local(payload),
        onPersonLeft: () => {
          this.note(`${to} hung up`);
          void this.hangup();
        },
      },
    );
    this.leg = leg;
    transferLegs.set(this.callId, leg);
    const outcome = await leg.connect().catch((err: unknown) => {
      this.dropLeg(leg);
      throw err;
    });

    if (!outcome.connected) {
      this.dropLeg(leg);
      const why = TRANSFER_FAILURES[outcome.reason];
      this.note(`Transfer to ${to} did not connect: ${why}`);
      return `Error: the transfer did not go through (${why}). You are still on the call with them: say the team could not pick up just now, and offer a call back or to take a message.`;
    }

    // The person has the caller now; the agent's part is over.
    this.note(`Connected to ${to}`);
    this.engine?.close();
    this.engine = undefined;
    clearTimeout(this.maxDurationTimer);
    this.maxDurationTimer = setTimeout(
      () => {
        this.note('Maximum call duration reached');
        void this.hangup();
      },
      Math.max(0, this.startedAt + TRANSFERRED_CALL_MAX_MS - Date.now()),
    );
    await prisma.call.update({
      where: { id: this.callId },
      data: { status: 'TRANSFERRED', transferredTo: to, outcome: 'TRANSFERRED' },
    });
    return 'Transferred.';
  }

  private dropLeg(leg: TransferLeg) {
    if (this.leg === leg) this.leg = undefined;
    if (transferLegs.get(this.callId) === leg) transferLegs.delete(this.callId);
  }

  /** Sends an email or WhatsApp message the caller asked for, and says what happened. */
  private async sendMessage(
    agent: Agent,
    channel: 'EMAIL' | 'WHATSAPP',
    to: string,
    message: string,
    subject?: string,
  ): Promise<string> {
    const what = channel === 'EMAIL' ? 'email' : 'WhatsApp message';
    if (this.sent[channel] >= MAX_MESSAGES_PER_CHANNEL)
      return `Error: you have already sent ${MAX_MESSAGES_PER_CHANNEL} on this call; offer to have the team follow up instead.`;

    // Callers can talk the model into almost anything, so the limits are
    // enforced here, not in the prompt: WhatsApp only to the number on the
    // call, email to one address per call, daily caps per business and per
    // caller, and only links the business listed in "What the agent may send".
    const caller = this.callerPhone();
    if (channel === 'WHATSAPP' && to !== caller)
      return 'Error: WhatsApp messages can only go to the number on this call. Offer to send it there instead.';
    if (channel === 'EMAIL') {
      const address = to.toLowerCase();
      if (this.emailTo && this.emailTo !== address)
        return `Error: on one call you can only email one address (${this.emailTo}). Offer to send it there, or have the team follow up.`;
      this.emailTo = address;
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [forBusiness, forCaller] = await Promise.all([
      prisma.callMessage.count({
        where: { workspaceId: this.call.workspaceId, createdAt: { gte: since } },
      }),
      prisma.callMessage.count({
        where: {
          workspaceId: this.call.workspaceId,
          createdAt: { gte: since },
          call: { OR: [{ fromNumber: caller }, { toNumber: caller }] },
        },
      }),
    ]);
    if (forBusiness >= MAX_MESSAGES_PER_WORKSPACE_DAY || forCaller >= MAX_MESSAGES_PER_CALLER_DAY)
      return 'Error: the daily limit for messages has been reached. Apologise and offer to have the team follow up.';
    message = keepAllowedLinks(message, agent.shareInfo);
    this.sent[channel]++;
    const tz = isValidTimeZone(agent.timezone) ? agent.timezone : 'UTC';
    // Says who sent it and that it is an AI assistant, as the call itself does.
    const text =
      channel === 'EMAIL'
        ? `${message}\n\n—\nSent by ${agent.name}, the AI assistant for ${this.call.workspace.name}, during your call on ${describe(new Date(), tz)}.`
        : message;
    const result = await sendAgentMessage({
      workspaceId: this.call.workspaceId,
      callId: this.callId,
      agentId: agent.id,
      channel,
      to,
      subject,
      text,
    });
    this.note(
      result.ok ? `Sent a ${what} to ${to}` : `Could not send a ${what} to ${to}: ${result.detail}`,
    );
    return result.ok
      ? `The ${what} to ${to} has been sent. Tell them it should arrive in a minute${channel === 'EMAIL' ? ' and to check their spam folder if not' : ''}.`
      : `Error: the ${what} could not be sent (${result.detail}). Apologise and offer to have the team send it.`;
  }

  /** The number on the other end of this call. */
  private callerPhone(): string {
    return this.call.direction === 'OUTBOUND' ? this.call.toNumber : this.call.fromNumber;
  }

  private async availability(agent: Agent, date: string, days: number): Promise<string> {
    const { timezone, durationMin, slots } = await availableSlots(this.call.workspaceId, {
      date,
      days,
      durationMin: agent.appointmentDurationMin,
      limit: 8,
      legacyIntegrationId: agent.calendarIntegrationId,
    });
    if (!slots.length)
      return days > 1
        ? `No open slots in the ${days} days from ${date}. Offer to look further ahead or take their details.`
        : `No open slots on ${date}. Offer another day.`;
    const list = slots.map((t) => {
      const z = utcToZoned(t, timezone);
      return `${z.date}T${z.time} (${describe(t, timezone)})`;
    });
    return `Open ${durationMin}-minute slots (${timezone}): ${list.join('; ')}. Use the YYYY-MM-DDTHH:mm value when booking.`;
  }

  private async book(
    agent: Agent,
    input: { start: string; name: string; email?: string; notes?: string },
  ) {
    const phone = this.callerPhone();
    let appointment;
    try {
      appointment = await bookAppointment(this.call.workspaceId, {
        contactName: input.name,
        contactPhone: phone,
        contactEmail: input.email,
        start: input.start,
        durationMin: agent.appointmentDurationMin,
        title: `${this.call.workspace.name} × ${input.name}`,
        notes: [`Booked by ${agent.name} during a call with ${phone}.`, input.notes]
          .filter(Boolean)
          .join('\n\n'),
        source: 'AI',
        callId: this.callId,
        legacyIntegrationId: agent.calendarIntegrationId,
      });
    } catch (err) {
      // Booking refusals (taken, outside hours, past) are for the model to relay, not tool failures.
      if (err instanceof HttpError && err.status === 400)
        return `Error: ${err.message} Check availability again and offer another slot.`;
      throw err;
    }
    const tz = appointment.timezone;
    await prisma.call.update({
      where: { id: this.callId },
      data: { outcome: 'APPOINTMENT_BOOKED' },
    });
    this.note(`Appointment booked for ${describe(appointment.startsAt, tz)}`);
    await emitEvent(this.call.workspaceId, 'appointment.booked', {
      appointmentId: appointment.id,
      callId: this.callId,
      contactName: input.name,
      contactPhone: phone,
      contactEmail: input.email || null,
      startsAt: appointment.startsAt.toISOString(),
      endsAt: appointment.endsAt.toISOString(),
      timezone: tz,
    });
    return `Booked for ${describe(appointment.startsAt, tz)}${input.email ? '; a calendar invite is on its way' : ''}. Confirm this back to them.`;
  }

  private async myAppointments(): Promise<string> {
    const list = await upcomingForPhone(this.call.workspaceId, this.callerPhone());
    if (!list.length) return 'No upcoming appointments under this phone number.';
    return list
      .map(
        (a) =>
          `id ${a.id}: ${describe(a.startsAt, a.timezone)} (${a.timezone}) with ${a.contactName}`,
      )
      .join('\n');
  }

  /** Only appointments made under the caller's own number can be changed from a call. */
  private async ownAppointment(id: string) {
    const list = await upcomingForPhone(this.call.workspaceId, this.callerPhone());
    return list.find((a) => a.id === id) ?? null;
  }

  private async reschedule(id: string, start: string): Promise<string> {
    if (!(await this.ownAppointment(id)))
      return 'Error: no such appointment for this caller. Use find_my_appointments.';
    try {
      const moved = await rescheduleAppointment(this.call.workspaceId, id, { start });
      this.note(`Appointment moved to ${describe(moved.startsAt, moved.timezone)}`);
      return `Moved to ${describe(moved.startsAt, moved.timezone)}. Confirm this back to them.`;
    } catch (err) {
      if (err instanceof HttpError && err.status === 400)
        return `Error: ${err.message} Check availability again and offer another slot.`;
      throw err;
    }
  }

  private async cancel(id: string): Promise<string> {
    if (!(await this.ownAppointment(id)))
      return 'Error: no such appointment for this caller. Use find_my_appointments.';
    await cancelAppointment(this.call.workspaceId, id);
    this.note('Appointment cancelled by the caller');
    return 'The appointment is cancelled. Confirm this back to them and offer to rebook.';
  }

  private async hangup() {
    if (this.providerCallId) {
      await this.adapter
        .hangup(this.providerCallId)
        .catch((err) => logger.warn({ err }, 'Hangup failed'));
    }
    this.transport.close();
  }

  private async end(reason: string) {
    if (this.ended) return;
    this.ended = true;
    clearTimeout(this.maxDurationTimer);
    clearInterval(this.flushTimer);
    this.engine?.close();
    // The caller is gone: hang up on the person they were being put through to.
    if (this.leg) {
      this.leg.end();
      this.dropLeg(this.leg);
    }
    try {
      await saveTranscript(this.callId, this.transcript);
      await prisma.call.update({ where: { id: this.callId }, data: { endReason: reason } });
      await saveRecording(this.callId, this.recorder?.toWav() ?? null);
      this.recorder = undefined;
      // The carrier's status callback normally closes the call. If it never
      // arrives (misconfigured webhook), close it ourselves.
      setTimeout(async () => {
        const call = await prisma.call.findUnique({
          where: { id: this.callId },
          select: { status: true },
        });
        if (call && !isTerminal(call.status)) await applyCallStatus(this.callId, 'COMPLETED');
      }, 30_000);
    } catch (err) {
      logger.error({ err, callId: this.callId }, 'Failed to persist call end');
    }
  }
}
