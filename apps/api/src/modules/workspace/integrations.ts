import { Router } from 'express';
import {
  INTEGRATION_TYPES,
  integrationSchema,
  integrationTestSchema,
  smtpIntegrationSchema,
  whatsappIntegrationSchema,
} from '@pv/shared';
import { z } from 'zod';
import type { IntegrationType, Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { decryptJson, encryptJson } from '../../lib/crypto';
import { audit } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/http-error';
import { signState, verifyState } from '../../lib/signed-url';
import { assertPublicUrl } from '../../lib/ssrf';
import { wsId } from '../../middleware/workspace';
import { entitlementsFor, requireActiveSubscription } from '../../middleware/entitlements';
import { assertWithinLimit } from '../../services/entitlements';
import { exchangeCode, googleAuthUrl } from '../../services/google-calendar';
import {
  sendAgentMessage,
  verifySmtp,
  verifyWhatsapp,
  type SmtpConfig,
  type WhatsappConfig,
} from '../../services/messaging';

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
      // Settings without secrets, so the email and WhatsApp forms can be edited.
      config: i.type === 'SMTP' || i.type === 'WHATSAPP' ? i.config : null,
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
  if (input.type === 'SMTP' || input.type === 'WHATSAPP')
    throw badRequest('Use the email or WhatsApp form for this app');
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

/** Creates or updates one messaging integration, keeping the old secret when none is sent. */
async function saveMessaging(
  req: Parameters<Parameters<typeof integrationsRouter.put>[1]>[0],
  type: Extract<IntegrationType, 'SMTP' | 'WHATSAPP'>,
  build: (saved: Record<string, string> | null) => Promise<{
    config: object;
    secrets: Record<string, string> | null;
    label: string;
  }>,
) {
  const workspaceId = wsId(req);
  const existing = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type } },
  });
  if (!existing) await assertWithinLimit(workspaceId, await entitlementsFor(req), 'integrations');
  const saved = existing?.secretsEnc
    ? decryptJson<Record<string, string>>(existing.secretsEnc)
    : null;
  const { config, secrets, label } = await build(saved);
  const data = {
    config: config as Prisma.InputJsonValue,
    secretsEnc: secrets ? encryptJson(secrets) : null,
    accountLabel: label,
    lastError: null,
  };
  const integration = await prisma.integration.upsert({
    where: { workspaceId_type: { workspaceId, type } },
    create: { workspaceId, type, ...data },
    update: { ...data, connectedAt: existing ? undefined : new Date() },
  });
  await audit(req, existing ? 'integration.updated' : 'integration.connected', {
    entity: 'Integration',
    entityId: integration.id,
    meta: { type },
  });
  return integration;
}

/** Email (SMTP): the workspace's own mail server, checked by signing in before it is saved. */
integrationsRouter.put('/smtp', requireActiveSubscription, async (req, res) => {
  const input = smtpIntegrationSchema.parse(req.body);
  const integration = await saveMessaging(req, 'SMTP', async (saved) => {
    const { password: typed, ...config } = input;
    const password = typed || saved?.password || '';
    if (config.username && !password) throw badRequest('Enter the mail server password');
    await verifySmtp(config as SmtpConfig, password);
    return {
      config,
      secrets: password ? { password } : null,
      label: config.fromEmail,
    };
  });
  res.json({ integration: { id: integration.id, type: integration.type } });
});

/** WhatsApp: Meta Cloud API or a Twilio WhatsApp sender, checked before it is saved. */
integrationsRouter.put('/whatsapp', requireActiveSubscription, async (req, res) => {
  const input = whatsappIntegrationSchema.parse(req.body);
  const workspaceId = wsId(req);
  const integration = await saveMessaging(req, 'WHATSAPP', async (saved) => {
    if (input.provider === 'META') {
      const { accessToken: typed, ...rest } = input;
      const accessToken = typed || saved?.accessToken;
      const { displayNumber } = await verifyWhatsapp(workspaceId, input, saved?.accessToken);
      return {
        config: { ...rest, displayNumber } satisfies WhatsappConfig,
        secrets: { accessToken: accessToken! },
        label: displayNumber ? `WhatsApp ${displayNumber}` : 'WhatsApp Business',
      };
    }
    await verifyWhatsapp(workspaceId, input);
    return {
      config: input satisfies WhatsappConfig,
      secrets: null,
      label: `WhatsApp ${input.from} (Twilio)`,
    };
  });
  res.json({ integration: { id: integration.id, type: integration.type } });
});

/** Sends a test message, so the subscriber sees an email or WhatsApp arrive before an agent uses it. */
integrationsRouter.post('/:type/test', requireActiveSubscription, async (req, res) => {
  const type = z.enum(['smtp', 'whatsapp']).parse(req.params.type);
  const { to } = integrationTestSchema.parse(req.body);
  const workspaceId = wsId(req);
  if (type === 'smtp' && !z.string().email().safeParse(to).success)
    throw badRequest('Enter an email address');
  if (type === 'whatsapp' && !/^\+[1-9]\d{6,14}$/.test(to))
    throw badRequest('Use international format, e.g. +14155550123');
  const ws = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  const result = await sendAgentMessage({
    workspaceId,
    channel: type === 'smtp' ? 'EMAIL' : 'WHATSAPP',
    to,
    subject: `Test email from ${ws.name}`,
    text: `This is a test from ${ws.name} on Purple Voice. When a caller asks for information, your AI agent will send it like this.`,
  });
  if (!result.ok) throw badRequest(`Not sent: ${result.detail}`);
  res.json({ ok: true });
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
