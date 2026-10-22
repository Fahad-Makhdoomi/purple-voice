import type {
  Call,
  CallOutcome,
  Campaign,
  CampaignContact,
  CrmLead,
  CrmSettings,
  CrmStage,
  Prisma,
} from '@prisma/client';
import {
  DEFAULT_CRM_STAGES,
  shouldAdvance,
  stageKeyForOutcome,
  type CrmActivityType,
  type CrmStageKey,
  type LeadSource,
} from '@pv/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { randomToken } from '../lib/crypto';
import { emitEvent } from '../events';
import { describe, isValidTimeZone, utcToZoned, zonedToUtc } from '../voice/time';
import { getEntitlements } from './entitlements';

/**
 * The CRM (Pro and up): one lead per phone number in a workspace, moved
 * through the workspace's pipeline stages. Leads come from people the team
 * adds, campaign and inbound calls that went well (see syncCallToCrm, run
 * when a call is finalised), and new leads from WhatsApp or the lead webhook
 * (intakeLead), which an agent can call straight away (jobs/crm.ts).
 */

/** The workspace's pipeline, created with the default stages the first time it is needed. */
export async function ensureStages(workspaceId: string): Promise<CrmStage[]> {
  const stages = await prisma.crmStage.findMany({
    where: { workspaceId },
    orderBy: { position: 'asc' },
  });
  if (stages.length) return stages;
  await prisma.crmStage.createMany({
    data: DEFAULT_CRM_STAGES.map((s, position) => ({ workspaceId, ...s, position })),
    skipDuplicates: true,
  });
  return prisma.crmStage.findMany({ where: { workspaceId }, orderBy: { position: 'asc' } });
}

/** A built-in stage, wherever the team moved or renamed it. New leads fall back to the first open stage. */
export function stageFor(stages: CrmStage[], key: CrmStageKey): CrmStage | null {
  return (
    stages.find((s) => s.key === key) ??
    (key === 'new' ? (stages.find((s) => s.kind === 'OPEN') ?? stages[0] ?? null) : null)
  );
}

export async function getCrmSettings(workspaceId: string): Promise<CrmSettings> {
  return prisma.crmSettings.upsert({
    where: { workspaceId },
    create: { workspaceId, hookToken: randomToken(18) },
    update: {},
  });
}

export async function addActivity(
  leadId: string,
  type: CrmActivityType,
  text: string,
  extra: { callId?: string | null; actorId?: string | null } = {},
) {
  await prisma.$transaction([
    prisma.crmActivity.create({
      data: { leadId, type, text, callId: extra.callId, actorId: extra.actorId },
    }),
    prisma.crmLead.update({ where: { id: leadId }, data: { lastActivityAt: new Date() } }),
  ]);
}

export async function moveLead(
  lead: Pick<CrmLead, 'id' | 'workspaceId' | 'phone' | 'name' | 'stageId'>,
  stage: CrmStage,
  opts: { actorId?: string | null; reason?: string } = {},
) {
  if (lead.stageId === stage.id) return;
  await prisma.crmLead.update({ where: { id: lead.id }, data: { stageId: stage.id } });
  await addActivity(
    lead.id,
    'stage',
    `Moved to ${stage.name}${opts.reason ? ` (${opts.reason})` : ''}`,
    { actorId: opts.actorId },
  );
  await emitEvent(lead.workspaceId, 'lead.stage_changed', {
    leadId: lead.id,
    phone: lead.phone,
    name: lead.name,
    fromStageId: lead.stageId,
    stageId: stage.id,
    stage: stage.name,
    stageKind: stage.kind,
  });
}

export interface LeadDetails {
  /** +E.164. */
  phone: string;
  name?: string | null;
  email?: string | null;
  company?: string | null;
  notes?: string | null;
  tags?: string[];
  fields?: Record<string, unknown> | null;
  campaignId?: string | null;
  valueCents?: number | null;
  ownerId?: string | null;
}

const blank = (v: string | null | undefined) => !v || !v.trim();

/**
 * Adds a lead, or fills in what an existing lead with the same number is
 * missing (never overwriting what the team typed). `stageKey` moves an
 * existing lead forward only (shouldAdvance); `stageId` places a new lead.
 */
