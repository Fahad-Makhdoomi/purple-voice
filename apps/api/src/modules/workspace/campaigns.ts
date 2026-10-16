import { Router } from 'express';
import {
  addContactsSchema,
  campaignSchema,
  contactSchema,
  FOLLOW_UP_SEGMENT_INFO,
  followUpSchema,
  matchesFollowUp,
  paginationSchema,
  parseTags,
  updateCampaignSchema,
  updateContactSchema,
} from '@pv/shared';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/http-error';
import { parseCsv, toE164 } from '../../lib/csv';
import { wsId } from '../../middleware/workspace';
import {
  entitlementsFor,
  requireActiveSubscription,
  requireFeature,
} from '../../middleware/entitlements';
import { assertWithinLimit } from '../../services/entitlements';
import { computeCampaignAnalytics } from '../../services/campaign-analytics';
import { buildCampaignDigest, generateCampaignReport } from '../../services/ai/campaign-report';
import { describe, isValidTimeZone } from '../../voice/time';

export const campaignsRouter = Router();

const KNOWN_COLUMNS = new Set([
  'phone',
  'phone_number',
  'number',
  'mobile',
  'name',
  'full_name',
  'email',
  'company',
  'notes',
  'tags',
]);

async function findCampaign(workspaceId: string, id: string) {
  const campaign = await prisma.campaign.findFirst({ where: { id, workspaceId } });
  if (!campaign) throw notFound('Campaign');
  return campaign;
}

async function assertRefs(workspaceId: string, agentId?: string, phoneNumberId?: string) {
  if (agentId && !(await prisma.agent.findFirst({ where: { id: agentId, workspaceId } }))) {
    throw badRequest('Choose one of your agents');
  }
  if (
    phoneNumberId &&
    !(await prisma.phoneNumber.findFirst({ where: { id: phoneNumberId, workspaceId } }))
  ) {
    throw badRequest('Choose one of your connected numbers');
  }
}

campaignsRouter.get('/', async (req, res) => {
  const workspaceId = wsId(req);
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    include: {
      agent: { select: { id: true, name: true } },
      phoneNumber: { select: { id: true, e164: true } },
    },
  });
  const counts = await prisma.campaignContact.groupBy({
    by: ['campaignId', 'status'],
    where: { workspaceId },
    _count: { _all: true },
  });
  res.json({
    campaigns: campaigns.map((c) => {
      const mine = counts.filter((x) => x.campaignId === c.id);
      const total = mine.reduce((n, x) => n + x._count._all, 0);
      const done = mine
        .filter((x) => !['PENDING', 'CALLING'].includes(x.status))
        .reduce((n, x) => n + x._count._all, 0);
      return { ...c, contactCount: total, completedCount: done };
    }),
  });
});

campaignsRouter.post('/', requireActiveSubscription, async (req, res) => {
  const input = campaignSchema.parse(req.body);
  const workspaceId = wsId(req);
  const ent = await entitlementsFor(req);
  await assertWithinLimit(workspaceId, ent, 'campaigns');
  await assertRefs(workspaceId, input.agentId, input.phoneNumberId);
  const campaign = await prisma.campaign.create({
    data: {
      ...input,
      workspaceId,
      concurrency: Math.min(input.concurrency, ent.limits.concurrentCalls),
    },
  });
  await audit(req, 'campaign.created', { entity: 'Campaign', entityId: campaign.id });
  res.status(201).json({ campaign });
});

