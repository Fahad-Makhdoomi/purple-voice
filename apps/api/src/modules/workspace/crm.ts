import { Router } from 'express';
import { z } from 'zod';
import type { CrmLead, CrmStage, Prisma } from '@prisma/client';
import {
  LEAD_SOURCES,
  campaignSchema,
  crmBulkSchema,
  crmFromCampaignSchema,
  crmLeadSchema,
  crmMoveSchema,
  crmNoteSchema,
  crmSettingsSchema,
  crmStageSchema,
  crmToCampaignSchema,
  parseTags,
  reorderCrmStagesSchema,
  stageKeyForOutcome,
  updateCrmLeadSchema,
  updateCrmStageSchema,
  type CrmLeadView,
  type CrmSettingsView,
  type CrmStageView,
  type LeadSource,
} from '@pv/shared';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { encrypt, randomToken } from '../../lib/crypto';
import { HttpError, badRequest, notFound } from '../../lib/http-error';
import { toE164 } from '../../lib/csv';
import { wsId } from '../../middleware/workspace';
import { entitlementsFor, requireFeature } from '../../middleware/entitlements';
import { assertWithinLimit } from '../../services/entitlements';
import { applyDoNotCall } from '../../services/do-not-call';
import { isValidTimeZone } from '../../voice/time';
import {
  addActivity,
  ensureStages,
  getCrmSettings,
  moveLead,
  upsertLead,
} from '../../services/crm';

/** The workspace's CRM (Pro and up). See services/crm.ts. */
export const crmRouter = Router();
crmRouter.use(requireFeature('crm'));

/** The most leads the board loads at once (most recently active first). */
const BOARD_LIMIT = 2000;

const leadInclude = {
  owner: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true } },
} as const;
type LeadRow = CrmLead & {
  owner: { id: string; name: string } | null;
  campaign: { id: string; name: string } | null;
};

function leadView(l: LeadRow): CrmLeadView {
  return {
    id: l.id,
    stageId: l.stageId,
    phone: l.phone,
    name: l.name,
    email: l.email,
    company: l.company,
    notes: l.notes,
    valueCents: l.valueCents,
    tags: l.tags,
    source: l.source as LeadSource,
    owner: l.owner,
    campaign: l.campaign,
    lastOutcome: l.lastOutcome,
    lastCallAt: l.lastCallAt?.toISOString() ?? null,
    callDueAt: l.callDueAt?.toISOString() ?? null,
    lastActivityAt: l.lastActivityAt.toISOString(),
    createdAt: l.createdAt.toISOString(),
  };
}

async function stageViews(workspaceId: string): Promise<CrmStageView[]> {
  const stages = await ensureStages(workspaceId);
  const totals = await prisma.crmLead.groupBy({
    by: ['stageId'],
    where: { workspaceId },
    _count: { _all: true },
    _sum: { valueCents: true },
  });
  return stages.map((s) => {
    const t = totals.find((x) => x.stageId === s.id);
    return {
      id: s.id,
      key: s.key,
      name: s.name,
      kind: s.kind,
      color: s.color as CrmStageView['color'],
      position: s.position,
      leadCount: t?._count._all ?? 0,
      valueCents: t?._sum.valueCents ?? 0,
    };
  });
}

async function findLead(workspaceId: string, id: string) {
  const lead = await prisma.crmLead.findFirst({ where: { id, workspaceId }, include: leadInclude });
  if (!lead) throw notFound('Lead');
  return lead;
}

async function findStage(workspaceId: string, id: string): Promise<CrmStage> {
  const stage = await prisma.crmStage.findFirst({ where: { id, workspaceId } });
  if (!stage) throw badRequest('Choose one of your pipeline stages');
  return stage;
}

function phoneOf(raw: string): string {
  const phone = toE164(raw);
  if (!phone) throw badRequest('Enter the number with its country code, e.g. +1 415 555 0123');
  return phone;
}

