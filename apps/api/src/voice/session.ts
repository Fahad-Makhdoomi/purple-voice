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
import { emitEvent } from '../events';
import { findApiKey } from '../services/ai-keys';
import { getAiSettings } from '../services/ai-settings';
import { applyCallStatus, isTerminal, saveTranscript } from '../services/calls';
import { busySlots, createEvent } from '../services/google-calendar';
import { messagingChannels, sendAgentMessage } from '../services/messaging';
import { leadAsContact } from '../services/crm';
import type { TranscriptLine } from '../services/ai/summarize';
import { adapterForAccount, type TelephonyAdapter } from '../telephony';
import { buildInstructions, type PreviousCall } from './prompt';
import { createNoiseGate } from './noise-gate';
import { CallRecorder } from './recorder';
import { recordsCalls, saveRecording } from '../services/recordings';
import { TOOL_SCHEMAS, toolsForAgent, type ToolName } from './tools';
import { describe, isValidTimeZone, utcToZoned, zonedToUtc } from './time';
import { mulawDurationMs, type MediaTransport } from './transports';
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

const BUSINESS_HOURS = { start: '09:00', end: '17:00' };
/** Emails and WhatsApp messages an agent may send on one call (abuse guard). */
const MAX_MESSAGES_PER_CHANNEL = 3;
const TRANSCRIPT_FLUSH_MS = 15_000;

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
  /** Set when the workspace's plan records calls. */
  private recorder?: CallRecorder;

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
        const audio = gate ? gate.push(payload, Date.now() < this.playbackEndsAt) : payload;
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
        this.recorder?.local(payload);
        this.playbackEndsAt = Math.max(Date.now(), this.playbackEndsAt) + mulawDurationMs(payload);
        this.transport.sendAudio(payload);
      },
      onInterrupt: () => {
        this.recorder?.interrupt();
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
    const settings = await getAiSettings(this.call.workspaceId);
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
    const tz = isValidTimeZone(agent.timezone) ? agent.timezone : 'UTC';

    try {
      switch (name as ToolName) {
        case 'check_availability': {
          const { date } = parsed.data as { date: string };
          return await this.availability(agent, date, tz);
        }
        case 'book_appointment': {
          const input = parsed.data as {
            start: string;
            name: string;
            email?: string;
            notes?: string;
          };
          return await this.book(agent, input, tz);
        }
        case 'transfer_call': {
          if (!agent.transferNumber || !this.providerCallId)
            return 'Error: transfer is not available on this call';
          this.note(
            `Transferring to ${agent.transferNumber}: ${(parsed.data as { reason: string }).reason}`,
          );
          await prisma.call.update({
            where: { id: this.callId },
            data: {
              status: 'TRANSFERRED',
              transferredTo: agent.transferNumber,
              outcome: 'TRANSFERRED',
            },
          });
          await this.waitForPlayback();
          await this.adapter.transferCall(
            this.providerCallId,
            agent.transferNumber,
            signedCallbackUrl(this.call.provider, 'transfer', 'callId', this.callId),
          );
          return 'Transferred.';
        }
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
      return `Error: ${(err as Error).message}`;
    }
    return 'Error: unhandled tool';
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

  private async calendar(agent: Agent): Promise<Integration | null> {
    if (!agent.calendarIntegrationId) return null;
    return prisma.integration.findFirst({
      where: {
        id: agent.calendarIntegrationId,
        workspaceId: this.call.workspaceId,
        type: 'GOOGLE_CALENDAR',
      },
    });
  }

  private async availability(agent: Agent, date: string, tz: string): Promise<string> {
    const dayStart = zonedToUtc(date, BUSINESS_HOURS.start, tz);
    const dayEnd = zonedToUtc(date, BUSINESS_HOURS.end, tz);
    const now = new Date(Date.now() + 60 * 60 * 1000);
    if (dayEnd <= now) return `No availability on ${date}; that day has passed or is nearly over.`;
    if (utcToZoned(dayStart, tz).weekday % 6 === 0)
      return `${date} is a weekend day; no appointments then.`;

    const integration = await this.calendar(agent);
    const busy = [
      ...(integration ? await busySlots(integration, dayStart, dayEnd) : []),
      ...(
        await prisma.appointment.findMany({
          where: {
            workspaceId: this.call.workspaceId,
            status: 'SCHEDULED',
            startsAt: { lt: dayEnd },
            endsAt: { gt: dayStart },
          },
          select: { startsAt: true, endsAt: true },
        })
      ).map((a) => ({ start: a.startsAt.toISOString(), end: a.endsAt.toISOString() })),
    ].map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }));

    const slotMs = agent.appointmentDurationMin * 60_000;
    const slots: string[] = [];
    for (
      let t = dayStart.getTime();
      t + slotMs <= dayEnd.getTime() && slots.length < 8;
      t += 30 * 60_000
    ) {
      if (t < now.getTime()) continue;
      if (busy.some((b) => t < b.end && t + slotMs > b.start)) continue;
      const z = utcToZoned(new Date(t), tz);
      slots.push(`${z.date}T${z.time} (${describe(new Date(t), tz)})`);
    }
    return slots.length
      ? `Open ${agent.appointmentDurationMin}-minute slots (${tz}): ${slots.join('; ')}. Use the YYYY-MM-DDTHH:mm value when booking.`
      : `No open slots on ${date}. Offer another day.`;
  }

  private async book(
    agent: Agent,
    input: { start: string; name: string; email?: string; notes?: string },
    tz: string,
  ) {
    const [date, time] = input.start.split('T');
    const startsAt = zonedToUtc(date, time, tz);
    const endsAt = new Date(startsAt.getTime() + agent.appointmentDurationMin * 60_000);
    if (startsAt.getTime() < Date.now()) return 'Error: that time is in the past.';

    const clash = await prisma.appointment.count({
      where: {
        workspaceId: this.call.workspaceId,
        status: 'SCHEDULED',
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (clash) return 'Error: that slot was just taken. Check availability again.';

    const phone = this.call.direction === 'OUTBOUND' ? this.call.toNumber : this.call.fromNumber;
    const integration = await this.calendar(agent);
    let externalEventId: string | undefined;
    let externalEventUrl: string | undefined;
    if (integration) {
      const event = await createEvent(integration, {
        summary: `${this.call.workspace.name} × ${input.name}`,
        description: [
          `Booked by ${agent.name} (Purple Voice) during a call with ${phone}.`,
          input.notes,
        ]
          .filter(Boolean)
          .join('\n\n'),
        start: startsAt,
        end: endsAt,
        timeZone: tz,
        attendeeEmail: input.email || undefined,
      });
      externalEventId = event.id;
      externalEventUrl = event.htmlLink;
    }

    const appointment = await prisma.appointment.create({
      data: {
        workspaceId: this.call.workspaceId,
        callId: this.callId,
        integrationId: integration?.id,
        contactName: input.name,
        contactPhone: phone,
        contactEmail: input.email || null,
        startsAt,
        endsAt,
        timezone: tz,
        notes: input.notes,
        externalEventId,
        externalEventUrl,
      },
    });
    await prisma.call.update({
      where: { id: this.callId },
      data: { outcome: 'APPOINTMENT_BOOKED' },
    });
    this.note(`Appointment booked for ${describe(startsAt, tz)}`);
    await emitEvent(this.call.workspaceId, 'appointment.booked', {
      appointmentId: appointment.id,
      callId: this.callId,
      contactName: input.name,
      contactPhone: phone,
      contactEmail: input.email || null,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      timezone: tz,
    });
    return `Booked for ${describe(startsAt, tz)}${input.email ? '; a calendar invite is on its way' : ''}. Confirm this back to them.`;
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