campaignsRouter.get('/:id', async (req, res) => {
  const workspaceId = wsId(req);
  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id, workspaceId },
    include: {
      agent: { select: { id: true, name: true, status: true } },
      phoneNumber: { select: { id: true, e164: true, routingConfigured: true } },
      parentCampaign: { select: { id: true, name: true } },
      followUps: {
        select: { id: true, name: true, status: true, followUpSegments: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!campaign) throw notFound('Campaign');
  const [byStatus, byOutcome, minutes] = await Promise.all([
    prisma.campaignContact.groupBy({
      by: ['status'],
      where: { campaignId: campaign.id },
      _count: { _all: true },
    }),
    prisma.call.groupBy({
      by: ['outcome'],
      where: { campaignId: campaign.id },
      _count: { _all: true },
    }),
    prisma.call.aggregate({
      where: { campaignId: campaign.id },
      _sum: { billedMinutes: true },
      _count: { _all: true },
    }),
  ]);
  res.json({
    campaign,
    stats: {
      contacts: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      outcomes: Object.fromEntries(byOutcome.map((s) => [s.outcome ?? 'NONE', s._count._all])),
      calls: minutes._count._all,
      minutes: minutes._sum.billedMinutes ?? 0,
    },
  });
});

campaignsRouter.patch('/:id', async (req, res) => {
  const input = updateCampaignSchema.parse(req.body);
  const workspaceId = wsId(req);
  const campaign = await findCampaign(workspaceId, req.params.id);
  await assertRefs(workspaceId, input.agentId, input.phoneNumberId);
  const start = input.callWindowStart ?? campaign.callWindowStart;
  const end = input.callWindowEnd ?? campaign.callWindowEnd;
  if (start >= end) throw badRequest('Call window must end after it starts');
  const ent = await entitlementsFor(req);
  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      ...input,
      concurrency: input.concurrency
        ? Math.min(input.concurrency, ent.limits.concurrentCalls)
        : undefined,
    },
  });
  res.json({ campaign: updated });
});

campaignsRouter.delete('/:id', async (req, res) => {
  const campaign = await findCampaign(wsId(req), req.params.id);
  if (campaign.status === 'RUNNING')
    throw badRequest('Pause or cancel the campaign before deleting it');
  await prisma.campaign.delete({ where: { id: campaign.id } });
  await audit(req, 'campaign.deleted', { entity: 'Campaign', entityId: campaign.id });
  res.json({ ok: true });
});

// ── Contacts ────────────────────────────────────────────────────────────────

