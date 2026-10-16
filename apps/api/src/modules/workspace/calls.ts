import { Router } from 'express';
import { callFiltersSchema, updateAppointmentSchema } from '@pv/shared';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { notFound } from '../../lib/http-error';
import { wsId } from '../../middleware/workspace';
import { requireFeature } from '../../middleware/entitlements';
import { getEntitlements, getUsage } from '../../services/entitlements';
import { getAiStatus } from '../../services/ai-settings';

export const callsRouter = Router();

// ── Context: what every dashboard page needs about the workspace ───────────

callsRouter.get('/context', async (req, res) => {
  const workspaceId = wsId(req);
  const [workspace, entitlements] = await Promise.all([
    prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { id: true, name: true, timezone: true, suspended: true },
    }),
    getEntitlements(workspaceId),
  ]);
  res.json({
    workspace,
    entitlements,
    usage: await getUsage(workspaceId, entitlements),
    actingAsStaff: !!req.actingAsStaff,
  });
});

// ── Overview (dashboard home) ───────────────────────────────────────────────

callsRouter.get('/overview', async (req, res) => {
  const workspaceId = wsId(req);
  const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
  since.setUTCHours(0, 0, 0, 0);

  const entitlements = await getEntitlements(workspaceId);
  const [usage, telephony, ai, recentCalls, upcoming, daily, outcomes, totals] = await Promise.all([
    getUsage(workspaceId, entitlements),
    prisma.telephonyAccount.count({ where: { workspaceId } }),
    getAiStatus(workspaceId),
    prisma.call.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { agent: { select: { name: true } } },
    }),
    prisma.appointment.findMany({
      where: { workspaceId, startsAt: { gte: new Date() }, status: 'SCHEDULED' },
      orderBy: { startsAt: 'asc' },
      take: 5,
    }),
    prisma.$queryRaw<Array<{ day: Date; calls: bigint; minutes: bigint; answered: bigint }>>`
      SELECT date_trunc('day', "createdAt") AS day,
             count(*) AS calls,
             coalesce(sum("billedMinutes"), 0) AS minutes,
             count(*) FILTER (WHERE "answeredAt" IS NOT NULL) AS answered
      FROM "Call"
      WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1`,
    prisma.call.groupBy({
      by: ['outcome'],
      where: { workspaceId, createdAt: { gte: since }, outcome: { not: null } },
      _count: { _all: true },
    }),
    prisma.call.aggregate({
      where: { workspaceId, createdAt: { gte: since } },
      _count: { _all: true },
      _avg: { durationSec: true },
    }),
  ]);

  const series = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(since.getTime() + i * 24 * 60 * 60 * 1000);
    const row = daily.find(
      (d) => new Date(d.day).toISOString().slice(0, 10) === day.toISOString().slice(0, 10),
    );
    return {
      day: day.toISOString().slice(0, 10),
      calls: Number(row?.calls ?? 0),
      minutes: Number(row?.minutes ?? 0),
      answered: Number(row?.answered ?? 0),
    };
  });

  const booked = outcomes.find((o) => o.outcome === 'APPOINTMENT_BOOKED')?._count._all ?? 0;
  res.json({
    entitlements,
    usage,
    setup: {
      subscription: entitlements.active,
      // Staff set up the AI layer; the subscriber only learns whether it's ready.
      ai: ai.ready,
      telephony: telephony > 0,
      number: usage.phoneNumbers > 0,
      agent: usage.agents > 0,
    },
    kpis: {
      calls: totals._count._all,
      avgDurationSec: Math.round(totals._avg.durationSec ?? 0),
      appointments: booked,
      conversionRate: totals._count._all ? booked / totals._count._all : 0,
    },
    series,
    outcomes: outcomes.map((o) => ({ outcome: o.outcome, count: o._count._all })),
    recentCalls,
    upcomingAppointments: upcoming,
  });
});

// ── Calls ───────────────────────────────────────────────────────────────────

callsRouter.get('/calls', async (req, res) => {
  const f = callFiltersSchema.parse(req.query);
  const where: Prisma.CallWhereInput = {
    workspaceId: wsId(req),
    agentId: f.agentId,
    campaignId: f.campaignId,
    direction: f.direction,
    outcome: f.outcome,
    ...(f.q
      ? {
          OR: [
            { toNumber: { contains: f.q } },
            { fromNumber: { contains: f.q } },
            { summary: { contains: f.q, mode: 'insensitive' } },
            { contact: { name: { contains: f.q, mode: 'insensitive' } } },
          ],
        }
      : {}),
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
        createdAt: true,
        agent: { select: { id: true, name: true } },
        // Set for calls a person made from the browser dialer (no agent).
        placedBy: { select: { id: true, name: true } },
        campaign: { select: { id: true, name: true } },
        contact: { select: { id: true, name: true } },
      },
    }),
    prisma.call.count({ where }),
  ]);
  res.json({ calls, total, page: f.page, pageSize: f.pageSize });
});

