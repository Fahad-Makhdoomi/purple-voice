import { Router } from 'express';
import {
  aiCredentialSchema,
  aiSettingsSchema,
  credentialProviderParamSchema,
  CREDENTIAL_PROVIDERS,
  PLAN_CODES,
  paginationSchema,
  paymentGatewayParamSchema,
  paymentGatewaySchema,
  planUpdateSchema,
  staffSchema,
  updateStaffSchema,
  type PlatformAiView,
} from '@pv/shared';
import { z } from 'zod';
import type { PlanCode, Prisma } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import { audit } from '../lib/audit';
import { encrypt, last4 } from '../lib/crypto';
import { badRequest, conflict, notFound } from '../lib/http-error';
import { hashPassword } from '../lib/password';
import { mrrCents } from '../services/subscriptions';
import { getSetting, setSetting } from '../services/settings';
import { revalidate } from '../services/revalidate';
import { verifyApiKey } from '../services/ai-keys';
import { paymentGatewayViews, saveGateway } from '../services/payment-gateways';
import { ensureInternalWorkspace } from '../services/internal-workspace';

/**
 * Super admin only: revenue insights, plans and pricing, staff, security, AI
 * providers, payment gateways, audit.
 */
export const superRouter = Router();

const DAY = 24 * 60 * 60 * 1000;

function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function lastMonths(n: number): string[] {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1 - i), 1));
    return monthKey(d);
  });
}

/** Customers only: the platform's own workspace isn't revenue or a subscriber. */
const customers = { internal: false };