campaignsRouter.get('/:id/contacts', async (req, res) => {
  const workspaceId = wsId(req);
  const campaign = await findCampaign(workspaceId, req.params.id);
  const { page, pageSize, q } = paginationSchema.parse(req.query);
  const status = z
    .enum(['PENDING', 'CALLING', 'COMPLETED', 'FAILED', 'NO_ANSWER', 'DO_NOT_CALL'])
    .optional()
    .parse(req.query.status || undefined);
  const tag = parseTags(String(req.query.tag ?? ''))[0];
  const where: Prisma.CampaignContactWhereInput = {
    campaignId: campaign.id,
    ...(status ? { status } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(q
      ? {
          OR: [
            { phone: { contains: q } },
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [contacts, total] = await Promise.all([
    prisma.campaignContact.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.campaignContact.count({ where }),
  ]);
  res.json({ contacts, total, page, pageSize });
});

campaignsRouter.post('/:id/contacts', requireActiveSubscription, async (req, res) => {
  const input = addContactsSchema.parse(req.body);
  const workspaceId = wsId(req);
  const campaign = await findCampaign(workspaceId, String(req.params.id));
  if (campaign.status === 'COMPLETED' || campaign.status === 'CANCELED') {
    throw badRequest('This campaign has finished. Create a new one to call more contacts.');
  }

  const rows: Record<string, unknown>[] = input.csv ? parseCsv(input.csv) : (input.contacts ?? []);
  if (!rows.length)
    throw badRequest('No contacts found. CSV files need a header row with a "phone" column.');

  const seen = new Set<string>();
  const valid: Prisma.CampaignContactCreateManyInput[] = [];
  const invalid: Array<{ row: number; reason: string }> = [];

  rows.forEach((row, idx) => {
    const rawPhone = String(row.phone ?? row.phone_number ?? row.number ?? row.mobile ?? '');
    const phone = toE164(rawPhone);
    if (!phone) return invalid.push({ row: idx + 2, reason: `Invalid phone "${rawPhone}"` });
    if (seen.has(phone)) return;
    seen.add(phone);
    const parsed = contactSchema.safeParse({
      phone,
      name: (row.name ?? row.full_name) || undefined,
      email: row.email || undefined,
      company: row.company || undefined,
      notes: row.notes || undefined,
    });
    if (!parsed.success)
      return invalid.push({ row: idx + 2, reason: parsed.error.issues[0]?.message ?? 'Invalid' });
    const tags = parseTags([...(input.tags ?? []), ...parseTags(String(row.tags ?? ''))]);
    const extra = Object.fromEntries(
      Object.entries(row).filter(([k, v]) => !KNOWN_COLUMNS.has(k) && v !== '' && v !== undefined),
    );
    valid.push({
      campaignId: campaign.id,
      workspaceId,
      phone,
      name: parsed.data.name,
      email: parsed.data.email || null,
      company: parsed.data.company,
      notes: parsed.data.notes,
      tags,
      fields: Object.keys(extra).length ? (extra as Prisma.InputJsonValue) : undefined,
    });
  });

  const current = await prisma.campaignContact.count({ where: { campaignId: campaign.id } });
  await assertWithinLimit(workspaceId, await entitlementsFor(req), 'contactsPerCampaign', {
    current,
    adding: valid.length,
  });

  const result = await prisma.campaignContact.createMany({ data: valid, skipDuplicates: true });
  await audit(req, 'campaign.contacts_added', {
    entity: 'Campaign',
    entityId: campaign.id,
    meta: { added: result.count },
  });
  res.status(201).json({
    added: result.count,
    duplicates: valid.length - result.count,
    invalid: invalid.slice(0, 100),
    invalidCount: invalid.length,
  });
});

campaignsRouter.delete('/:id/contacts/:contactId', async (req, res) => {
  const workspaceId = wsId(req);
  const campaign = await findCampaign(workspaceId, req.params.id);
  const result = await prisma.campaignContact.deleteMany({
    where: { id: req.params.contactId, campaignId: campaign.id, status: { not: 'CALLING' } },
  });
  if (!result.count) throw badRequest('Contact not found or currently on a call');
  res.json({ ok: true });
});

// ── Lifecycle ───────────────────────────────────────────────────────────────

campaignsRouter.post('/:id/start', requireActiveSubscription, async (req, res) => {
  const workspaceId = wsId(req);
  const campaign = await prisma.campaign.findFirst({
    where: { id: String(req.params.id), workspaceId },
    include: { agent: true, phoneNumber: true },
  });
  if (!campaign) throw notFound('Campaign');
  if (!['DRAFT', 'PAUSED'].includes(campaign.status))
    throw badRequest(`Campaign is ${campaign.status.toLowerCase()}`);
  if (campaign.agent.status !== 'ACTIVE')
    throw badRequest(`Activate the agent "${campaign.agent.name}" first`);
  if (!campaign.phoneNumber.routingConfigured) {
    throw badRequest(
      'The caller number is not connected to Purple Voice yet. Re-sync it under Phone numbers.',
    );
  }
  const pending = await prisma.campaignContact.count({
    where: { campaignId: campaign.id, status: 'PENDING' },
  });
  if (!pending) throw badRequest('Add contacts before starting');

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: 'RUNNING', startedAt: campaign.startedAt ?? new Date() },
  });
  await audit(req, 'campaign.started', { entity: 'Campaign', entityId: campaign.id });
  res.json({ campaign: updated });
});

campaignsRouter.post('/:id/pause', async (req, res) => {
  const campaign = await findCampaign(wsId(req), req.params.id);
  if (campaign.status !== 'RUNNING') throw badRequest('Only running campaigns can be paused');
  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: 'PAUSED' },
  });
  await audit(req, 'campaign.paused', { entity: 'Campaign', entityId: campaign.id });
  res.json({ campaign: updated });
});

campaignsRouter.post('/:id/cancel', async (req, res) => {
  const campaign = await findCampaign(wsId(req), req.params.id);
  if (['COMPLETED', 'CANCELED'].includes(campaign.status))
    throw badRequest('Campaign already finished');
  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: 'CANCELED', completedAt: new Date() },
  });
  await audit(req, 'campaign.canceled', { entity: 'Campaign', entityId: campaign.id });
  res.json({ campaign: updated });
});

