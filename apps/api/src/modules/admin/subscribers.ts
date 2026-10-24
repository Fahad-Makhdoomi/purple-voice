import { Router } from 'express';
import {
  PAYMENT_GATEWAY_LABELS,
  PLAN_CODES,
  ENTITLED_SUBSCRIPTION_STATUSES,
  adminSubscriptionSchema,
  adminWorkspaceSchema,
  aiCredentialSchema,
  aiSettingsSchema,
  credentialProviderParamSchema,
  CREDENTIAL_PROVIDERS,
  paginationSchema,
  type AiAdminView,
} from '@pv/shared';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { encrypt, last4 } from '../../lib/crypto';
import { badRequest, notFound } from '../../lib/http-error';
import { getEntitlements, getUsage } from '../../services/entitlements';
import { applySubscriptionChange } from '../../services/subscriptions';
import { getAiStatus } from '../../services/ai-settings';
import { verifyApiKey } from '../../services/ai-keys';
import { getSetting } from '../../services/settings';

/** Staff view of customer workspaces and their subscriptions. */
export const subscribersRouter = Router();

subscribersRouter.get('/', async (req, res) => {
  const { page, pageSize, q } = paginationSchema.parse(req.query);
  const filters = z
    .object({
      plan: z.enum([...PLAN_CODES, 'NONE']).optional(),
      status: z
        .enum(['INCOMPLETE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID'])
        .optional(),
    })
    .parse({ plan: req.query.plan || undefined, status: req.query.status || undefined });

  // The platform's own workspace is not a customer (Super admin → Our workspace).
  const where: Prisma.WorkspaceWhereInput = {
    internal: false,
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { users: { some: { email: { contains: q, mode: 'insensitive' } } } },
            { users: { some: { name: { contains: q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
    ...(filters.plan === 'NONE'
      ? { subscription: { is: null } }
      : filters.plan === 'FREE'
        ? // On Free: never subscribed, a paid plan that ended, or put on Free by staff.
          {
            OR: [
              { subscription: { is: null } },
              {
                subscription: {
                  is: { status: { notIn: [...ENTITLED_SUBSCRIPTION_STATUSES] } },
                },
              },
              { subscription: { is: { plan: { code: 'FREE' as const } } } },
            ],
          }
        : filters.plan
          ? { subscription: { is: { plan: { code: filters.plan } } } }
          : {}),
    ...(filters.status ? { subscription: { is: { status: filters.status } } } : {}),
  };

  const [workspaces, total] = await Promise.all([
    prisma.workspace.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        users: {
          where: { role: 'SUBSCRIBER' },
          take: 1,
          select: { id: true, name: true, email: true, lastLoginAt: true },
        },
        subscription: { include: { plan: { select: { code: true, name: true } } } },
        _count: { select: { agents: true, phoneNumbers: true, calls: true } },
      },
    }),
    prisma.workspace.count({ where }),
  ]);

  res.json({
    subscribers: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      suspended: w.suspended,
      createdAt: w.createdAt,
      owner: w.users[0] ?? null,
      plan: w.subscription?.plan ?? null,
      status: w.subscription?.status ?? null,
      provider: w.subscription?.provider ?? null,
      currentPeriodEnd: w.subscription?.currentPeriodEnd ?? null,
      counts: w._count,
    })),
    total,
    page,
    pageSize,
  });
});

