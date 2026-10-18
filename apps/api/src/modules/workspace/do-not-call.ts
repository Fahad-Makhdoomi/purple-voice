import { Router } from 'express';
import { paginationSchema } from '@pv/shared';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/http-error';
import { toE164 } from '../../lib/csv';
import { wsId } from '../../middleware/workspace';
import { addToDoNotCall } from '../../services/do-not-call';

/** The workspace's do-not-call list: /api/app/do-not-call. */
export const doNotCallRouter = Router();

const addSchema = z.object({
  /** One or more numbers, separated by new lines, commas or semicolons. */
  phones: z.string().trim().min(5).max(200_000),
  note: z.string().trim().max(300).optional(),
});

doNotCallRouter.get('/', async (req, res) => {
  const { page, pageSize, q } = paginationSchema.parse(req.query);
  const where = { workspaceId: wsId(req), ...(q ? { phone: { contains: q } } : {}) };
  const [numbers, total] = await Promise.all([
    prisma.doNotCallNumber.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.doNotCallNumber.count({ where }),
  ]);
  res.json({ numbers, total, page, pageSize });
});

doNotCallRouter.post('/', async (req, res) => {
  const { phones, note } = addSchema.parse(req.body);
  const workspaceId = wsId(req);
  const raw = phones
    .split(/[\n,;]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (raw.length > 10_000) throw badRequest('Add up to 10,000 numbers at a time');
  const valid = [...new Set(raw.map((p) => toE164(p)).filter((p): p is string => !!p))];
  if (!valid.length)
    throw badRequest('No valid numbers. Use international format, e.g. +14155550123');
  for (const phone of valid)
    await addToDoNotCall(workspaceId, phone, raw.length > 1 ? 'import' : 'manual', note);
  await audit(req, 'dnc.added', { meta: { count: valid.length } });
  res.status(201).json({ added: valid.length, invalid: raw.length - valid.length });
});

doNotCallRouter.delete('/:id', async (req, res) => {
  const workspaceId = wsId(req);
  const row = await prisma.doNotCallNumber.findFirst({ where: { id: req.params.id, workspaceId } });
  if (!row) throw notFound('Number');
  await prisma.doNotCallNumber.delete({ where: { id: row.id } });
  // Contacts stay marked do-not-call; removing a number only allows new campaigns to call it.
  await audit(req, 'dnc.removed', { meta: { phone: row.phone } });
  res.json({ ok: true });
});