// ── Editing contacts ────────────────────────────────────────────────────────

campaignsRouter.get('/:id/tags', async (req, res) => {
  const campaign = await findCampaign(wsId(req), req.params.id);
  const rows = await prisma.$queryRaw<Array<{ tag: string; n: bigint }>>`
    SELECT t AS tag, count(*) AS n FROM "CampaignContact", unnest(tags) AS t
    WHERE "campaignId" = ${campaign.id} GROUP BY t ORDER BY n DESC, t LIMIT 100`;
  res.json({ tags: rows.map((r) => ({ tag: r.tag, count: Number(r.n) })) });
});

campaignsRouter.patch('/:id/contacts/:contactId', async (req, res) => {
  const input = updateContactSchema.parse(req.body);
  const campaign = await findCampaign(wsId(req), req.params.id);
  const contact = await prisma.campaignContact.findFirst({
    where: { id: req.params.contactId, campaignId: campaign.id },
  });
  if (!contact) throw notFound('Contact');
  if (contact.status === 'CALLING') throw badRequest('This contact is on a call right now');

  const data: Prisma.CampaignContactUpdateInput = {};
  if (input.phone !== undefined) {
    const phone = toE164(input.phone);
    if (!phone) throw badRequest(`Invalid phone "${input.phone}"`);
    if (phone !== contact.phone) {
      if (campaign.status === 'COMPLETED' || campaign.status === 'CANCELED')
        throw badRequest('This campaign has finished, so numbers can no longer change.');
      // A different number is a different person to the dialer: start them afresh.
      data.phone = phone;
      data.status = 'PENDING';
      data.attempts = 0;
      data.nextAttemptAt = null;
      data.lastAttemptAt = null;
      data.lastOutcome = null;
    }
  }
  if (input.name !== undefined) data.name = input.name || null;
  if (input.email !== undefined) data.email = input.email || null;
  if (input.company !== undefined) data.company = input.company || null;
  if (input.notes !== undefined) data.notes = input.notes || null;
  if (input.tags !== undefined) data.tags = input.tags;

  try {
    const updated = await prisma.campaignContact.update({ where: { id: contact.id }, data });
    res.json({ contact: updated });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002')
      throw badRequest('Another contact in this campaign already has that number');
    throw err;
  }
});

// ── Analytics ───────────────────────────────────────────────────────────────

async function loadAnalytics(campaign: { id: string; timezone: string }) {
  const [contacts, calls] = await Promise.all([
    prisma.campaignContact.findMany({
      where: { campaignId: campaign.id },
      select: { id: true, status: true, attempts: true, lastOutcome: true },
    }),
    prisma.call.findMany({
      where: { campaignId: campaign.id },
      select: {
        contactId: true,
        status: true,
        createdAt: true,
        startedAt: true,
        answeredAt: true,
        durationSec: true,
        billedMinutes: true,
        outcome: true,
        sentiment: true,
      },
    }),
  ]);
  return computeCampaignAnalytics(contacts, calls, campaign.timezone);
}

campaignsRouter.get('/:id/analytics', async (req, res) => {
  const campaign = await findCampaign(wsId(req), req.params.id);
  res.json({ analytics: await loadAnalytics(campaign) });
});

