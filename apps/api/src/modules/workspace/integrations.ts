import { Router } from 'express';
import { INTEGRATION_TYPES, integrationSchema } from '@pv/shared';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { encryptJson } from '../../lib/crypto';
import { audit } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/http-error';
import { signState, verifyState } from '../../lib/signed-url';
import { assertPublicUrl } from '../../lib/ssrf';
import { wsId } from '../../middleware/workspace';
import { entitlementsFor, requireActiveSubscription } from '../../middleware/entitlements';
import { assertWithinLimit } from '../../services/entitlements';
import { exchangeCode, googleAuthUrl } from '../../services/google-calendar';

/** Workspace-scoped integration management (mounted under the dashboard router). */
export const integrationsRouter = Router();

/** Public OAuth callbacks (mounted at /api/integrations, outside auth — the signed state carries identity). */
export const integrationCallbacksRouter = Router();

integrationsRouter.get('/', async (req, res) => {
  const workspaceId = wsId(req);
  const integrations = await prisma.integration.findMany({ where: { workspaceId } });
  res.json({
    integrations: integrations.map((i) => ({
      id: i.id,
      type: i.type,
      accountLabel: i.accountLabel,
      connectedAt: i.connectedAt,
      lastError: i.lastError,
    })),
    available: INTEGRATION_TYPES.map((type) => ({
      type,
      connected: integrations.some((i) => i.type === type),
      configured: type !== 'GOOGLE_CALENDAR' || env.googleEnabled,
    })),
  });
});

integrationsRouter.get('/google/connect', requireActiveSubscription, async (req, res) => {
  const workspaceId = wsId(req);
  const ent = await entitlementsFor(req);
  if (!ent.features.googleCalendar)
    throw badRequest('Google Calendar is not included in your plan');
  const existing = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type: 'GOOGLE_CALENDAR' } },
  });
  if (!existing) await assertWithinLimit(workspaceId, ent, 'integrations');
  res.json({ url: googleAuthUrl(signState({ workspaceId, userId: req.user!.id })) });
});

integrationsRouter.post('/', requireActiveSubscription, async (req, res) => {
  const input = integrationSchema.parse(req.body);
  if (input.type === 'GOOGLE_CALENDAR')
    throw badRequest('Use the Connect button for Google Calendar');
  if (!input.secret) throw badRequest('Paste the webhook URL or API token for this app');
  if (input.type === 'SLACK' || input.type === 'ZAPIER') await assertPublicUrl(input.secret);

  const workspaceId = wsId(req);
  const existing = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type: input.type } },
  });
  if (!existing) await assertWithinLimit(workspaceId, await entitlementsFor(req), 'integrations');

  const integration = await prisma.integration.upsert({
    where: { workspaceId_type: { workspaceId, type: input.type } },
    create: {
      workspaceId,
      type: input.type,
      secretsEnc: encryptJson({ secret: input.secret }),
      config: input.config as object,
    },
    update: {
      secretsEnc: encryptJson({ secret: input.secret }),
      config: input.config as object,
      lastError: null,
    },
  });
  await audit(req, 'integration.connected', {
    entity: 'Integration',
    entityId: integration.id,
    meta: { type: input.type },
  });
  res.status(201).json({ integration: { id: integration.id, type: integration.type } });
});

integrationsRouter.delete('/:id', async (req, res) => {
  const workspaceId = wsId(req);
  const integration = await prisma.integration.findFirst({
    where: { id: req.params.id, workspaceId },
  });
  if (!integration) throw notFound('Integration');
  await prisma.$transaction([
    prisma.agent.updateMany({
      where: { workspaceId, calendarIntegrationId: integration.id },
      data: { calendarIntegrationId: null },
    }),
    prisma.integration.delete({ where: { id: integration.id } }),
  ]);
  await audit(req, 'integration.disconnected', { entity: 'Integration', entityId: integration.id });
  res.json({ ok: true });
});

integrationCallbacksRouter.get('/google/callback', async (req, res) => {
  const back = (q: string) => res.redirect(`${env.appUrl}/dashboard/integrations?${q}`);
  const state = verifyState<{ workspaceId: string; userId: string }>(req.query.state);
  if (!state) return back('error=expired');
  if (typeof req.query.code !== 'string') return back('error=denied');

  try {
    const { tokens, email } = await exchangeCode(req.query.code);
    await prisma.integration.upsert({
      where: { workspaceId_type: { workspaceId: state.workspaceId, type: 'GOOGLE_CALENDAR' } },
      create: {
        workspaceId: state.workspaceId,
        type: 'GOOGLE_CALENDAR',
        secretsEnc: encryptJson(tokens),
        accountLabel: email,
      },
      update: {
        secretsEnc: encryptJson(tokens),
        accountLabel: email,
        lastError: null,
        connectedAt: new Date(),
      },
    });
    await audit(null, 'integration.connected', {
      actorId: state.userId,
      workspaceId: state.workspaceId,
      meta: { type: 'GOOGLE_CALENDAR' },
    });
    back('connected=google');
  } catch {
    back('error=google');
  }
});