export async function upsertLead(
  workspaceId: string,
  details: LeadDetails,
  opts: {
    source: LeadSource;
    stageId?: string;
    stageKey?: CrmStageKey | null;
    actorId?: string | null;
    /** Timeline entry for a new lead (defaults to where it came from). */
    activity?: string;
  },
): Promise<{ lead: CrmLead; created: boolean }> {
  const stages = await ensureStages(workspaceId);
  const existing = await prisma.crmLead.findUnique({
    where: { workspaceId_phone: { workspaceId, phone: details.phone } },
  });

  if (!existing) {
    const stage =
      (opts.stageId && stages.find((s) => s.id === opts.stageId)) ||
      (opts.stageKey && stageFor(stages, opts.stageKey)) ||
      stageFor(stages, 'new');
    if (!stage) throw new Error('This pipeline has no stages');
    try {
      const lead = await prisma.crmLead.create({
        data: {
          workspaceId,
          stageId: stage.id,
          phone: details.phone,
          name: details.name || null,
          email: details.email || null,
          company: details.company || null,
          notes: details.notes ?? '',
          tags: details.tags ?? [],
          fields: (details.fields ?? undefined) as Prisma.InputJsonValue | undefined,
          campaignId: details.campaignId ?? null,
          valueCents: details.valueCents ?? null,
          ownerId: details.ownerId ?? null,
          source: opts.source,
        },
      });
      await prisma.crmActivity.create({
        data: {
          leadId: lead.id,
          type: 'created',
          text: opts.activity ?? `Added (${opts.source.replace('_', ' ')}) to ${stage.name}`,
          actorId: opts.actorId,
        },
      });
      await emitEvent(workspaceId, 'lead.created', {
        leadId: lead.id,
        phone: lead.phone,
        name: lead.name,
        email: lead.email,
        company: lead.company,
        source: lead.source,
        stageId: stage.id,
        stage: stage.name,
        campaignId: lead.campaignId,
      });
      return { lead, created: true };
    } catch (err) {
      // Two sources added the same number at once: the other one won, so update it instead.
      if ((err as { code?: string }).code !== 'P2002') throw err;
      return upsertLead(workspaceId, details, opts);
    }
  }

  const data: Prisma.CrmLeadUpdateInput = {};
  if (blank(existing.name) && details.name) data.name = details.name;
  if (blank(existing.email) && details.email) data.email = details.email;
  if (blank(existing.company) && details.company) data.company = details.company;
  if (details.notes && !existing.notes.includes(details.notes))
    data.notes = existing.notes ? `${existing.notes}\n\n${details.notes}` : details.notes;
  const tags = [...new Set([...existing.tags, ...(details.tags ?? [])])];
  if (tags.length !== existing.tags.length) data.tags = tags;
  if (details.fields && Object.keys(details.fields).length)
    data.fields = {
      ...details.fields,
      ...((existing.fields as Record<string, unknown> | null) ?? {}),
    } as Prisma.InputJsonValue;
  if (!existing.campaignId && details.campaignId)
    data.campaign = { connect: { id: details.campaignId } };
  const lead = Object.keys(data).length
    ? await prisma.crmLead.update({ where: { id: existing.id }, data })
    : existing;

  if (opts.stageKey) await advanceLead(lead, stages, opts.stageKey);
  return { lead, created: false };
}

/** Moves a lead to a built-in stage when that is a step forward. */
async function advanceLead(lead: CrmLead, stages: CrmStage[], key: CrmStageKey, reason?: string) {
  const target = stageFor(stages, key);
  const current = stages.find((s) => s.id === lead.stageId);
  if (target && current && shouldAdvance(current, target)) await moveLead(lead, target, { reason });
}

const OUTCOME_TEXT: Record<CallOutcome, string> = {
  INTERESTED: 'interested',
  NOT_INTERESTED: 'not interested',
  APPOINTMENT_BOOKED: 'appointment booked',
  CALLBACK_REQUESTED: 'asked for a call back',
  TRANSFERRED: 'transferred to the team',
  VOICEMAIL: 'voicemail',
  WRONG_NUMBER: 'wrong number',
  DO_NOT_CALL: 'asked not to be called',
  OTHER: 'other',
};

type FinishedCall = Call & {
  contact: CampaignContact | null;
  campaign: Campaign | null;
  agent: { name: string } | null;
};

/**
 * Runs when a call is finalised, for workspaces with the CRM. A call to or
 * from a number already in the CRM goes on that lead's timeline and can move
 * it forward. A campaign call (or an inbound one, if the workspace wants)
 * that ended with one of the auto-add outcomes, or booked an appointment,
 * adds the person.
 */