callsRouter.get('/calls/:id', async (req, res) => {
  const call = await prisma.call.findFirst({
    where: { id: req.params.id, workspaceId: wsId(req) },
    include: {
      agent: { select: { id: true, name: true } },
      placedBy: { select: { id: true, name: true } },
      campaign: { select: { id: true, name: true } },
      contact: true,
      appointments: true,
    },
  });
  if (!call) throw notFound('Call');
  res.json({ call });
});

// ── Appointments ────────────────────────────────────────────────────────────

callsRouter.get('/appointments', async (req, res) => {
  const q = z
    .object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() })
    .parse(req.query);
  const appointments = await prisma.appointment.findMany({
    where: {
      workspaceId: wsId(req),
      startsAt: { gte: q.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), lte: q.to },
    },
    orderBy: { startsAt: 'asc' },
    take: 500,
  });
  res.json({ appointments });
});

callsRouter.patch('/appointments/:id', async (req, res) => {
  const input = updateAppointmentSchema.parse(req.body);
  const result = await prisma.appointment.updateMany({
    where: { id: req.params.id, workspaceId: wsId(req) },
    data: input,
  });
  if (!result.count) throw notFound('Appointment');
  res.json({ ok: true });
});

// ── Detailed insights (Pro) ─────────────────────────────────────────────────

callsRouter.get('/insights', requireFeature('detailedInsights'), async (req, res) => {
  const workspaceId = wsId(req);
  const days = z.coerce.number().int().min(7).max(365).default(30).parse(req.query.days);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [byAgent, byCampaign, byHour, byOutcome, outbound, sentiment] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        agentId: string;
        name: string;
        calls: bigint;
        minutes: bigint;
        booked: bigint;
        avgSec: number | null;
      }>
    >`
      SELECT a.id AS "agentId", a.name,
             count(c.*) AS calls,
             coalesce(sum(c."billedMinutes"), 0) AS minutes,
             count(*) FILTER (WHERE c.outcome = 'APPOINTMENT_BOOKED') AS booked,
             avg(c."durationSec") FILTER (WHERE c."answeredAt" IS NOT NULL)::float AS "avgSec"
      FROM "Call" c JOIN "Agent" a ON a.id = c."agentId"
      WHERE c."workspaceId" = ${workspaceId} AND c."createdAt" >= ${since}
      GROUP BY a.id, a.name ORDER BY calls DESC`,
    prisma.$queryRaw<
      Array<{ campaignId: string; name: string; calls: bigint; answered: bigint; booked: bigint }>
    >`
      SELECT p.id AS "campaignId", p.name,
             count(c.*) AS calls,
             count(*) FILTER (WHERE c."answeredAt" IS NOT NULL) AS answered,
             count(*) FILTER (WHERE c.outcome = 'APPOINTMENT_BOOKED') AS booked
      FROM "Call" c JOIN "Campaign" p ON p.id = c."campaignId"
      WHERE c."workspaceId" = ${workspaceId} AND c."createdAt" >= ${since}
      GROUP BY p.id, p.name ORDER BY calls DESC`,
    prisma.$queryRaw<Array<{ hour: number; calls: bigint; answered: bigint }>>`
      SELECT extract(hour FROM "createdAt")::int AS hour,
             count(*) AS calls,
             count(*) FILTER (WHERE "answeredAt" IS NOT NULL) AS answered
      FROM "Call"
      WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${since} AND direction = 'OUTBOUND'
      GROUP BY 1 ORDER BY 1`,
    prisma.call.groupBy({
      by: ['outcome'],
      where: { workspaceId, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.call.groupBy({
      by: ['status'],
      where: { workspaceId, createdAt: { gte: since }, direction: 'OUTBOUND' },
      _count: { _all: true },
    }),
    prisma.call.aggregate({
      where: { workspaceId, createdAt: { gte: since }, sentiment: { not: null } },
      _avg: { sentiment: true },
    }),
  ]);

  const outboundTotal = outbound.reduce((n, s) => n + s._count._all, 0);
  const connected = outbound
    .filter((s) => ['COMPLETED', 'TRANSFERRED'].includes(s.status))
    .reduce((n, s) => n + s._count._all, 0);

  res.json({
    days,
    connectRate: outboundTotal ? connected / outboundTotal : 0,
    averageSentiment: sentiment._avg.sentiment,
    outcomes: byOutcome.map((o) => ({ outcome: o.outcome ?? 'NONE', count: o._count._all })),
    agents: byAgent.map((r) => ({
      ...r,
      calls: Number(r.calls),
      minutes: Number(r.minutes),
      booked: Number(r.booked),
    })),
    campaigns: byCampaign.map((r) => ({
      ...r,
      calls: Number(r.calls),
      answered: Number(r.answered),
      booked: Number(r.booked),
    })),
    hours: Array.from({ length: 24 }, (_, hour) => {
      const row = byHour.find((h) => h.hour === hour);
      return { hour, calls: Number(row?.calls ?? 0), answered: Number(row?.answered ?? 0) };
    }),
  });
});
