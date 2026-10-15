import { Router } from 'express';
import { assistantMessageSchema, ticketReplySchema, ticketSchema } from '@pv/shared';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { logger } from '../../lib/logger';
import { sendMail } from '../../lib/mailer';
import { notFound } from '../../lib/http-error';
import { wsId } from '../../middleware/workspace';
import { entitlementsFor, requireFeature } from '../../middleware/entitlements';
import { assistantLimiter } from '../../middleware/rate-limit';
import { streamAssistantReply } from '../../services/ai/assistant';

export const supportRouter = Router();

function notifyStaff(subject: string, text: string) {
  if (!env.SUPPORT_NOTIFY_EMAILS) return;
  void sendMail({ to: env.SUPPORT_NOTIFY_EMAILS.split(',').map((s) => s.trim()), subject, text });
}

supportRouter.get('/tickets', async (req, res) => {
  const tickets = await prisma.ticket.findMany({
    where: { workspaceId: wsId(req) },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { messages: true } } },
  });
  res.json({ tickets });
});

supportRouter.post('/tickets', async (req, res) => {
  const input = ticketSchema.parse(req.body);
  const workspaceId = wsId(req);
  const ent = await entitlementsFor(req);
  const priority = ent.active && ent.features.prioritySupport ? 'HIGH' : 'NORMAL';
  const ticket = await prisma.ticket.create({
    data: {
      workspaceId,
      subject: input.subject,
      priority,
      messages: { create: { authorId: req.user!.id, fromStaff: !!req.actingAsStaff, body: input.body } },
    },
  });
  notifyStaff(
    `[${priority}] New ticket: ${input.subject}`,
    `${req.user!.name} (${req.user!.email}) wrote:\n\n${input.body}\n\n${env.appUrl}/admin/support/${ticket.id}`,
  );
  res.status(201).json({ ticket });
});

supportRouter.get('/tickets/:id', async (req, res) => {
  const ticket = await prisma.ticket.findFirst({
    where: { id: req.params.id, workspaceId: wsId(req) },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!ticket) throw notFound('Ticket');
  res.json({ ticket });
});

supportRouter.post('/tickets/:id/messages', async (req, res) => {
  const input = ticketReplySchema.parse(req.body);
  const ticket = await prisma.ticket.findFirst({ where: { id: req.params.id, workspaceId: wsId(req) } });
  if (!ticket) throw notFound('Ticket');
  const message = await prisma.ticketMessage.create({
    data: { ticketId: ticket.id, authorId: req.user!.id, fromStaff: !!req.actingAsStaff, body: input.body },
  });
  await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'OPEN' } });
  notifyStaff(`Reply on: ${ticket.subject}`, `${input.body}\n\n${env.appUrl}/admin/support/${ticket.id}`);
  res.status(201).json({ message });
});

/**
 * AI support assistant (Pro). Streams Server-Sent Events:
 *   data: {"delta": "..."}   — text as it is generated
 *   data: {"done": true}     — end of reply
 *   data: {"error": "..."}   — failure after streaming started
 */
supportRouter.post('/assistant', requireFeature('aiSupportAssistant'), assistantLimiter, async (req, res) => {
  const { messages } = assistantMessageSchema.parse(req.body);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  try {
    const { refused } = await streamAssistantReply(wsId(req), messages, (delta) => send({ delta }));
    if (refused) send({ delta: "\n\nI can't help with that one. Please open a support ticket and the team will take a look." });
    send({ done: true });
  } catch (err) {
    logger.error({ err }, 'Assistant reply failed');
    send({ error: 'The assistant is unavailable right now. Please try again or open a ticket.' });
  }
  res.end();
});
