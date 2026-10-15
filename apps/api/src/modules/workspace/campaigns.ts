import { Router } from 'express';
import {
  addContactsSchema,
  campaignSchema,
  contactSchema,
  paginationSchema,
  updateCampaignSchema,
} from '@pv/shared';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/http-error';
import { parseCsv, toE164 } from '../../lib/csv';
import { wsId } from '../../middleware/workspace';
import { entitlementsFor, requireActiveSubscription } from '../../middleware/entitlements';
import { assertWithinLimit } from '../../services/entitlements';

export const campaignsRouter = Router();

const KNOWN_COLUMNS = new Set(['phone', 'phone_number', 'number', 'mobile', 'name', 'full_name', 'email', 'company', 'notes']);

async function findCampaign(workspaceId: string, id: string) {
  const campaign = await prisma.campaign.findFirst({ where: { id, workspaceId } });
  if (!campaign) throw notFound('Campaign');
  return campaign;
}

async function assertRefs(workspaceId: string, agentId?: string, phoneNumberId?: string) {
  if (agentId && !(await prisma.agent.findFirst({ where: { id: agentId, workspaceId } }))) {
    throw badRequest('Choose one of your agents');
  }
  if (phoneNumberId && !(await prisma.phoneNumber.findFirst({ where: { id: phoneNumberId, workspaceId } }))) {
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
    data: { ...input, workspaceId, concurrency: Math.min(input.concurrency, ent.limits.concurrentCalls) },
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
    },
  });
  if (!campaign) throw notFound('Campaign');
  const [byStatus, byOutcome, minutes] = await Promise.all([
    prisma.campaignContact.groupBy({ by: ['status'], where: { campaignId: campaign.id }, _count: { _all: true } }),
    prisma.call.groupBy({ by: ['outcome'], where: { campaignId: campaign.id }, _count: { _all: true } }),
    prisma.call.aggregate({ where: { campaignId: campaign.id }, _sum: { billedMinutes: true }, _count: { _all: true } }),
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
      concurrency: input.concurrency ? Math.min(input.concurrency, ent.limits.concurrentCalls) : undefined,
    },
  });
  res.json({ campaign: updated });
});

campaignsRouter.delete('/:id', async (req, res) => {
  const campaign = await findCampaign(wsId(req), req.params.id);
  if (campaign.status === 'RUNNING') throw badRequest('Pause or cancel the campaign before deleting it');
  await prisma.campaign.delete({ where: { id: campaign.id } });
  await audit(req, 'campaign.deleted', { entity: 'Campaign', entityId: campaign.id });
  res.json({ ok: true });
});

// ── Contacts ────────────────────────────────────────────────────────────────

campaignsRouter.get('/:id/contacts', async (req, res) => {
  const workspaceId = wsId(req);
  const campaign = await findCampaign(workspaceId, req.params.id);
  const { page, pageSize, q } = paginationSchema.parse(req.query);
  const status = z.enum(['PENDING', 'CALLING', 'COMPLETED', 'FAILED', 'NO_ANSWER', 'DO_NOT_CALL']).optional().parse(req.query.status || undefined);
  const where: Prisma.CampaignContactWhereInput = {
    campaignId: campaign.id,
    ...(status ? { status } : {}),
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
  if (!rows.length) throw badRequest('No contacts found. CSV files need a header row with a "phone" column.');

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
    if (!parsed.success) return invalid.push({ row: idx + 2, reason: parsed.error.issues[0]?.message ?? 'Invalid' });
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
      fields: Object.keys(extra).length ? (extra as Prisma.InputJsonValue) : undefined,
    });
  });

  const current = await prisma.campaignContact.count({ where: { campaignId: campaign.id } });
  await assertWithinLimit(workspaceId, await entitlementsFor(req), 'contactsPerCampaign', {
    current,
    adding: valid.length,
  });

  const result = await prisma.campaignContact.createMany({ data: valid, skipDuplicates: true });
  await audit(req, 'campaign.contacts_added', { entity: 'Campaign', entityId: campaign.id, meta: { added: result.count } });
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
  if (!['DRAFT', 'PAUSED'].includes(campaign.status)) throw badRequest(`Campaign is ${campaign.status.toLowerCase()}`);
  if (campaign.agent.status !== 'ACTIVE') throw badRequest(`Activate the agent "${campaign.agent.name}" first`);
  if (!campaign.phoneNumber.routingConfigured) {
    throw badRequest('The caller number is not connected to Purple Voice yet. Re-sync it under Phone numbers.');
  }
  const pending = await prisma.campaignContact.count({ where: { campaignId: campaign.id, status: 'PENDING' } });
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
  const updated = await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'PAUSED' } });
  await audit(req, 'campaign.paused', { entity: 'Campaign', entityId: campaign.id });
  res.json({ campaign: updated });
});

campaignsRouter.post('/:id/cancel', async (req, res) => {
  const campaign = await findCampaign(wsId(req), req.params.id);
  if (['COMPLETED', 'CANCELED'].includes(campaign.status)) throw badRequest('Campaign already finished');
  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: 'CANCELED', completedAt: new Date() },
  });
  await audit(req, 'campaign.canceled', { entity: 'Campaign', entityId: campaign.id });
  res.json({ campaign: updated });
});
