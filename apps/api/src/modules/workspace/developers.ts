import { Router } from 'express';
import {
  apiKeySchema,
  automationSchema,
  updateAutomationSchema,
  updateWebhookEndpointSchema,
  webhookEndpointSchema,
} from '@pv/shared';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { encrypt, randomToken, sha256 } from '../../lib/crypto';
import { audit } from '../../lib/audit';
import { notFound } from '../../lib/http-error';
import { assertPublicUrl } from '../../lib/ssrf';
import { wsId } from '../../middleware/workspace';
import { entitlementsFor, requireFeature } from '../../middleware/entitlements';
import { assertWithinLimit } from '../../services/entitlements';

/** Pro developer tools: webhook endpoints, API keys and automation rules. */
export const developersRouter = Router();

// ── Webhooks ────────────────────────────────────────────────────────────────

const webhooks = Router();
webhooks.use(requireFeature('webhooks'));

webhooks.get('/', async (req, res) => {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { workspaceId: wsId(req) },
    orderBy: { createdAt: 'desc' },
    select: { id: true, url: true, description: true, events: true, active: true, createdAt: true },
  });
  res.json({ endpoints });
});

webhooks.post('/', async (req, res) => {
  const input = webhookEndpointSchema.parse(req.body);
  const workspaceId = wsId(req);
  await assertWithinLimit(workspaceId, await entitlementsFor(req), 'webhooks');
  await assertPublicUrl(input.url);
  const secret = `whsec_${randomToken(24)}`;
  const endpoint = await prisma.webhookEndpoint.create({
    data: { ...input, workspaceId, secretEnc: encrypt(secret) },
  });
  await audit(req, 'webhook.created', { entity: 'WebhookEndpoint', entityId: endpoint.id });
  // The signing secret is shown once, now.
  res.status(201).json({ endpoint: { id: endpoint.id, url: endpoint.url, events: endpoint.events }, secret });
});

webhooks.patch('/:id', async (req, res) => {
  const input = updateWebhookEndpointSchema.parse(req.body);
  if (input.url) await assertPublicUrl(input.url);
  const result = await prisma.webhookEndpoint.updateMany({
    where: { id: req.params.id, workspaceId: wsId(req) },
    data: input,
  });
  if (!result.count) throw notFound('Webhook endpoint');
  res.json({ ok: true });
});

webhooks.post('/:id/rotate-secret', async (req, res) => {
  const secret = `whsec_${randomToken(24)}`;
  const result = await prisma.webhookEndpoint.updateMany({
    where: { id: req.params.id, workspaceId: wsId(req) },
    data: { secretEnc: encrypt(secret) },
  });
  if (!result.count) throw notFound('Webhook endpoint');
  res.json({ secret });
});

webhooks.delete('/:id', async (req, res) => {
  const result = await prisma.webhookEndpoint.deleteMany({ where: { id: req.params.id, workspaceId: wsId(req) } });
  if (!result.count) throw notFound('Webhook endpoint');
  res.json({ ok: true });
});

webhooks.post('/:id/test', async (req, res) => {
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: req.params.id, workspaceId: wsId(req) } });
  if (!endpoint) throw notFound('Webhook endpoint');
  const delivery = await prisma.webhookDelivery.create({
    data: {
      endpointId: endpoint.id,
      event: 'test.ping',
      payload: {
        id: `evt_${randomToken(12)}`,
        type: 'test.ping',
        createdAt: new Date().toISOString(),
        workspaceId: endpoint.workspaceId,
        data: { message: 'Hello from Purple Voice' },
      } as Prisma.InputJsonValue,
    },
  });
  res.status(202).json({ deliveryId: delivery.id });
});

webhooks.get('/:id/deliveries', async (req, res) => {
  const endpoint = await prisma.webhookEndpoint.findFirst({ where: { id: req.params.id, workspaceId: wsId(req) } });
  if (!endpoint) throw notFound('Webhook endpoint');
  const deliveries = await prisma.webhookDelivery.findMany({
    where: { endpointId: endpoint.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      event: true,
      status: true,
      attempts: true,
      responseStatus: true,
      lastError: true,
      createdAt: true,
      deliveredAt: true,
    },
  });
  res.json({ deliveries });
});

developersRouter.use('/webhooks', webhooks);

// ── API keys ────────────────────────────────────────────────────────────────

const apiKeys = Router();
apiKeys.use(requireFeature('developerApi'));

apiKeys.get('/', async (req, res) => {
  const keys = await prisma.apiKey.findMany({
    where: { workspaceId: wsId(req), revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
  });
  res.json({ keys });
});

apiKeys.post('/', async (req, res) => {
  const { name } = apiKeySchema.parse(req.body);
  const workspaceId = wsId(req);
  await assertWithinLimit(workspaceId, await entitlementsFor(req), 'apiKeys');
  const key = `pv_live_${randomToken(30)}`;
  const row = await prisma.apiKey.create({
    data: { workspaceId, name, prefix: key.slice(0, 14), keyHash: sha256(key) },
  });
  await audit(req, 'api_key.created', { entity: 'ApiKey', entityId: row.id });
  res.status(201).json({ key, id: row.id, prefix: row.prefix });
});

apiKeys.delete('/:id', async (req, res) => {
  const result = await prisma.apiKey.updateMany({
    where: { id: req.params.id, workspaceId: wsId(req), revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!result.count) throw notFound('API key');
  await audit(req, 'api_key.revoked', { entity: 'ApiKey', entityId: req.params.id });
  res.json({ ok: true });
});

developersRouter.use('/api-keys', apiKeys);

// ── Automations ─────────────────────────────────────────────────────────────

const automations = Router();
automations.use(requireFeature('advancedAutomations'));

async function validateActions(actions: Array<{ type: string; url?: string }>) {
  for (const action of actions) if (action.type === 'webhook' && action.url) await assertPublicUrl(action.url);
}

automations.get('/', async (req, res) => {
  const rules = await prisma.automation.findMany({ where: { workspaceId: wsId(req) }, orderBy: { createdAt: 'desc' } });
  res.json({ automations: rules });
});

automations.post('/', async (req, res) => {
  const input = automationSchema.parse(req.body);
  const workspaceId = wsId(req);
  await assertWithinLimit(workspaceId, await entitlementsFor(req), 'automations');
  await validateActions(input.actions);
  const rule = await prisma.automation.create({
    data: {
      workspaceId,
      name: input.name,
      trigger: input.trigger,
      conditions: input.conditions as Prisma.InputJsonValue,
      actions: input.actions as Prisma.InputJsonValue,
      active: input.active,
    },
  });
  res.status(201).json({ automation: rule });
});

automations.patch('/:id', async (req, res) => {
  const input = updateAutomationSchema.parse(req.body);
  if (input.actions) await validateActions(input.actions);
  const result = await prisma.automation.updateMany({
    where: { id: req.params.id, workspaceId: wsId(req) },
    data: {
      name: input.name,
      trigger: input.trigger,
      active: input.active,
      conditions: input.conditions as Prisma.InputJsonValue | undefined,
      actions: input.actions as Prisma.InputJsonValue | undefined,
    },
  });
  if (!result.count) throw notFound('Automation');
  res.json({ ok: true });
});

automations.delete('/:id', async (req, res) => {
  const result = await prisma.automation.deleteMany({ where: { id: req.params.id, workspaceId: wsId(req) } });
  if (!result.count) throw notFound('Automation');
  res.json({ ok: true });
});

developersRouter.use('/automations', automations);