/** Summaries of up to 8 recent calls per outcome (60 in all), so the sample shows every kind of result. */
async function sampleSummaries(campaignId: string) {
  const calls = await prisma.call.findMany({
    where: { campaignId, summary: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: 600,
    select: { outcome: true, sentiment: true, durationSec: true, summary: true },
  });
  const perOutcome = new Map<string, number>();
  const picked: Array<{
    outcome: string | null;
    sentiment: number | null;
    durationSec: number;
    summary: string;
  }> = [];
  for (const c of calls) {
    const key = c.outcome ?? 'NONE';
    const n = perOutcome.get(key) ?? 0;
    if (n >= 8 || picked.length >= 60 || !c.summary) continue;
    perOutcome.set(key, n + 1);
    picked.push({ ...c, summary: c.summary });
  }
  return picked;
}

async function digestFor(workspaceId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirstOrThrow({
    where: { id: campaignId, workspaceId },
    include: {
      agent: { select: { name: true, goal: true, systemPrompt: true, greeting: true } },
    },
  });
  const [analytics, samples] = await Promise.all([
    loadAnalytics(campaign),
    sampleSummaries(campaign.id),
  ]);
  return {
    analytics,
    text: buildCampaignDigest({ campaign, agent: campaign.agent, analytics, samples }),
  };
}

/** The campaign as plain text, ready to paste into any AI assistant. */
campaignsRouter.get('/:id/summary', async (req, res) => {
  const workspaceId = wsId(req);
  const campaign = await findCampaign(workspaceId, req.params.id);
  const { text } = await digestFor(workspaceId, campaign.id);
  res.json({ summary: text });
});

campaignsRouter.post('/:id/ai-report', requireFeature('callSummary'), async (req, res) => {
  const workspaceId = wsId(req);
  const campaign = await findCampaign(workspaceId, String(req.params.id));
  if (!['COMPLETED', 'CANCELED', 'PAUSED'].includes(campaign.status))
    throw badRequest('Analyse a campaign once it has finished (or is paused).');
  const { analytics, text } = await digestFor(workspaceId, campaign.id);
  if (analytics.totals.calls === 0) throw badRequest('This campaign has no calls to analyse yet.');
  const report = await generateCampaignReport(workspaceId, text);
  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { aiReport: report as unknown as Prisma.InputJsonValue, aiReportAt: new Date() },
    select: { aiReport: true, aiReportAt: true },
  });
  await audit(req, 'campaign.ai_report', { entity: 'Campaign', entityId: campaign.id });
  res.json(updated);
});

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  // A leading = + - @ makes spreadsheets run the cell as a formula; neutralise it.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

campaignsRouter.get('/:id/export', async (req, res) => {
  const campaign = await findCampaign(wsId(req), req.params.id);
  const contacts = await prisma.campaignContact.findMany({
    where: { campaignId: campaign.id },
    orderBy: { createdAt: 'asc' },
  });
  const header = [
    'phone',
    'name',
    'email',
    'company',
    'tags',
    'status',
    'attempts',
    'last_outcome',
    'last_call',
    'notes',
  ];
  const rows = contacts.map((c) =>
    [
      c.phone,
      c.name,
      c.email,
      c.company,
      c.tags.join(';'),
      c.status,
      c.attempts,
      c.lastOutcome,
      c.lastAttemptAt?.toISOString(),
      c.notes,
    ]
      .map(csvCell)
      .join(','),
  );
  const filename = `${campaign.name.replace(/[^\w-]+/g, '-').slice(0, 60) || 'campaign'}-contacts.csv`;
  res
    .type('text/csv')
    .setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    .send([header.join(','), ...rows].join('\r\n'));
});

// ── Follow-up campaigns ─────────────────────────────────────────────────────

type Segments = Parameters<typeof matchesFollowUp>[1];

/** How many people a choice of groups and tags would call. */
campaignsRouter.get('/:id/follow-up/preview', async (req, res) => {
  const campaign = await findCampaign(wsId(req), req.params.id);
  const all = await prisma.campaignContact.findMany({
    where: { campaignId: campaign.id },
    select: { status: true, lastOutcome: true, tags: true },
  });
  const segments = String(req.query.segments ?? '')
    .split(',')
    .filter((s): s is Segments[number] => s in FOLLOW_UP_SEGMENT_INFO);
  const tags = parseTags(String(req.query.tags ?? ''));
  res.json({
    selected:
      segments.length || tags.length
        ? all.filter((c) => matchesFollowUp(c, segments, tags)).length
        : 0,
  });
});