export async function syncCallToCrm(
  call: FinishedCall,
  outcome: CallOutcome | null,
  summary: string | null,
  reached: boolean,
) {
  const phone = call.direction === 'OUTBOUND' ? call.toNumber : call.fromNumber;
  const [settings, appointment, workspace] = await Promise.all([
    getCrmSettings(call.workspaceId),
    prisma.appointment.findFirst({
      where: { callId: call.id, status: 'SCHEDULED' },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.workspace.findUniqueOrThrow({
      where: { id: call.workspaceId },
      select: { timezone: true },
    }),
  ]);
  const existing = call.leadId
    ? await prisma.crmLead.findUnique({ where: { id: call.leadId } })
    : await prisma.crmLead.findUnique({
        where: { workspaceId_phone: { workspaceId: call.workspaceId, phone } },
      });

  const key = stageKeyForOutcome(outcome, !!appointment, reached);
  const qualifies = !!appointment || (!!outcome && settings.autoAddOutcomes.includes(outcome));
  const eligible = call.campaignId
    ? true
    : call.direction === 'INBOUND' && !!call.agentId && settings.autoAddInbound;
  if (!existing && !(eligible && qualifies)) return;

  let lead = existing;
  if (!lead) {
    const c = call.contact;
    ({ lead } = await upsertLead(
      call.workspaceId,
      {
        phone,
        name: c?.name ?? appointment?.contactName ?? null,
        email: c?.email ?? appointment?.contactEmail ?? null,
        company: c?.company ?? null,
        tags: c?.tags ?? [],
        fields: (c?.fields as Record<string, unknown> | null) ?? null,
        campaignId: call.campaignId,
      },
      {
        source: call.campaignId ? 'campaign' : 'inbound_call',
        stageKey: key,
        activity: call.campaign
          ? `Added from the campaign "${call.campaign.name}"`
          : 'Added after calling in',
      },
    ));
  } else if (key) {
    await advanceLead(lead, await ensureStages(call.workspaceId), key);
  }

  await prisma.crmLead.update({
    where: { id: lead.id },
    data: {
      lastOutcome: outcome ?? undefined,
      lastCallAt: call.endedAt ?? new Date(),
      ...(call.leadId ? {} : { calls: { connect: { id: call.id } } }),
    },
  });

  const who = call.agent
    ? call.agent.name
    : call.placedById
      ? 'You'
      : call.direction === 'INBOUND'
        ? 'They'
        : 'Call';
  const what =
    call.direction === 'INBOUND'
      ? `${who === 'They' ? 'They called in' : `${who} took their call`}`
      : `${who} called`;
  const result = reached
    ? outcome
      ? OUTCOME_TEXT[outcome]
      : 'talked'
    : call.status === 'BUSY'
      ? 'busy'
      : 'no answer';
  const firstLine = summary?.split('\n')[0]?.trim();
  await addActivity(
    lead.id,
    'call',
    `${what}${call.campaign ? ` (${call.campaign.name})` : ''}: ${result}.${firstLine ? ` ${firstLine}` : ''}`,
    { callId: call.id },
  );
  if (appointment) {
    const tz = isValidTimeZone(appointment.timezone) ? appointment.timezone : workspace.timezone;
    await addActivity(
      lead.id,
      'appointment',
      `Appointment booked for ${describe(appointment.startsAt, isValidTimeZone(tz) ? tz : 'UTC')}`,
      { callId: call.id },
    );
  }
}

/**
 * When a new lead may be called: now if the hours allow (or none are set),
 * otherwise when they next open. Hours are in the workspace's time zone and
 * apply every day.
 */
export function nextCallOpening(
  start: string | null,
  end: string | null,
  timeZone: string,
  now = new Date(),
): Date {
  if (!start || !end || start >= end) return now;
  const tz = isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const local = utcToZoned(now, tz);
  if (local.time >= start && local.time < end) return now;
  if (local.time < start) return zonedToUtc(local.date, start, tz);
  const [y, m, d] = local.date.split('-').map(Number) as [number, number, number];
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return zonedToUtc(tomorrow, start, tz);
}

/**
 * A new lead from WhatsApp or the lead webhook. Adds it (or updates the
 * existing one) and, for a new lead with the new-lead call on, books an
 * agent call: right away inside the calling hours, otherwise when they open.
 * Returns null when the workspace's plan has no CRM.
 */
export async function intakeLead(
  workspaceId: string,
  details: LeadDetails,
  source: Extract<LeadSource, 'whatsapp' | 'webhook'>,
  activity: string,
): Promise<{ lead: CrmLead; created: boolean; callAt: Date | null } | null> {
  const ent = await getEntitlements(workspaceId);
  if (!ent.active || !ent.features.crm) return null;
  const { lead, created } = await upsertLead(workspaceId, details, { source, activity });
  if (!created) return { lead, created, callAt: null };

  const settings = await getCrmSettings(workspaceId);
  if (!settings.instantCallEnabled || !settings.instantAgentId || !settings.instantNumberId)
    return { lead, created, callAt: null };
  const { timezone } = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { timezone: true },
  });
  const callAt = nextCallOpening(settings.instantWindowStart, settings.instantWindowEnd, timezone);
  await prisma.crmLead.update({ where: { id: lead.id }, data: { callDueAt: callAt } });
  if (callAt.getTime() > Date.now() + 60_000) {
    await addActivity(
      lead.id,
      'call',
      `Outside calling hours: an agent will call ${describe(callAt, isValidTimeZone(timezone) ? timezone : 'UTC')}`,
    );
  }
  logger.info({ workspaceId, leadId: lead.id, source }, 'New lead queued for an agent call');
  return { lead, created, callAt };
}

/**
 * A lead as the campaign contact the voice prompt understands, so an agent
 * calling a lead (dialer, CRM, new-lead call) knows who it is talking to and
 * what they wrote.
 */
export function leadAsContact(lead: CrmLead): CampaignContact {
  return {
    id: lead.id,
    campaignId: '',
    workspaceId: lead.workspaceId,
    phone: lead.phone,
    name: lead.name,
    email: lead.email,
    company: lead.company,
    notes: lead.notes || null,
    fields: lead.fields,
    status: 'PENDING',
    attempts: 0,
    lastAttemptAt: null,
    nextAttemptAt: null,
    lastOutcome: lead.lastOutcome,
    lastResult: null,
    tags: lead.tags,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  };
}
