import { Router, type NextFunction, type Request, type Response } from 'express';
import { addContactsSchema, callFiltersSchema, contactSchema } from '@pv/shared';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { sha256 } from '../lib/crypto';
import { notFound, planLimit, unauthorized } from '../lib/http-error';
import { apiLimiter } from '../middleware/rate-limit';
import { getEntitlements, assertWithinLimit } from '../services/entitlements';
import { startOutboundCall } from '../services/calls';
import { toE164 } from '../lib/csv';

/**
 * Public developer API (Pro): /api/v1/*, authenticated with
 * `Authorization: Bearer pv_live_…`. Deliberately small and stable —
 * read calls and agents, add campaign contacts, place a call.
 */
export const developerApiRouter = Router();

async function apiKeyAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.header('authorization') ?? '';
  const key = header.startsWith('Bearer pv_live_') ? header.slice(7) : null;
  if (!key) throw unauthorized('Send your API key as: Authorization: Bearer pv_live_…');
  const row = await prisma.apiKey.findUnique({ where: { keyHash: sha256(key) } });
  if (!row || row.revokedAt) throw unauthorized('Invalid API key');
  const ent = await getEntitlements(row.workspaceId);
  if (!ent.active || !ent.features.developerApi)
    throw planLimit('The developer API requires an active Pro plan');
  req.workspaceId = row.workspaceId;
  req.apiKeyId = row.id;
  req.entitlements = ent;
  // Coarse last-used stamp; one write per key per minute at most.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    void prisma.apiKey
      .update({ where: { id: row.id }, data: { lastUsedAt: new Date() } })
      .catch(() => undefined);
  }
  next();
}

developerApiRouter.use(apiKeyAuth, apiLimiter);

developerApiRouter.get('/agents', async (req, res) => {
  const agents = await prisma.agent.findMany({
    where: { workspaceId: req.workspaceId },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
    },
  });
  res.json({ data: agents });
});

developerApiRouter.get('/calls', async (req, res) => {
  const f = callFiltersSchema.parse(req.query);
  const where = {
    workspaceId: req.workspaceId,
    agentId: f.agentId,
    campaignId: f.campaignId,
    direction: f.direction,
    outcome: f.outcome,
  };
  const [calls, total] = await Promise.all([
    prisma.call.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (f.page - 1) * f.pageSize,
      take: f.pageSize,
      select: {
        id: true,
        direction: true,
        status: true,
        fromNumber: true,
        toNumber: true,
        durationSec: true,
        outcome: true,
        sentiment: true,
        summary: true,
        agentId: true,
        campaignId: true,
        createdAt: true,
      },
    }),
    prisma.call.count({ where }),
  ]);
  res.json({ data: calls, total, page: f.page, pageSize: f.pageSize });
});

developerApiRouter.get('/calls/:id', async (req, res) => {
  const call = await prisma.call.findFirst({
    where: { id: req.params.id, workspaceId: req.workspaceId },
    include: { appointments: true },
  });
  if (!call) throw notFound('Call');
  res.json({ data: call });
});

developerApiRouter.post('/calls', async (req, res) => {
  const input = z
    .object({ agentId: z.string(), phoneNumberId: z.string(), to: contactSchema.shape.phone })
    .parse(req.body);
  const workspaceId = req.workspaceId!;
  const [agent, number] = await Promise.all([
    prisma.agent.findFirst({ where: { id: input.agentId, workspaceId, status: 'ACTIVE' } }),
    prisma.phoneNumber.findFirst({ where: { id: input.phoneNumberId, workspaceId } }),
  ]);
  if (!agent) throw notFound('Active agent');
  if (!number) throw notFound('Phone number');
  const call = await startOutboundCall({
    workspaceId,
    agentId: agent.id,
    phoneNumberId: number.id,
    to: input.to,
  });
  res.status(201).json({ data: { id: call.id, status: call.status } });
});

developerApiRouter.get('/campaigns', async (req, res) => {
  const campaigns = await prisma.campaign.findMany({
    where: { workspaceId: req.workspaceId },
    select: {
      id: true,
      name: true,
      status: true,
      agentId: true,
      phoneNumberId: true,
      createdAt: true,
    },
  });
  res.json({ data: campaigns });
});

developerApiRouter.post('/campaigns/:id/contacts', async (req, res) => {
  const { contacts } = addContactsSchema.parse(req.body);
  const workspaceId = req.workspaceId!;
  const campaign = await prisma.campaign.findFirst({ where: { id: req.params.id, workspaceId } });
  if (!campaign) throw notFound('Campaign');
  const valid = (contacts ?? [])
    .map((c) => contactSchema.safeParse({ ...c, phone: toE164(String(c.phone ?? '')) ?? '' }))
    .filter((r) => r.success)
    .map((r) => r.data!);
  const current = await prisma.campaignContact.count({ where: { campaignId: campaign.id } });
  await assertWithinLimit(workspaceId, req.entitlements!, 'contactsPerCampaign', {
    current,
    adding: valid.length,
  });
  const result = await prisma.campaignContact.createMany({
    data: valid.map((c) => ({
      campaignId: campaign.id,
      workspaceId,
      phone: c.phone,
      name: c.name,
      email: c.email || null,
      company: c.company,
      notes: c.notes,
    })),
    skipDuplicates: true,
  });
  res
    .status(201)
    .json({ data: { added: result.count, rejected: (contacts?.length ?? 0) - valid.length } });
});
