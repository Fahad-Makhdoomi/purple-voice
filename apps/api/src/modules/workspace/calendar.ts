import { Router } from 'express';
import { z } from 'zod';
import {
  calendarBlockSchema,
  calendarSettingsSchema,
  createAppointmentSchema,
  updateAppointmentSchema,
} from '@pv/shared';
import { prisma } from '../../lib/prisma';
import { audit } from '../../lib/audit';
import { badRequest, notFound } from '../../lib/http-error';
import { isValidTimeZone, utcToZoned, zonedToUtc } from '../../voice/time';
import { wsId } from '../../middleware/workspace';
import { entitlementsFor, requireActiveSubscription } from '../../middleware/entitlements';
import {
  availableSlots,
  bookAppointment,
  cancelAppointment,
  getCalendarConfig,
  rescheduleAppointment,
  syncChange,
  syncGoogle,
} from '../../services/calendar';

/** The standalone calendar: /api/app/calendar/*, plus appointment edits at /api/app/appointments/:id. */
export const calendarRouter = Router();

async function status(workspaceId: string) {
  const [config, integration] = await Promise.all([
    getCalendarConfig(workspaceId),
    prisma.integration.findUnique({
      where: { workspaceId_type: { workspaceId, type: 'GOOGLE_CALENDAR' } },
      select: { id: true, accountLabel: true, lastError: true },
    }),
  ]);
  return {
    settings: {
      timezone: config.timezone,
      workingHours: config.workingHours,
      defaultDurationMin: config.defaultDurationMin,
      slotStepMin: config.slotStepMin,
      bufferMin: config.bufferMin,
      minNoticeMin: config.minNoticeMin,
      maxDaysAhead: config.maxDaysAhead,
      googleSyncEnabled: config.googleSyncEnabled,
    },
    google: {
      connected: !!integration,
      account: integration?.accountLabel ?? null,
      lastError: integration?.lastError ?? config.lastSyncError,
      lastSyncAt: config.lastSyncAt,
    },
  };
}

calendarRouter.get('/calendar/settings', async (req, res) => {
  res.json(await status(wsId(req)));
});

calendarRouter.put('/calendar/settings', requireActiveSubscription, async (req, res) => {
  const input = calendarSettingsSchema.parse(req.body);
  if (!isValidTimeZone(input.timezone)) throw badRequest('Unknown time zone');
  const workspaceId = wsId(req);

  let googleIntegrationId: string | null = null;
  if (input.googleSyncEnabled) {
    if (!(await entitlementsFor(req)).features.googleCalendar)
      throw badRequest('Google Calendar is not included in your plan');
    const integration = await prisma.integration.findUnique({
      where: { workspaceId_type: { workspaceId, type: 'GOOGLE_CALENDAR' } },
    });
    if (!integration) throw badRequest('Connect Google Calendar first (Integrations)');
    googleIntegrationId = integration.id;
  }
  const data = { ...input, googleIntegrationId };
  await prisma.calendarSettings.upsert({
    where: { workspaceId },
    create: { workspaceId, ...data },
    update: data,
  });
  await audit(req, 'calendar.settings_updated', {
    entity: 'CalendarSettings',
    entityId: workspaceId,
  });
  if (input.googleSyncEnabled) await syncGoogle(workspaceId).catch(() => undefined);
  res.json(await status(workspaceId));
});

calendarRouter.post('/calendar/sync', requireActiveSubscription, async (req, res) => {
  const workspaceId = wsId(req);
  const config = await getCalendarConfig(workspaceId);
  if (!config.googleSyncEnabled) throw badRequest('Turn on Google sync first');
  const result = await syncGoogle(workspaceId);
  res.json({ ok: true, ...result });
});

/** Open slots: the same ones an agent is offered on a call. */
calendarRouter.get('/calendar/slots', async (req, res) => {
  const q = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      days: z.coerce.number().int().min(1).max(14).default(1),
      durationMin: z.coerce.number().int().min(5).max(480).optional(),
    })
    .parse(req.query);
  const { timezone, durationMin, slots } = await availableSlots(wsId(req), q);
  res.json({ timezone, durationMin, slots: slots.map((s) => s.toISOString()) });
});

