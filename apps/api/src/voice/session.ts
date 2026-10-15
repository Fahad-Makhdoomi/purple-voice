import type { Agent, Call, CampaignContact, Integration, PhoneNumber, TelephonyAccount, Workspace } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { signedCallbackUrl } from '../lib/signed-url';
import { emitEvent } from '../events';
import { findApiKey } from '../services/ai-keys';
import { applyCallStatus, isTerminal, saveTranscript } from '../services/calls';
import { busySlots, createEvent } from '../services/google-calendar';
import type { TranscriptLine } from '../services/ai/summarize';
import { adapterForAccount, type TelephonyAdapter } from '../telephony';
import { buildInstructions } from './prompt';
import { TOOL_SCHEMAS, toolsForAgent, type ToolName } from './tools';
import { describe, isValidTimeZone, utcToZoned, zonedToUtc } from './time';
import { mulawDurationMs, type MediaTransport } from './transports';
import { OpenAIRealtimeEngine } from './engines/openai-realtime';
import { CascadedEngine } from './engines/cascaded';
import type { VoiceEngine } from './engines/types';

type LoadedCall = Call & {
  agent: Agent | null;
  contact: CampaignContact | null;
  campaign: { goal: string } | null;
  workspace: Workspace;
  phoneNumber: (PhoneNumber & { telephonyAccount: TelephonyAccount }) | null;
};