campaignsRouter.post('/:id/follow-up', requireActiveSubscription, async (req, res) => {
  const input = followUpSchema.parse(req.body);
  const workspaceId = wsId(req);
  const parent = await findCampaign(workspaceId, String(req.params.id));
  if (!['COMPLETED', 'CANCELED'].includes(parent.status))
    throw badRequest('Finish or cancel this campaign before creating a follow-up from it.');

  const agentId = input.agentId ?? parent.agentId;
  const phoneNumberId = input.phoneNumberId ?? parent.phoneNumberId;
  await assertRefs(workspaceId, agentId, phoneNumberId);

  const people = (
    await prisma.campaignContact.findMany({ where: { campaignId: parent.id } })
  ).filter((c) => matchesFollowUp(c, input.segments, input.tags));
  if (!people.length) throw badRequest('No contacts match those groups and tags.');
  const ent = await entitlementsFor(req);
  await assertWithinLimit(workspaceId, ent, 'campaigns');
  await assertWithinLimit(workspaceId, ent, 'contactsPerCampaign', {
    current: 0,
    adding: people.length,
  });

  // What the agent needs to open the call properly: how the last call went and, for
  // booked appointments, when it is. Both become {{variables}} in its script.
  const calls = await prisma.call.findMany({
    where: { campaignId: parent.id, contactId: { in: people.map((p) => p.id) } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, contactId: true, summary: true },
  });
  const appointments = await prisma.appointment.findMany({
    where: { callId: { in: calls.map((c) => c.id) }, status: 'SCHEDULED' },
    orderBy: { startsAt: 'asc' },
    select: { callId: true, startsAt: true, timezone: true },
  });
  const lastSummary = new Map<string, string>();
  const callContact = new Map<string, string>();
  for (const c of calls) {
    if (!c.contactId) continue;
    callContact.set(c.id, c.contactId);
    if (c.summary) lastSummary.set(c.contactId, c.summary);
  }
  const appointmentTime = new Map<string, string>();
  for (const a of appointments) {
    const contactId = a.callId ? callContact.get(a.callId) : undefined;
    if (!contactId || appointmentTime.has(contactId)) continue;
    const zone = isValidTimeZone(a.timezone) ? a.timezone : 'UTC';
    appointmentTime.set(contactId, `${describe(a.startsAt, zone)} (${zone})`);
  }

  const goal =
    input.goal ??
    (input.segments.length === 1 ? FOLLOW_UP_SEGMENT_INFO[input.segments[0]!].goal : parent.goal);
  const campaign = await prisma.$transaction(async (tx) => {
    const created = await tx.campaign.create({
      data: {
        workspaceId,
        name: input.name,
        agentId,
        phoneNumberId,
        goal,
        timezone: parent.timezone,
        callWindowStart: parent.callWindowStart,
        callWindowEnd: parent.callWindowEnd,
        callDays: parent.callDays,
        maxAttempts: input.maxAttempts ?? parent.maxAttempts,
        retryDelayMinutes: input.retryDelayMinutes ?? parent.retryDelayMinutes,
        concurrency: Math.min(parent.concurrency, ent.limits.concurrentCalls),
        callDelaySeconds: parent.callDelaySeconds,
        parentCampaignId: parent.id,
        followUpSegments: input.segments,
      },
    });
    await tx.campaignContact.createMany({
      data: people.map((p) => ({
        campaignId: created.id,
        workspaceId,
        phone: p.phone,
        name: p.name,
        email: p.email,
        company: p.company,
        notes: p.notes,
        tags: p.tags,
        fields: {
          ...((p.fields as Record<string, unknown> | null) ?? {}),
          previous_outcome: p.lastOutcome
            ? p.lastOutcome.toLowerCase().replace(/_/g, ' ')
            : 'no answer',
          previous_attempts: p.attempts,
          ...(lastSummary.has(p.id) ? { previous_call_summary: lastSummary.get(p.id) } : {}),
          ...(appointmentTime.has(p.id) ? { appointment_time: appointmentTime.get(p.id) } : {}),
        } as Prisma.InputJsonValue,
      })),
    });
    return created;
  });
  await audit(req, 'campaign.follow_up_created', {
    entity: 'Campaign',
    entityId: campaign.id,
    meta: { parent: parent.id, contacts: people.length, segments: input.segments },
  });
  res.status(201).json({ campaign, contacts: people.length });
});