subscribersRouter.get('/:id', async (req, res) => {
  const workspace = await prisma.workspace.findUnique({
    where: { id: req.params.id },
    include: {
      users: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          lastLoginAt: true,
          createdAt: true,
          suspended: true,
        },
      },
      subscription: { include: { plan: true } },
    },
  });
  if (!workspace) throw notFound('Workspace');

  const entitlements = await getEntitlements(workspace.id);
  const [usage, events, payments, recentCalls, auditLog, telephony, credentials] =
    await Promise.all([
      getUsage(workspace.id, entitlements),
      prisma.subscriptionEvent.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { occurredAt: 'desc' },
        take: 30,
      }),
      prisma.payment.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: 'desc' },
        take: 24,
      }),
      prisma.call.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          direction: true,
          status: true,
          toNumber: true,
          fromNumber: true,
          durationSec: true,
          outcome: true,
          createdAt: true,
        },
      }),
      prisma.auditLog.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { actor: { select: { name: true, role: true } } },
      }),
      prisma.telephonyAccount.findMany({
        where: { workspaceId: workspace.id },
        select: { id: true, provider: true, label: true, publicId: true },
      }),
      prisma.aiCredential.findMany({
        where: { workspaceId: workspace.id },
        select: { provider: true, last4: true, verifiedAt: true },
      }),
    ]);

  res.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      notes: workspace.notes,
      suspended: workspace.suspended,
      timezone: workspace.timezone,
      createdAt: workspace.createdAt,
      users: workspace.users,
    },
    subscription: workspace.subscription,
    entitlements,
    usage,
    events,
    payments,
    recentCalls,
    auditLog,
    telephony,
    credentials,
  });
});