const BUSINESS_HOURS = { start: '09:00', end: '17:00' };
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
        campaign: { select: { goal: true } },
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
    this.transcript = Array.isArray(call.transcript) ? (call.transcript as unknown as TranscriptLine[]) : [];

    this.transport.onStart(({ providerCallId }) => {
      if (providerCallId && !this.providerCallId) this.providerCallId = providerCallId;
    });
    this.transport.onStop(() => void this.end('stream_closed'));

    try {
      this.engine = await this.createEngine(call.agent);
    } catch (err) {
      logger.error({ err, callId: this.callId }, 'Could not start voice engine');
      await prisma.call.update({ where: { id: this.callId }, data: { errorMessage: (err as Error).message } });
      await this.hangup();
      return;
    }

    this.transport.onAudio((payload) => this.engine?.pushAudio(payload));
    await this.engine.start();

    this.maxDurationTimer = setTimeout(() => {
      this.note('Maximum call duration reached');
      void this.hangup();
    }, call.agent.maxCallDurationSec * 1000);
    this.flushTimer = setInterval(() => void saveTranscript(this.callId, this.transcript), TRANSCRIPT_FLUSH_MS);

    await emitEvent(call.workspaceId, 'call.started', {
      callId: call.id,
      direction: call.direction,
      fromNumber: call.fromNumber,
      toNumber: call.toNumber,
      agentId: call.agentId,
      campaignId: call.campaignId,
    });
  }

  private async createEngine(agent: Agent): Promise<VoiceEngine> {
    const tools = toolsForAgent(agent);
    const { instructions, greeting } = buildInstructions({
      agent,
      workspace: this.call.workspace,
      call: this.call,
      contact: this.call.contact,
      campaignGoal: this.call.campaign?.goal,
      toolNames: tools.map((t) => t.name),
    });
    const callbacks = {
      onAudio: (payload: string) => {
        this.playbackEndsAt = Math.max(Date.now(), this.playbackEndsAt) + mulawDurationMs(payload);
        this.transport.sendAudio(payload);
      },
      onInterrupt: () => {
        this.playbackEndsAt = 0;
        this.transport.clearAudio();
      },
      onTranscript: (role: 'agent' | 'caller', text: string) =>
        this.transcript.push({ role, text, at: new Date().toISOString() }),
      onToolCall: (name: string, input: unknown) => this.runTool(name, input),
      onError: (err: unknown) => logger.warn({ err, callId: this.callId }, 'Voice engine error'),
    };

    if (agent.voiceEngine === 'REALTIME') {
      const apiKey = await findApiKey(this.call.workspaceId, 'OPENAI');
      if (!apiKey) throw new Error('No OpenAI key for the Realtime engine');
      return new OpenAIRealtimeEngine(
        { apiKey, model: agent.llmModel, voice: agent.voice, language: agent.language, instructions, greeting, tools },
        callbacks,
      );
    }

    const [apiKey, speechApiKey] = await Promise.all([
      findApiKey(this.call.workspaceId, agent.llmProvider),
      findApiKey(this.call.workspaceId, 'DEEPGRAM'),
    ]);
    if (!apiKey) throw new Error(`No ${agent.llmProvider} key for this agent`);
    if (!speechApiKey) throw new Error('No Deepgram key for speech');
    return new CascadedEngine(
      {
        provider: agent.llmProvider,
        apiKey,
        speechApiKey,
        model: agent.llmModel,
        voice: agent.voice,
        language: agent.language,
        instructions,
        greeting,
        tools,
      },
      callbacks,
    );
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
          const input = parsed.data as { start: string; name: string; email?: string; notes?: string };
          return await this.book(agent, input, tz);
        }
        case 'transfer_call': {
          if (!agent.transferNumber || !this.providerCallId) return 'Error: transfer is not available on this call';
          this.note(`Transferring to ${agent.transferNumber}: ${(parsed.data as { reason: string }).reason}`);
          await prisma.call.update({
            where: { id: this.callId },
            data: { status: 'TRANSFERRED', transferredTo: agent.transferNumber, outcome: 'TRANSFERRED' },
          });
          await this.waitForPlayback();
          await this.adapter.transferCall(
            this.providerCallId,
            agent.transferNumber,
            signedCallbackUrl(this.call.provider, 'transfer', 'callId', this.callId),
          );
          return 'Transferred.';
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

  private async calendar(agent: Agent): Promise<Integration | null> {
    if (!agent.calendarIntegrationId) return null;
    return prisma.integration.findFirst({
      where: { id: agent.calendarIntegrationId, workspaceId: this.call.workspaceId, type: 'GOOGLE_CALENDAR' },
    });
  }

  private async availability(agent: Agent, date: string, tz: string): Promise<string> {
    const dayStart = zonedToUtc(date, BUSINESS_HOURS.start, tz);
    const dayEnd = zonedToUtc(date, BUSINESS_HOURS.end, tz);
    const now = new Date(Date.now() + 60 * 60 * 1000);
    if (dayEnd <= now) return `No availability on ${date}; that day has passed or is nearly over.`;
    if (utcToZoned(dayStart, tz).weekday % 6 === 0) return `${date} is a weekend day; no appointments then.`;

    const integration = await this.calendar(agent);
    const busy = [
      ...(integration ? await busySlots(integration, dayStart, dayEnd) : []),
      ...(
        await prisma.appointment.findMany({
          where: { workspaceId: this.call.workspaceId, status: 'SCHEDULED', startsAt: { lt: dayEnd }, endsAt: { gt: dayStart } },
          select: { startsAt: true, endsAt: true },
        })
      ).map((a) => ({ start: a.startsAt.toISOString(), end: a.endsAt.toISOString() })),
    ].map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }));

    const slotMs = agent.appointmentDurationMin * 60_000;
    const slots: string[] = [];
    for (let t = dayStart.getTime(); t + slotMs <= dayEnd.getTime() && slots.length < 8; t += 30 * 60_000) {
      if (t < now.getTime()) continue;
      if (busy.some((b) => t < b.end && t + slotMs > b.start)) continue;
      const z = utcToZoned(new Date(t), tz);
      slots.push(`${z.date}T${z.time} (${describe(new Date(t), tz)})`);
    }
    return slots.length
      ? `Open ${agent.appointmentDurationMin}-minute slots (${tz}): ${slots.join('; ')}. Use the YYYY-MM-DDTHH:mm value when booking.`
      : `No open slots on ${date}. Offer another day.`;
  }

  private async book(agent: Agent, input: { start: string; name: string; email?: string; notes?: string }, tz: string) {
    const [date, time] = input.start.split('T');
    const startsAt = zonedToUtc(date, time, tz);
    const endsAt = new Date(startsAt.getTime() + agent.appointmentDurationMin * 60_000);
    if (startsAt.getTime() < Date.now()) return 'Error: that time is in the past.';

    const clash = await prisma.appointment.count({
      where: { workspaceId: this.call.workspaceId, status: 'SCHEDULED', startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
    });
    if (clash) return 'Error: that slot was just taken. Check availability again.';

    const phone = this.call.direction === 'OUTBOUND' ? this.call.toNumber : this.call.fromNumber;
    const integration = await this.calendar(agent);
    let externalEventId: string | undefined;
    let externalEventUrl: string | undefined;
    if (integration) {
      const event = await createEvent(integration, {
        summary: `${this.call.workspace.name} × ${input.name}`,
        description: [`Booked by ${agent.name} (Purple Voice) during a call with ${phone}.`, input.notes].filter(Boolean).join('\n\n'),
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
    await prisma.call.update({ where: { id: this.callId }, data: { outcome: 'APPOINTMENT_BOOKED' } });
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
      await this.adapter.hangup(this.providerCallId).catch((err) => logger.warn({ err }, 'Hangup failed'));
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
      // The carrier's status callback normally closes the call. If it never
      // arrives (misconfigured webhook), close it ourselves.
      setTimeout(async () => {
        const call = await prisma.call.findUnique({ where: { id: this.callId }, select: { status: true } });
        if (call && !isTerminal(call.status)) await applyCallStatus(this.callId, 'COMPLETED');
      }, 30_000);
    } catch (err) {
      logger.error({ err, callId: this.callId }, 'Failed to persist call end');
    }
  }
}
