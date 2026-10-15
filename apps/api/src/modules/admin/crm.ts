import { Router } from 'express';
import { leadUpdateSchema, paginationSchema, ticketReplySchema, ticketUpdateSchema } from '@pv/shared';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { notFound } from '../../lib/http-error';
import { sendMail } from '../../lib/mailer';

/** Staff CRM: overview numbers, website leads, support queue. */
export const crmRouter = Router();

crmRouter.get('/overview', async (_req, res) => {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [workspaces, active, signupsWeek, openTickets, urgentTickets, newLeads, callsToday, liveCalls, recentSignups] =
    await Promise.all([
      prisma.workspace.count(),
      prisma.subscription.count({ where: { status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } } }),
      prisma.workspace.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.ticket.count({ where: { status: { in: ['OPEN', 'PENDING'] } } }),
      prisma.ticket.count({ where: { status: 'OPEN', priority: { in: ['HIGH', 'URGENT'] } } }),
      prisma.lead.count({ where: { status: 'NEW' } }),
      prisma.call.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.call.count({ where: { status: { in: ['RINGING', 'IN_PROGRESS'] } } }),
      prisma.workspace.findMany({
        orderBy: { createdAt: 'desc' },
        take: 6,
        include: {
          users: { take: 1, select: { name: true, email: true } },
          subscription: { select: { status: true, plan: { select: { name: true } } } },
        },
      }),
    ]);
  res.json({
    counts: { workspaces, active, signupsWeek, openTickets, urgentTickets, newLeads, callsToday, liveCalls },
    recentSignups,
  });
});

/** Staff directory, for ticket and lead assignment. */
crmRouter.get('/staff', async (_req, res) => {
  const staff = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, suspended: false },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: 'asc' },
  });
  res.json({ staff });
});

// ── Leads ───────────────────────────────────────────────────────────────────

crmRouter.get('/leads', async (req, res) => {
  const { page, pageSize, q } = paginationSchema.parse(req.query);
  const status = z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST']).optional().parse(req.query.status || undefined);
  const where: Prisma.LeadWhereInput = {
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { company: { contains: q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [leads, total, byStatus] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { owner: { select: { id: true, name: true } } },
    }),
    prisma.lead.count({ where }),
    prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  res.json({
    leads,
    total,
    page,
    pageSize,
    pipeline: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
  });
});

crmRouter.patch('/leads/:id', async (req, res) => {
  const input = leadUpdateSchema.parse(req.body);
  const lead = await prisma.lead.update({ where: { id: req.params.id }, data: input });
  await audit(req, 'lead.updated', { entity: 'Lead', entityId: lead.id, meta: input as Prisma.InputJsonValue });
  res.json({ lead });
});

// ── Support queue ───────────────────────────────────────────────────────────

crmRouter.get('/tickets', async (req, res) => {
  const status = z.enum(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED']).optional().parse(req.query.status || undefined);
  const tickets = await prisma.ticket.findMany({
    where: status ? { status } : { status: { in: ['OPEN', 'PENDING'] } },
    // Priority support: Pro / Enterprise tickets surface first.
    orderBy: [{ priority: 'desc' }, { updatedAt: 'asc' }],
    take: 200,
    include: {
      workspace: { select: { id: true, name: true, subscription: { select: { plan: { select: { code: true } } } } } },
      assignee: { select: { id: true, name: true } },
      _count: { select: { messages: true } },
    },
  });
  res.json({ tickets });
});

crmRouter.get('/tickets/:id', async (req, res) => {
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: {
      workspace: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { name: true, email: true } } } },
    },
  });
  if (!ticket) throw notFound('Ticket');
  res.json({ ticket });
});

crmRouter.patch('/tickets/:id', async (req, res) => {
  const input = ticketUpdateSchema.parse(req.body);
  const ticket = await prisma.ticket.update({ where: { id: req.params.id }, data: input });
  res.json({ ticket });
});

crmRouter.post('/tickets/:id/messages', async (req, res) => {
  const input = ticketReplySchema.parse(req.body);
  const ticket = await prisma.ticket.findUnique({
    where: { id: req.params.id },
    include: { workspace: { include: { users: { where: { role: 'SUBSCRIBER' }, select: { email: true, name: true } } } } },
  });
  if (!ticket) throw notFound('Ticket');
  const message = await prisma.ticketMessage.create({
    data: { ticketId: ticket.id, authorId: req.user!.id, fromStaff: true, body: input.body },
  });
  await prisma.ticket.update({
    where: { id: ticket.id },
    data: { status: 'PENDING', assigneeId: ticket.assigneeId ?? req.user!.id },
  });
  const recipients = ticket.workspace.users.map((u) => u.email);
  if (recipients.length) {
    void sendMail({
      to: recipients,
      subject: `Re: ${ticket.subject}`,
      text: `${input.body}\n\n— ${req.user!.name}, Purple Voice support\n${env.appUrl}/dashboard/support/${ticket.id}`,
    });
  }
  res.status(201).json({ message });
});