async function assertOwner(workspaceId: string, ownerId: string | null | undefined) {
  if (!ownerId) return;
  const user = await prisma.user.findFirst({ where: { id: ownerId, workspaceId } });
  if (!user) throw badRequest('Choose someone on your team');
}

// ── Pipeline and leads ──────────────────────────────────────────────────────

/** Stages with counts and values, and the leads that match the filters (newest activity first). */
crmRouter.get('/leads', async (req, res) => {
  const workspaceId = wsId(req);
  const q = z
    .string()
    .trim()
    .max(100)
    .optional()
    .parse(req.query.q || undefined);
  const stageId = z
    .string()
    .optional()
    .parse(req.query.stageId || undefined);
  const source = z
    .enum(LEAD_SOURCES)
    .optional()
    .parse(req.query.source || undefined);
  const tag = parseTags(String(req.query.tag ?? ''))[0];
  const where: Prisma.CrmLeadWhereInput = {
    workspaceId,
    ...(stageId ? { stageId } : {}),
    ...(source ? { source } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(q
      ? {
          OR: [
            { phone: { contains: q.replace(/[^\d+]/g, '') || q } },
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { company: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [stages, leads, total] = await Promise.all([
    stageViews(workspaceId),
    prisma.crmLead.findMany({
      where,
      include: leadInclude,
      orderBy: { lastActivityAt: 'desc' },
      take: BOARD_LIMIT,
    }),
    prisma.crmLead.count({ where }),
  ]);
  const tags = await prisma.$queryRaw<Array<{ tag: string }>>`
    SELECT DISTINCT unnest(tags) AS tag FROM "CrmLead" WHERE "workspaceId" = ${workspaceId} ORDER BY tag LIMIT 200`;
  res.json({
    stages,
    leads: leads.map(leadView),
    total,
    limit: BOARD_LIMIT,
    tags: tags.map((t) => t.tag),
  });
});

crmRouter.post('/leads', async (req, res) => {
  const input = crmLeadSchema.parse(req.body);
  const workspaceId = wsId(req);
  const phone = phoneOf(input.phone);
  const existing = await prisma.crmLead.findUnique({
    where: { workspaceId_phone: { workspaceId, phone } },
    select: { id: true },
  });
  if (existing)
    throw new HttpError(409, 'That number is already in your CRM', 'lead_exists', {
      leadId: existing.id,
    });
  if (input.stageId) await findStage(workspaceId, input.stageId);
  await assertOwner(workspaceId, input.ownerId);
  const { lead } = await upsertLead(
    workspaceId,
    {
      phone,
      name: input.name,
      email: input.email,
      company: input.company,
      notes: input.notes,
      tags: parseTags(input.tags),
      valueCents: input.valueCents,
      ownerId: input.ownerId,
    },
    {
      source: 'manual',
      stageId: input.stageId,
      actorId: req.user?.id,
      activity: `Added by ${req.user?.name ?? 'the team'}`,
    },
  );
  await audit(req, 'crm.lead_created', { entity: 'CrmLead', entityId: lead.id });
  res.status(201).json({ lead: leadView(await findLead(workspaceId, lead.id)) });
});

/** One lead with its timeline, its calls (any call to or from its number) and appointments. */
crmRouter.get('/leads/:id', async (req, res) => {
  const workspaceId = wsId(req);
  const lead = await findLead(workspaceId, String(req.params.id));
  const [activities, calls, appointments] = await Promise.all([
    prisma.crmActivity.findMany({
      where: { leadId: lead.id },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { actor: { select: { id: true, name: true } } },
    }),
    prisma.call.findMany({
      where: {
        workspaceId,
        OR: [{ leadId: lead.id }, { toNumber: lead.phone }, { fromNumber: lead.phone }],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        direction: true,
        status: true,
        outcome: true,
        summary: true,
        durationSec: true,
        createdAt: true,
        agent: { select: { id: true, name: true } },
        placedBy: { select: { id: true, name: true } },
        campaign: { select: { id: true, name: true } },
      },
    }),
    prisma.appointment.findMany({
      where: { workspaceId, contactPhone: lead.phone },
      orderBy: { startsAt: 'desc' },
      take: 20,
      select: { id: true, startsAt: true, status: true, timezone: true, notes: true },
    }),
  ]);
  res.json({
    lead: { ...leadView(lead), fields: lead.fields },
    stages: await stageViews(workspaceId),
    activities: activities.map((a) => ({
      id: a.id,
      type: a.type,
      text: a.text,
      callId: a.callId,
      actor: a.actor,
      createdAt: a.createdAt,
    })),
    calls,
    appointments,
  });
});

crmRouter.patch('/leads/:id', async (req, res) => {
  const input = updateCrmLeadSchema.parse(req.body);
  const workspaceId = wsId(req);
  const lead = await findLead(workspaceId, String(req.params.id));
  const data: Prisma.CrmLeadUpdateInput = {};
  if (input.phone !== undefined) {
    const phone = phoneOf(input.phone);
    if (phone !== lead.phone) {
      const clash = await prisma.crmLead.findUnique({
        where: { workspaceId_phone: { workspaceId, phone } },
        select: { id: true },
      });
      if (clash) throw badRequest('Another lead already has that number');
      data.phone = phone;
    }
  }
  if (input.name !== undefined) data.name = input.name || null;
  if (input.email !== undefined) data.email = input.email || null;
  if (input.company !== undefined) data.company = input.company || null;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.valueCents !== undefined) data.valueCents = input.valueCents;
  if (input.tags !== undefined) data.tags = parseTags(input.tags);
  if (input.ownerId !== undefined) {
    await assertOwner(workspaceId, input.ownerId);
    data.owner = input.ownerId ? { connect: { id: input.ownerId } } : { disconnect: true };
  }
  if (Object.keys(data).length) await prisma.crmLead.update({ where: { id: lead.id }, data });
  if (input.stageId && input.stageId !== lead.stageId) {
    await moveLead(lead, await findStage(workspaceId, input.stageId), { actorId: req.user?.id });
  }
  res.json({ lead: leadView(await findLead(workspaceId, lead.id)) });
});

crmRouter.delete('/leads/:id', async (req, res) => {
  const workspaceId = wsId(req);
  const lead = await findLead(workspaceId, String(req.params.id));
  await prisma.crmLead.delete({ where: { id: lead.id } });
  await audit(req, 'crm.lead_deleted', { entity: 'CrmLead', entityId: lead.id });
  res.json({ ok: true });
});

crmRouter.post('/leads/:id/notes', async (req, res) => {
  const { text } = crmNoteSchema.parse(req.body);
  const lead = await findLead(wsId(req), String(req.params.id));
  await addActivity(lead.id, 'note', text, { actorId: req.user?.id });
  res.status(201).json({ ok: true });
});

crmRouter.post('/leads/move', async (req, res) => {
  const input = crmMoveSchema.parse(req.body);
  const workspaceId = wsId(req);
  const stage = await findStage(workspaceId, input.stageId);
  const leads = await prisma.crmLead.findMany({
    where: { workspaceId, id: { in: input.leadIds } },
  });
  for (const lead of leads) await moveLead(lead, stage, { actorId: req.user?.id });
  res.json({ moved: leads.length });
});

crmRouter.post('/leads/delete', async (req, res) => {
  const input = crmBulkSchema.parse(req.body);
  const workspaceId = wsId(req);
  const { count } = await prisma.crmLead.deleteMany({
    where: { workspaceId, id: { in: input.leadIds } },
  });
  await audit(req, 'crm.leads_deleted', { meta: { count } });
  res.json({ deleted: count });
});

/**
 * Calls CRM leads with a campaign: picked leads or a whole stage, added to a
 * campaign that hasn't finished, or to a new draft (the subscriber reviews it
 * and confirms consent before starting).
 */
crmRouter.post('/leads/to-campaign', async (req, res) => {
  const input = crmToCampaignSchema.parse(req.body);
  const workspaceId = wsId(req);
  const ent = await entitlementsFor(req);
  if (!ent.active) throw badRequest('Choose a plan to call your leads');
  const leads = await prisma.crmLead.findMany({
    where: {
      workspaceId,
      ...(input.leadIds ? { id: { in: input.leadIds } } : { stageId: input.stageId }),
    },
  });
  if (!leads.length) throw badRequest('No leads to add');

  let campaign;
  if (input.campaignId) {
    campaign = await prisma.campaign.findFirst({ where: { id: input.campaignId, workspaceId } });
    if (!campaign) throw notFound('Campaign');
    if (campaign.status === 'COMPLETED' || campaign.status === 'CANCELED')
      throw badRequest('That campaign has finished. Create a new one to call these leads.');
  } else {
    const draft = input.newCampaign!;
    await assertWithinLimit(workspaceId, ent, 'campaigns');
    const [agent, number, workspace] = await Promise.all([
      prisma.agent.findFirst({ where: { id: draft.agentId, workspaceId } }),
      prisma.phoneNumber.findFirst({ where: { id: draft.phoneNumberId, workspaceId } }),
      prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }),
    ]);
    if (!agent) throw badRequest('Choose one of your agents');
    if (!number) throw badRequest('Choose one of your connected numbers');
    const { consentConfirmed: _consent, ...fields } = campaignSchema.parse({
      ...draft,
      timezone: isValidTimeZone(workspace.timezone) ? workspace.timezone : 'UTC',
    });
    campaign = await prisma.campaign.create({
      data: {
        ...fields,
        workspaceId,
        concurrency: Math.min(fields.concurrency, ent.limits.concurrentCalls),
      },
    });
    await audit(req, 'campaign.created', {
      entity: 'Campaign',
      entityId: campaign.id,
      meta: { from: 'crm' },
    });
  }

  const current = await prisma.campaignContact.count({ where: { campaignId: campaign.id } });
  await assertWithinLimit(workspaceId, ent, 'contactsPerCampaign', {
    current,
    adding: leads.length,
  });
  const result = await prisma.campaignContact.createMany({
    data: leads.map((l) => ({
      campaignId: campaign.id,
      workspaceId,
      phone: l.phone,
      name: l.name,
      email: l.email,
      company: l.company,
      notes: l.notes ? l.notes.slice(0, 1000) : null,
      tags: l.tags,
      fields: (l.fields ?? undefined) as Prisma.InputJsonValue | undefined,
    })),
    skipDuplicates: true,
  });
  const blocked = await applyDoNotCall(campaign.id, workspaceId);
  await prisma.crmActivity.createMany({
    data: leads.map((l) => ({
      leadId: l.id,
      type: 'campaign',
      text: `Added to the campaign "${campaign.name}"`,
      actorId: req.user?.id,
    })),
  });
  await audit(req, 'campaign.contacts_added', {
    entity: 'Campaign',
    entityId: campaign.id,
    meta: { added: result.count, from: 'crm' },
  });
  res.status(201).json({
    campaign: { id: campaign.id, name: campaign.name, status: campaign.status },
    added: result.count,
    duplicates: leads.length - result.count,
    doNotCall: blocked,
  });
});

/** Adds a campaign's contacts to the pipeline: picked ones, or all whose last call ended a given way. */
crmRouter.post('/leads/from-campaign', async (req, res) => {
  const input = crmFromCampaignSchema.parse(req.body);
  const workspaceId = wsId(req);
  const campaign = await prisma.campaign.findFirst({
    where: { id: input.campaignId, workspaceId },
  });
  if (!campaign) throw notFound('Campaign');
  if (input.stageId) await findStage(workspaceId, input.stageId);
  const contacts = await prisma.campaignContact.findMany({
    where: {
      campaignId: campaign.id,
      ...(input.contactIds
        ? { id: { in: input.contactIds } }
        : { lastOutcome: { in: input.outcomes } }),
    },
    take: 5000,
  });
  let added = 0;
  for (const c of contacts) {
    const { created } = await upsertLead(
      workspaceId,
      {
        phone: c.phone,
        name: c.name,
        email: c.email,
        company: c.company,
        tags: c.tags,
        fields: (c.fields as Record<string, unknown> | null) ?? null,
        campaignId: campaign.id,
      },
      {
        source: 'campaign',
        stageId: input.stageId,
        stageKey: input.stageId ? null : stageKeyForOutcome(c.lastOutcome, false, false),
        actorId: req.user?.id,
        activity: `Added from the campaign "${campaign.name}" by ${req.user?.name ?? 'the team'}`,
      },
    );
    if (created) added++;
  }
  await audit(req, 'crm.leads_from_campaign', {
    entity: 'Campaign',
    entityId: campaign.id,
    meta: { added, matched: contacts.length },
  });
  res.status(201).json({ added, alreadyInCrm: contacts.length - added });
});

// ── Stages ──────────────────────────────────────────────────────────────────

crmRouter.get('/stages', async (req, res) => {
  res.json({ stages: await stageViews(wsId(req)) });
});

crmRouter.post('/stages', async (req, res) => {
  const input = crmStageSchema.parse(req.body);
  const workspaceId = wsId(req);
  const stages = await ensureStages(workspaceId);
  if (stages.length >= 30) throw badRequest('A pipeline can have up to 30 stages');
  // New open stages go before Won and Lost; closed ones at the end.
  const firstClosed = stages.find((s) => s.kind !== 'OPEN');
  const position =
    input.kind === 'OPEN' && firstClosed
      ? firstClosed.position
      : (stages.at(-1)?.position ?? -1) + 1;
  await prisma.$transaction([
    prisma.crmStage.updateMany({
      where: { workspaceId, position: { gte: position } },
      data: { position: { increment: 1 } },
    }),
    prisma.crmStage.create({ data: { workspaceId, ...input, position } }),
  ]);
  res.status(201).json({ stages: await stageViews(workspaceId) });
});

crmRouter.patch('/stages/:id', async (req, res) => {
  const input = updateCrmStageSchema.parse(req.body);
  const workspaceId = wsId(req);
  const stage = await findStage(workspaceId, String(req.params.id));
  await prisma.crmStage.update({ where: { id: stage.id }, data: input });
  res.json({ stages: await stageViews(workspaceId) });
});

crmRouter.put('/stages/order', async (req, res) => {
  const { ids } = reorderCrmStagesSchema.parse(req.body);
  const workspaceId = wsId(req);
  const stages = await ensureStages(workspaceId);
  if (ids.length !== stages.length || !stages.every((s) => ids.includes(s.id)))
    throw badRequest('Send every stage once, in the new order');
  await prisma.$transaction(
    ids.map((id, position) => prisma.crmStage.update({ where: { id }, data: { position } })),
  );
  res.json({ stages: await stageViews(workspaceId) });
});

/** Deletes a stage; its leads move to `moveTo` (required when it has any). */
crmRouter.delete('/stages/:id', async (req, res) => {
  const workspaceId = wsId(req);
  const stage = await findStage(workspaceId, String(req.params.id));
  const stages = await ensureStages(workspaceId);
  if (stages.length <= 1) throw badRequest('A pipeline needs at least one stage');
  const count = await prisma.crmLead.count({ where: { stageId: stage.id } });
  if (count) {
    const moveTo = z
      .string()
      .optional()
      .parse(req.query.moveTo || undefined);
    if (!moveTo || moveTo === stage.id)
      throw badRequest(`Choose where this stage's ${count} lead${count > 1 ? 's go' : ' goes'}`);
    const target = await findStage(workspaceId, moveTo);
    await prisma.crmLead.updateMany({ where: { stageId: stage.id }, data: { stageId: target.id } });
  }
  await prisma.crmStage.delete({ where: { id: stage.id } });
  res.json({ stages: await stageViews(workspaceId) });
});

// ── Settings ────────────────────────────────────────────────────────────────

async function settingsView(workspaceId: string): Promise<CrmSettingsView> {
  const [s, workspace] = await Promise.all([
    getCrmSettings(workspaceId),
    prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { timezone: true },
    }),
  ]);
  return {
    autoAddOutcomes: s.autoAddOutcomes,
    autoAddInbound: s.autoAddInbound,
    instantCallEnabled: s.instantCallEnabled,
    instantAgentId: s.instantAgentId,
    instantNumberId: s.instantNumberId,
    instantWindowStart: s.instantWindowStart,
    instantWindowEnd: s.instantWindowEnd,
    whatsappLeads: s.whatsappLeads,
    whatsappReply: s.whatsappReply,
    metaAppSecretSet: !!s.metaAppSecretEnc,
    leadWebhookUrl: `${env.publicApiUrl}/api/hooks/leads/${s.hookToken}`,
    whatsappWebhookUrl: `${env.publicApiUrl}/api/hooks/whatsapp/${s.hookToken}`,
    verifyToken: s.hookToken,
    timezone: workspace.timezone,
  };
}

crmRouter.get('/settings', async (req, res) => {
  res.json({ settings: await settingsView(wsId(req)) });
});

crmRouter.put('/settings', async (req, res) => {
  const input = crmSettingsSchema.parse(req.body);
  const workspaceId = wsId(req);
  const current = await getCrmSettings(workspaceId);
  const agentId =
    input.instantAgentId !== undefined ? input.instantAgentId : current.instantAgentId;
  const numberId =
    input.instantNumberId !== undefined ? input.instantNumberId : current.instantNumberId;
  if (agentId && !(await prisma.agent.findFirst({ where: { id: agentId, workspaceId } })))
    throw badRequest('Choose one of your agents');
  if (numberId && !(await prisma.phoneNumber.findFirst({ where: { id: numberId, workspaceId } })))
    throw badRequest('Choose one of your connected numbers');
  const enabled = input.instantCallEnabled ?? current.instantCallEnabled;
  if (enabled && (!agentId || !numberId))
    throw badRequest('Choose the agent that calls new leads and the number it calls from');

  const { metaAppSecret, ...rest } = input;
  await prisma.crmSettings.update({
    where: { workspaceId },
    data: {
      ...rest,
      instantWindowStart: rest.instantWindowStart === '' ? null : rest.instantWindowStart,
      instantWindowEnd: rest.instantWindowEnd === '' ? null : rest.instantWindowEnd,
      ...(metaAppSecret ? { metaAppSecretEnc: encrypt(metaAppSecret) } : {}),
    },
  });
  await audit(req, 'crm.settings_updated', { meta: { instantCallEnabled: enabled } });
  res.json({ settings: await settingsView(workspaceId) });
});

/** New webhook URLs; the old ones stop working at once. */
crmRouter.post('/settings/rotate-token', async (req, res) => {
  const workspaceId = wsId(req);
  await getCrmSettings(workspaceId);
  await prisma.crmSettings.update({
    where: { workspaceId },
    data: { hookToken: randomToken(18) },
  });
  await audit(req, 'crm.hook_token_rotated');
  res.json({ settings: await settingsView(workspaceId) });
});

/** Clears the Meta app secret (signatures are no longer checked). */
crmRouter.delete('/settings/meta-app-secret', async (req, res) => {
  const workspaceId = wsId(req);
  await getCrmSettings(workspaceId);
  await prisma.crmSettings.update({ where: { workspaceId }, data: { metaAppSecretEnc: null } });
  res.json({ settings: await settingsView(workspaceId) });
});