subscribersRouter.patch('/:id', async (req, res) => {
  const input = adminWorkspaceSchema.parse(req.body);
  const workspace = await prisma.workspace.update({ where: { id: req.params.id }, data: input });
  if (input.suspended !== undefined) {
    // Suspending also signs the customer out everywhere.
    if (input.suspended) {
      await prisma.session.updateMany({
        where: { user: { workspaceId: workspace.id }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await audit(req, input.suspended ? 'workspace.suspended' : 'workspace.unsuspended', {
      workspaceId: workspace.id,
    });
  }
  res.json({ workspace });
});

subscribersRouter.patch('/:id/subscription', async (req, res) => {
  const input = adminSubscriptionSchema.parse(req.body);
  const workspaceId = req.params.id;
  const current = await prisma.subscription.findUnique({ where: { workspaceId } });

  // The gateway is the source of truth for plan and status on gateway-billed
  // workspaces; changing them here would be overwritten by the next webhook.
  if (current && current.provider !== 'MANUAL' && (input.planCode || input.status)) {
    const gateway = PAYMENT_GATEWAY_LABELS[current.provider];
    throw badRequest(
      `This workspace pays through ${gateway}. Change its plan or status in ${gateway}; it syncs back automatically.`,
    );
  }
  if (!current && !input.planCode) throw badRequest('Choose a plan to create a subscription');

  const subscription = await applySubscriptionChange(
    workspaceId,
    {
      planCode: input.planCode,
      status: input.status ?? (current ? undefined : 'ACTIVE'),
      provider: current?.provider ?? 'MANUAL',
      currentPeriodStart: current ? undefined : new Date(),
      currentPeriodEnd: input.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd,
      customPriceCents: input.customPriceCents,
      customMinutes: input.customMinutes,
      customLimits:
        input.customLimits === null
          ? null
          : (input.customLimits as Prisma.InputJsonValue | undefined),
    },
    { note: input.note ?? `Changed by ${req.user!.name}` },
  );
  await audit(req, 'subscription.admin_change', {
    workspaceId,
    entity: 'Subscription',
    entityId: subscription.id,
    meta: input as unknown as Prisma.InputJsonValue,
  });
  res.json({ subscription, entitlements: await getEntitlements(workspaceId) });
});

// ── AI layer ────────────────────────────────────────────────────────────────
// Staff choose each subscriber's voice engine, model and (optionally) their
// own vendor keys. Subscribers never see any of this; they only learn whether
// their AI is ready. Key material is never returned or audited.

async function requireWorkspace(id: string): Promise<string> {
  const workspace = await prisma.workspace.findUnique({ where: { id }, select: { id: true } });
  if (!workspace) throw notFound('Workspace');
  return workspace.id;
}

async function aiAdminView(workspaceId: string): Promise<AiAdminView> {
  const [status, platformDefault, own, platform] = await Promise.all([
    getAiStatus(workspaceId),
    getSetting('ai'),
    prisma.aiCredential.findMany({
      where: { workspaceId },
      select: { provider: true, label: true, last4: true, verifiedAt: true },
    }),
    prisma.platformCredential.findMany({ select: { provider: true } }),
  ]);
  return {
    settings: {
      voiceEngine: status.settings.voiceEngine,
      llmProvider: status.settings.llmProvider,
      model: status.settings.model,
      speechModel: status.settings.speechModel,
      source: status.settings.source,
    },
    platformDefault: {
      voiceEngine: platformDefault.voiceEngine,
      llmProvider: platformDefault.llmProvider,
      model: platformDefault.model,
      speechModel: platformDefault.speechModel ?? null,
    },
    keys: status.keys,
    workspaceKeys: CREDENTIAL_PROVIDERS.flatMap((provider) => {
      const row = own.find((r) => r.provider === provider);
      return row
        ? [
            {
              provider,
              label: row.label,
              last4: row.last4,
              verifiedAt: row.verifiedAt?.toISOString() ?? null,
            },
          ]
        : [];
    }),
    // Configured when the platform can supply the key, the environment's Claude key included.
    platformKeys: CREDENTIAL_PROVIDERS.map((provider) => ({
      provider,
      configured:
        platform.some((r) => r.provider === provider) ||
        (provider === 'ANTHROPIC' && !!env.ANTHROPIC_API_KEY),
    })),
    ready: status.ready,
  };
}

subscribersRouter.get('/:id/ai', async (req, res) => {
  const workspaceId = await requireWorkspace(req.params.id);
  res.json(await aiAdminView(workspaceId));
});

subscribersRouter.put('/:id/ai', async (req, res) => {
  const workspaceId = await requireWorkspace(req.params.id);
  const input = aiSettingsSchema.parse(req.body);
  await prisma.workspaceAiSettings.upsert({
    where: { workspaceId },
    create: { workspaceId, ...input, updatedById: req.user!.id },
    update: { ...input, updatedById: req.user!.id },
  });
  await audit(req, 'ai.settings.updated', {
    workspaceId,
    entity: 'WorkspaceAiSettings',
    entityId: workspaceId,
    meta: input,
  });
  res.json(await aiAdminView(workspaceId));
});

/** Back to the platform default. */
subscribersRouter.delete('/:id/ai', async (req, res) => {
  const workspaceId = await requireWorkspace(req.params.id);
  await prisma.workspaceAiSettings.deleteMany({ where: { workspaceId } });
  await audit(req, 'ai.settings.reset', {
    workspaceId,
    entity: 'WorkspaceAiSettings',
    entityId: workspaceId,
  });
  res.json(await aiAdminView(workspaceId));
});

/** A key of the subscriber's own (verified with the vendor first); it takes precedence over the platform's. */
subscribersRouter.put('/:id/ai/keys', async (req, res) => {
  const workspaceId = await requireWorkspace(req.params.id);
  const input = aiCredentialSchema.parse(req.body);
  await verifyApiKey(input.provider, input.apiKey);
  const key = {
    label: input.label || null,
    apiKeyEnc: encrypt(input.apiKey),
    last4: last4(input.apiKey),
    verifiedAt: new Date(),
  };
  await prisma.aiCredential.upsert({
    where: { workspaceId_provider: { workspaceId, provider: input.provider } },
    create: { workspaceId, provider: input.provider, ...key },
    update: key,
  });
  await audit(req, 'ai.key.saved', {
    workspaceId,
    entity: 'AiCredential',
    meta: { provider: input.provider },
  });
  res.json(await aiAdminView(workspaceId));
});

subscribersRouter.delete('/:id/ai/keys/:provider', async (req, res) => {
  const workspaceId = await requireWorkspace(req.params.id);
  const provider = credentialProviderParamSchema.parse(req.params.provider);
  await prisma.aiCredential.deleteMany({ where: { workspaceId, provider } });
  await audit(req, 'ai.key.removed', { workspaceId, entity: 'AiCredential', meta: { provider } });
  res.json(await aiAdminView(workspaceId));
});