/** Everything on the calendar between two instants (default: 7 days ago to 60 days ahead). */
calendarRouter.get('/calendar/events', async (req, res) => {
  const q = z
    .object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() })
    .parse(req.query);
  const workspaceId = wsId(req);
  const from = q.from ?? new Date(Date.now() - 7 * 86_400_000);
  const to = q.to ?? new Date(Date.now() + 60 * 86_400_000);
  if (to.getTime() - from.getTime() > 400 * 86_400_000) throw badRequest('Range too large');
  const [appointments, blocks, config] = await Promise.all([
    prisma.appointment.findMany({
      where: { workspaceId, startsAt: { lt: to }, endsAt: { gt: from } },
      orderBy: { startsAt: 'asc' },
      take: 1000,
    }),
    prisma.calendarBlock.findMany({
      where: { workspaceId, startsAt: { lt: to }, endsAt: { gt: from } },
      orderBy: { startsAt: 'asc' },
      take: 1000,
    }),
    getCalendarConfig(workspaceId),
  ]);
  res.json({ timezone: config.timezone, workingHours: config.workingHours, appointments, blocks });
});

calendarRouter.post('/calendar/appointments', requireActiveSubscription, async (req, res) => {
  const input = createAppointmentSchema.parse(req.body);
  const appointment = await bookAppointment(wsId(req), { ...input, source: 'MANUAL' });
  await audit(req, 'appointment.created', { entity: 'Appointment', entityId: appointment.id });
  res.status(201).json({ appointment });
});

/** Status, notes, details and moving an appointment. */
calendarRouter.patch('/appointments/:id', async (req, res) => {
  const {
    start,
    durationMin,
    status: nextStatus,
    ...fields
  } = updateAppointmentSchema.parse(req.body);
  const workspaceId = wsId(req);
  const existing = await prisma.appointment.findFirst({
    where: { id: req.params.id, workspaceId },
  });
  if (!existing) throw notFound('Appointment');

  if (nextStatus === 'CANCELED') await cancelAppointment(workspaceId, existing.id);
  else if (nextStatus)
    await prisma.appointment.update({ where: { id: existing.id }, data: { status: nextStatus } });

  if (Object.keys(fields).length) {
    const updated = await prisma.appointment.update({ where: { id: existing.id }, data: fields });
    if (!start && !durationMin && updated.status === 'SCHEDULED')
      await syncChange(updated, null, 'update');
  }
  if (start || durationMin) {
    const config = await getCalendarConfig(workspaceId);
    const z = utcToZoned(existing.startsAt, config.timezone);
    await rescheduleAppointment(workspaceId, existing.id, {
      start: start ?? `${z.date}T${z.time}`,
      durationMin,
      override: true,
    });
  }
  res.json({ appointment: await prisma.appointment.findUnique({ where: { id: existing.id } }) });
});

calendarRouter.post('/calendar/blocks', requireActiveSubscription, async (req, res) => {
  const input = calendarBlockSchema.parse(req.body);
  const workspaceId = wsId(req);
  const { timezone } = await getCalendarConfig(workspaceId);
  const [sd, st] = input.start.split('T');
  const [ed, et] = input.end.split('T');
  const block = await prisma.calendarBlock.create({
    data: {
      workspaceId,
      title: input.title,
      startsAt: zonedToUtc(sd!, st!, timezone),
      endsAt: zonedToUtc(ed!, et!, timezone),
    },
  });
  res.status(201).json({ block });
});

calendarRouter.delete('/calendar/blocks/:id', async (req, res) => {
  const result = await prisma.calendarBlock.deleteMany({
    where: { id: req.params.id, workspaceId: wsId(req), source: 'MANUAL' },
  });
  if (!result.count) throw notFound('Block');
  res.json({ ok: true });
});