superRouter.get('/insights', async (_req, res) => {
  const now = new Date();
  const windowStart = new Date(now.getTime() - 30 * DAY);
  const yearStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [
    subs,
    events30,
    eventsYear,
    payments,
    signups,
    totalWorkspaces,
    everSubscribed,
    usage,
    topUsage,
  ] = await Promise.all([
    prisma.subscription.findMany({ where: { workspace: customers }, include: { plan: true } }),
    prisma.subscriptionEvent.findMany({
      where: { occurredAt: { gte: windowStart }, workspace: customers },
    }),
    prisma.subscriptionEvent.findMany({
      where: { occurredAt: { gte: yearStart }, workspace: customers },
    }),
    prisma.payment.findMany({
      where: { paidAt: { gte: yearStart }, status: 'paid', workspace: customers },
    }),
    prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', "createdAt") AS day, count(*) AS count
        FROM "Workspace" WHERE "createdAt" >= ${windowStart} AND NOT internal
        GROUP BY 1 ORDER BY 1`,
    prisma.workspace.count({ where: customers }),
    prisma.subscription.count({ where: { workspace: customers } }),
    prisma.call.aggregate({
      where: { createdAt: { gte: monthStart }, workspace: customers },
      _sum: { billedMinutes: true },
      _count: { _all: true },
    }),
    prisma.usagePeriod.findMany({
      where: { periodEnd: { gt: now }, workspace: customers },
      orderBy: { minutesUsed: 'desc' },
      take: 5,
      include: { workspace: { select: { id: true, name: true } } },
    }),
  ]);

  const paying = subs.filter((s) => mrrCents(s) > 0);
  const mrr = paying.reduce((n, s) => n + mrrCents(s), 0);
  const byPlan = (['BASIC', 'PRO', 'ENTERPRISE'] as PlanCode[]).map((code) => {
    const rows = paying.filter((s) => s.plan.code === code);
    return {
      plan: code,
      subscribers: rows.length,
      mrrCents: rows.reduce((n, s) => n + mrrCents(s), 0),
    };
  });

  const count = (type: string) => events30.filter((e) => e.type === type).length;
  const canceled30 = count('CANCELED');
  const new30 = count('CREATED') + count('REACTIVATED');
  const payingAtStart = Math.max(paying.length + canceled30 - new30, 0);
  const customerChurn = payingAtStart ? canceled30 / payingAtStart : 0;

  const lostMrr30 = -events30
    .filter((e) => e.type === 'CANCELED' || e.type === 'DOWNGRADED')
    .reduce((n, e) => n + Math.min(e.mrrDeltaCents, 0), 0);
  const mrrAtStart = mrr - events30.reduce((n, e) => n + e.mrrDeltaCents, 0);
  const revenueChurn = mrrAtStart > 0 ? lostMrr30 / mrrAtStart : 0;
  const arpu = paying.length ? mrr / paying.length : 0;

  const months = lastMonths(12);
  const movement = months.map((month) => {
    const rows = eventsYear.filter((e) => monthKey(e.occurredAt) === month);
    const sum = (types: string[]) =>
      rows.filter((e) => types.includes(e.type)).reduce((n, e) => n + e.mrrDeltaCents, 0);
    return {
      month,
      newCents: sum(['CREATED', 'REACTIVATED']),
      expansionCents: sum(['UPGRADED']),
      contractionCents: sum(['DOWNGRADED']),
      churnedCents: sum(['CANCELED']),
      newSubscribers: rows.filter((e) => e.type === 'CREATED' || e.type === 'REACTIVATED').length,
      cancellations: rows.filter((e) => e.type === 'CANCELED').length,
    };
  });
  const revenue = months.map((month) => ({
    month,
    cents: payments
      .filter((p) => p.paidAt && monthKey(p.paidAt) === month)
      .reduce((n, p) => n + p.amountCents, 0),
  }));

  res.json({
    kpis: {
      mrrCents: mrr,
      arrCents: mrr * 12,
      payingSubscribers: paying.length,
      arpuCents: Math.round(arpu),
      customerChurn,
      revenueChurn,
      ltvCents: customerChurn > 0 ? Math.round(arpu / customerChurn) : null,
      pastDue: subs.filter((s) => s.status === 'PAST_DUE').length,
      cancelingAtPeriodEnd: subs.filter((s) => s.cancelAtPeriodEnd && s.status === 'ACTIVE').length,
      totalWorkspaces,
      trialToPaid: totalWorkspaces ? everSubscribed / totalWorkspaces : 0,
      minutesThisMonth: usage._sum.billedMinutes ?? 0,
      callsThisMonth: usage._count._all,
    },
    byPlan,
    movement,
    revenue,
    signups: Array.from({ length: 30 }, (_, i) => {
      const day = new Date(windowStart.getTime() + (i + 1) * DAY).toISOString().slice(0, 10);
      const row = signups.find((s) => new Date(s.day).toISOString().slice(0, 10) === day);
      return { day, count: Number(row?.count ?? 0) };
    }),
    topUsage: topUsage.map((u) => ({
      workspace: u.workspace,
      minutes: u.minutesUsed,
      calls: u.callCount,
    })),
  });
});

// ── Plans & pricing ─────────────────────────────────────────────────────────

superRouter.get('/plans', async (_req, res) => {
  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { subscriptions: true } } },
  });
  res.json({ plans });
});

superRouter.patch('/plans/:code', async (req, res) => {
  const code = z.enum(PLAN_CODES).parse(req.params.code);
  const input = planUpdateSchema.parse(req.body);
  const current = await prisma.plan.findUnique({ where: { code } });
  if (!current) throw notFound('Plan');
  const plan = await prisma.plan.update({
    where: { code },
    data: {
      ...input,
      // A Razorpay plan id typed in by staff is theirs: used as it is, never replaced.
      ...(input.razorpayPlanId !== undefined && input.razorpayPlanId !== current.razorpayPlanId
        ? { razorpayPlanAmountPaise: null }
        : {}),
      limits: input.limits
        ? ({ ...(current.limits as object), ...input.limits } as Prisma.InputJsonValue)
        : undefined,
    },
  });
  await audit(req, 'plan.updated', {
    entity: 'Plan',
    entityId: plan.id,
    meta: input as Prisma.InputJsonValue,
  });
  revalidate(['plans']);
  res.json({ plan });
});

// ── Our workspace ──────────────────────────────────────────────────────────
// The platform's own workspace, where super admins build agents, run
// campaigns and call (they open it like a customer's dashboard).

superRouter.get('/workspace', async (_req, res) => {
  res.json({ workspace: await ensureInternalWorkspace() });
});

// ── Staff ───────────────────────────────────────────────────────────────────

superRouter.get('/staff', async (_req, res) => {
  const staff = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      suspended: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  res.json({ staff });
});

superRouter.post('/staff', async (req, res) => {
  const input = staffSchema.parse(req.body);
  if (await prisma.user.findUnique({ where: { email: input.email } }))
    throw conflict('That email is already in use');
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      role: input.role,
      passwordHash: await hashPassword(input.password),
    },
    select: { id: true, name: true, email: true, role: true },
  });
  await audit(req, 'staff.created', {
    entity: 'User',
    entityId: user.id,
    meta: { role: input.role },
  });
  res.status(201).json({ user });
});

superRouter.patch('/staff/:id', async (req, res) => {
  const input = updateStaffSchema.parse(req.body);
  if (req.params.id === req.user!.id)
    throw badRequest("You can't change your own role or suspend yourself");
  const target = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!target || target.role === 'SUBSCRIBER') throw notFound('Staff member');
  if (target.role === 'SUPER_ADMIN' && (input.role === 'ADMIN' || input.suspended)) {
    const supers = await prisma.user.count({ where: { role: 'SUPER_ADMIN', suspended: false } });
    if (supers <= 1) throw badRequest('Keep at least one active super admin');
  }
  const user = await prisma.user.update({
    where: { id: target.id },
    data: input,
    select: { id: true, name: true, email: true, role: true, suspended: true },
  });
  if (input.suspended) {
    await prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  await audit(req, 'staff.updated', {
    entity: 'User',
    entityId: user.id,
    meta: input as Prisma.InputJsonValue,
  });
  res.json({ user });
});

// ── Security settings (captcha) ─────────────────────────────────────────────

superRouter.get('/settings/security', async (_req, res) => {
  res.json({ value: await getSetting('security') });
});

superRouter.put('/settings/security', async (req, res) => {
  const value = await setSetting('security', req.body);
  await audit(req, 'settings.security_updated', {
    meta: value as unknown as Prisma.InputJsonValue,
  });
  revalidate(['settings']);
  res.json({ value });
});

// ── Website theme ───────────────────────────────────────────────────────────

superRouter.get('/settings/appearance', async (_req, res) => {
  res.json({ value: await getSetting('appearance') });
});

superRouter.put('/settings/appearance', async (req, res) => {
  const value = await setSetting('appearance', req.body);
  await audit(req, 'settings.appearance_updated', {
    meta: value as unknown as Prisma.InputJsonValue,
  });
  revalidate(['settings']);
  res.json({ value });
});

// ── AI providers ────────────────────────────────────────────────────────────
// The default AI layer for subscribers staff haven't set up individually, and
// the platform's own vendor keys, used by every subscriber without a key of
// its own. Key material is never returned or audited.

async function platformAiView(): Promise<PlatformAiView> {
  const [defaults, rows] = await Promise.all([
    getSetting('ai'),
    prisma.platformCredential.findMany({
      select: { provider: true, label: true, last4: true, verifiedAt: true, updatedAt: true },
    }),
  ]);
  return {
    defaults: {
      voiceEngine: defaults.voiceEngine,
      llmProvider: defaults.llmProvider,
      model: defaults.model,
      speechModel: defaults.speechModel ?? null,
    },
    keys: CREDENTIAL_PROVIDERS.map((provider) => {
      const row = rows.find((r) => r.provider === provider);
      return {
        provider,
        configured: !!row,
        label: row?.label ?? null,
        last4: row?.last4 ?? null,
        verifiedAt: row?.verifiedAt?.toISOString() ?? null,
        updatedAt: row?.updatedAt.toISOString() ?? null,
      };
    }),
    envAnthropic: !!env.ANTHROPIC_API_KEY,
  };
}

superRouter.get('/ai', async (_req, res) => {
  res.json(await platformAiView());
});

superRouter.put('/ai/defaults', async (req, res) => {
  const value = await setSetting('ai', aiSettingsSchema.parse(req.body));
  await audit(req, 'ai.defaults.updated', { entity: 'SiteSetting', entityId: 'ai', meta: value });
  res.json(await platformAiView());
});

superRouter.put('/ai/keys', async (req, res) => {
  const input = aiCredentialSchema.parse(req.body);
  await verifyApiKey(input.provider, input.apiKey);
  const key = {
    label: input.label || null,
    apiKeyEnc: encrypt(input.apiKey),
    last4: last4(input.apiKey),
    verifiedAt: new Date(),
  };
  await prisma.platformCredential.upsert({
    where: { provider: input.provider },
    create: { provider: input.provider, ...key },
    update: key,
  });
  await audit(req, 'ai.platform_key.saved', {
    entity: 'PlatformCredential',
    entityId: input.provider,
  });
  res.json(await platformAiView());
});

superRouter.delete('/ai/keys/:provider', async (req, res) => {
  const provider = credentialProviderParamSchema.parse(req.params.provider);
  await prisma.platformCredential.deleteMany({ where: { provider } });
  await audit(req, 'ai.platform_key.removed', { entity: 'PlatformCredential', entityId: provider });
  res.json(await platformAiView());
});

// ── Payment gateways ───────────────────────────────────────────────────────
// Stripe, Razorpay and PayPal credentials. Verified with the gateway before
// they're encrypted and saved; secrets are never returned or audited.

superRouter.get('/payments', async (_req, res) => {
  res.json({ gateways: await paymentGatewayViews() });
});

superRouter.put('/payments/gateways', async (req, res) => {
  const input = paymentGatewaySchema.parse(req.body);
  await saveGateway(input);
  await audit(req, 'payments.gateway_saved', {
    entity: 'PaymentGatewayConfig',
    entityId: input.gateway,
    meta: { enabled: input.enabled },
  });
  res.json({ gateways: await paymentGatewayViews() });
});

superRouter.delete('/payments/gateways/:gateway', async (req, res) => {
  const gateway = paymentGatewayParamSchema.parse(req.params.gateway);
  await prisma.paymentGatewayConfig.deleteMany({ where: { gateway } });
  await audit(req, 'payments.gateway_removed', {
    entity: 'PaymentGatewayConfig',
    entityId: gateway,
  });
  res.json({ gateways: await paymentGatewayViews() });
});

// ── Audit log ───────────────────────────────────────────────────────────────

superRouter.get('/audit', async (req, res) => {
  const { page, pageSize, q } = paginationSchema.parse(req.query);
  const where: Prisma.AuditLogWhereInput = q
    ? {
        OR: [
          { action: { contains: q } },
          { actor: { email: { contains: q, mode: 'insensitive' } } },
        ],
      }
    : {};
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        actor: { select: { name: true, email: true, role: true } },
        workspace: { select: { name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  res.json({ entries, total, page, pageSize });
});
