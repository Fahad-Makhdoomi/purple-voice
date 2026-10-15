import { Router } from 'express';
import { adminSubscriptionSchema, adminWorkspaceSchema, paginationSchema } from '@pv/shared';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/http-error';
import { getEntitlements, getUsage } from '../../services/entitlements';
import { applySubscriptionChange } from '../../services/subscriptions';

/** Staff view of customer workspaces and their subscriptions. */
export const subscribersRouter = Router();

subscribersRouter.get('/', async (req, res) => {
  const { page, pageSize, q } = paginationSchema.parse(req.query);
  const filters = z
    .object({
      plan: z.enum(['BASIC', 'PRO', 'ENTERPRISE', 'NONE']).optional(),
      status: z
        .enum(['INCOMPLETE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID'])
        .optional(),
    })
    .parse({ plan: req.query.plan || undefined, status: req.query.status || undefined });

  const where: Prisma.WorkspaceWhereInput = {
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

  // Stripe is the source of truth for plan and status on Stripe-billed workspaces;
  // changing them here would be overwritten by the next webhook.
  if (current?.provider === 'STRIPE' && (input.planCode || input.status)) {
    throw badRequest(
      'This workspace pays through Stripe. Change its plan or status in Stripe; it syncs back automatically.',
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
