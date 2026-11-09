import type { Appointment, Integration, Prisma } from '@prisma/client';
import { DEFAULT_WORKING_HOURS, type WorkingHours } from '@pv/shared';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { badRequest, notFound } from '../lib/http-error';
import { isValidTimeZone, utcToZoned, zonedToUtc } from '../voice/time';
import {
  busySlots,
  createEvent,
  deleteEvent,
  listBusyEvents,
  updateEvent,
} from './google-calendar';

/**
 * The workspace's own calendar. Appointments, blocks and opening hours live
 * in our database, so booking works with no Google account at all; when
 * Google sync is on, bookings are pushed to it and its busy events are pulled
 * in as blocks. Agents, the dashboard and the developer API all go through here.
 */

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

export interface CalendarConfig {
  timezone: string;
  workingHours: WorkingHours;
  defaultDurationMin: number;
  slotStepMin: number;
  bufferMin: number;
  minNoticeMin: number;
  maxDaysAhead: number;
  googleSyncEnabled: boolean;
  googleIntegrationId: string | null;
  lastSyncAt: Date | null;
  lastSyncError: string | null;
}

export async function getCalendarConfig(workspaceId: string): Promise<CalendarConfig> {
  const [row, ws] = await Promise.all([
    prisma.calendarSettings.findUnique({ where: { workspaceId } }),
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { timezone: true } }),
  ]);
  const tz = row?.timezone ?? ws.timezone;
  return {
    timezone: isValidTimeZone(tz) ? tz : 'UTC',
    workingHours: (row?.workingHours as WorkingHours | undefined) ?? DEFAULT_WORKING_HOURS,
    defaultDurationMin: row?.defaultDurationMin ?? 30,
    slotStepMin: row?.slotStepMin ?? 30,
    bufferMin: row?.bufferMin ?? 0,
    minNoticeMin: row?.minNoticeMin ?? 60,
    maxDaysAhead: row?.maxDaysAhead ?? 60,
    googleSyncEnabled: row?.googleSyncEnabled ?? false,
    googleIntegrationId: row?.googleIntegrationId ?? null,
    lastSyncAt: row?.lastSyncAt ?? null,
    lastSyncError: row?.lastSyncError ?? null,
  };
}

// ── Slot maths (pure) ───────────────────────────────────────────────────────

export interface Interval {
  start: number;
  end: number;
}

export interface SlotRules {
  timezone: string;
  workingHours: WorkingHours;
  durationMin: number;
  slotStepMin: number;
  bufferMin: number;
  minNoticeMin: number;
  maxDaysAhead: number;
}

/** Whether [start, end) sits inside one of the day's opening windows and clear of every busy interval. */
export function fitsRules(
  startsAt: Date,
  durationMin: number,
  rules: SlotRules,
  busy: Interval[],
  now = Date.now(),
): { ok: true } | { ok: false; reason: string } {
  const start = startsAt.getTime();
  const end = start + durationMin * MIN;
  if (start < now + rules.minNoticeMin * MIN)
    return { ok: false, reason: 'That time is too soon or already past.' };
  if (start > now + rules.maxDaysAhead * DAY)
    return { ok: false, reason: `Bookings open up to ${rules.maxDaysAhead} days ahead.` };
  const z = utcToZoned(startsAt, rules.timezone);
  const windows = rules.workingHours[String(z.weekday) as keyof WorkingHours] ?? [];
  const inside = windows.some(
    (w) =>
      start >= zonedToUtc(z.date, w.start, rules.timezone).getTime() &&
      end <= zonedToUtc(z.date, w.end, rules.timezone).getTime(),
  );
  if (!inside) return { ok: false, reason: 'That time is outside opening hours.' };
  const buffer = rules.bufferMin * MIN;
  if (busy.some((b) => start < b.end + buffer && end > b.start - buffer))
    return { ok: false, reason: 'That slot is taken.' };
  return { ok: true };
}

/** Open slot starts on one local day, earliest first. */
export function slotsForDay(
  date: string,
  rules: SlotRules,
  busy: Interval[],
  now = Date.now(),
): Date[] {
  const noon = zonedToUtc(date, '12:00', rules.timezone);
  const weekday = utcToZoned(noon, rules.timezone).weekday;
  const windows = rules.workingHours[String(weekday) as keyof WorkingHours] ?? [];
  const out: Date[] = [];
  for (const w of windows) {
    const from = zonedToUtc(date, w.start, rules.timezone).getTime();
    const to = zonedToUtc(date, w.end, rules.timezone).getTime();
    for (let t = from; t + rules.durationMin * MIN <= to; t += rules.slotStepMin * MIN) {
      const at = new Date(t);
      if (fitsRules(at, rules.durationMin, rules, busy, now).ok) out.push(at);
    }
  }
  return out;
}

/** The local calendar date `offset` days after `date` (DST-safe: steps from local noon). */
export function addDays(date: string, offset: number, tz: string): string {
  return utcToZoned(new Date(zonedToUtc(date, '12:00', tz).getTime() + offset * DAY), tz).date;
}

// ── Busy time ───────────────────────────────────────────────────────────────

/**
 * Google integration to sync with: the calendar's own, else (for agents set
 * up before the standalone calendar existed) the one picked on the agent.
 */
export async function googleFor(
  workspaceId: string,
  config: CalendarConfig,
  legacyIntegrationId?: string | null,
): Promise<Integration | null> {
  const id = config.googleSyncEnabled ? config.googleIntegrationId : legacyIntegrationId;
  if (!id) return null;
  return prisma.integration.findFirst({
    where: { id, workspaceId, type: 'GOOGLE_CALENDAR' },
  });
}

export async function busyBetween(
  workspaceId: string,
  from: Date,
  to: Date,
  google: Integration | null,
): Promise<Interval[]> {
  const [appointments, blocks] = await Promise.all([
    prisma.appointment.findMany({
      where: { workspaceId, status: 'SCHEDULED', startsAt: { lt: to }, endsAt: { gt: from } },
      select: { startsAt: true, endsAt: true },
    }),
    prisma.calendarBlock.findMany({
      where: { workspaceId, startsAt: { lt: to }, endsAt: { gt: from } },
      select: { startsAt: true, endsAt: true },
    }),
  ]);
  const busy: Interval[] = [...appointments, ...blocks].map((b) => ({
    start: b.startsAt.getTime(),
    end: b.endsAt.getTime(),
  }));
  if (google) {
    // Live check so a meeting added to Google a minute ago still blocks the slot;
    // if Google is down the synced blocks above are the fallback.
    try {
      for (const b of await busySlots(google, from, to))
        busy.push({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() });
    } catch (err) {
      logger.warn({ err, workspaceId }, 'Google free/busy unavailable; using synced blocks');
    }
  }
  return busy;
}

export interface SlotQuery {
  date: string;
  /** Scan this many consecutive days (default 1) until `limit` slots are found. */
  days?: number;
  durationMin?: number;
  limit?: number;
  legacyIntegrationId?: string | null;
}

export async function availableSlots(workspaceId: string, q: SlotQuery) {
  const config = await getCalendarConfig(workspaceId);
  const rules: SlotRules = {
    ...config,
    durationMin: q.durationMin ?? config.defaultDurationMin,
  };
  const days = Math.min(Math.max(q.days ?? 1, 1), 14);
  const from = zonedToUtc(q.date, '00:00', config.timezone);
  const to = zonedToUtc(addDays(q.date, days, config.timezone), '00:00', config.timezone);
  const google = await googleFor(workspaceId, config, q.legacyIntegrationId);
  const busy = await busyBetween(workspaceId, from, to, google);
  const limit = q.limit ?? 200;
  const slots: Date[] = [];
  for (let i = 0; i < days && slots.length < limit; i++) {
    const day = addDays(q.date, i, config.timezone);
    slots.push(...slotsForDay(day, rules, busy).slice(0, limit - slots.length));
  }
  return { timezone: config.timezone, durationMin: rules.durationMin, slots };
}

// ── Booking ─────────────────────────────────────────────────────────────────

export interface BookingInput {
  contactName: string;
  contactPhone: string;
  contactEmail?: string | null;
  /** Wall-clock start in the calendar's time zone, YYYY-MM-DDTHH:mm. */
  start: string;
  durationMin?: number;
  title?: string;
  location?: string;
  notes?: string;
  source: 'AI' | 'MANUAL' | 'API';
  callId?: string;
  /** Skip opening-hours and notice checks (staff booking by hand). Clashes still apply. */
  override?: boolean;
  legacyIntegrationId?: string | null;
}

function localToUtc(start: string, tz: string): Date {
  const [date, time] = start.split('T');
  return zonedToUtc(date!, time!, tz);
}

function eventText(a: Pick<Appointment, 'contactName' | 'contactPhone' | 'notes' | 'title'>) {
  return {
    summary: a.title || `Appointment: ${a.contactName}`,
    description: [
      `Booked with Purple Voice. ${a.contactName}${a.contactPhone ? ` · ${a.contactPhone}` : ''}`,
      a.notes,
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
}

/** Takes the workspace's booking lock so two callers cannot grab the same slot. */
async function withBookingLock<T>(
  workspaceId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'calendar:' + workspaceId}))`;
    return fn(tx);
  });
}

async function assertSlotFree(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  startsAt: Date,
  endsAt: Date,
  bufferMin: number,
  ignoreId?: string,
) {
  const from = new Date(startsAt.getTime() - bufferMin * MIN);
  const to = new Date(endsAt.getTime() + bufferMin * MIN);
  const [a, b] = await Promise.all([
    tx.appointment.count({
      where: {
        workspaceId,
        status: 'SCHEDULED',
        id: ignoreId ? { not: ignoreId } : undefined,
        startsAt: { lt: to },
        endsAt: { gt: from },
      },
    }),
    tx.calendarBlock.count({
      where: { workspaceId, startsAt: { lt: to }, endsAt: { gt: from } },
    }),
  ]);
  if (a + b > 0) throw badRequest('That slot is taken. Check availability again.');
}

/** Pushes a booking to Google; a failure is kept on the appointment's sync status, never blocks the booking. */
async function pushToGoogle(
  google: Integration | null,
  a: Appointment,
): Promise<Pick<Appointment, 'externalEventId' | 'externalEventUrl'>> {
  if (!google) return { externalEventId: null, externalEventUrl: null };
  try {
    const event = await createEvent(google, {
      ...eventText(a),
      location: a.location ?? undefined,
      start: a.startsAt,
      end: a.endsAt,
      timeZone: a.timezone,
      attendeeEmail: a.contactEmail ?? undefined,
    });
    return { externalEventId: event.id, externalEventUrl: event.htmlLink };
  } catch (err) {
    logger.warn({ err, appointmentId: a.id }, 'Could not add the booking to Google Calendar');
    return { externalEventId: null, externalEventUrl: null };
  }
}

export async function bookAppointment(workspaceId: string, input: BookingInput) {
  const config = await getCalendarConfig(workspaceId);
  const tz = config.timezone;
  const duration = input.durationMin ?? config.defaultDurationMin;
  const startsAt = localToUtc(input.start, tz);
  if (Number.isNaN(startsAt.getTime())) throw badRequest('Invalid start time');
  const endsAt = new Date(startsAt.getTime() + duration * MIN);
  const google = await googleFor(workspaceId, config, input.legacyIntegrationId);

  if (!input.override) {
    const busy = await busyBetween(
      workspaceId,
      new Date(startsAt.getTime() - DAY),
      new Date(endsAt.getTime() + DAY),
      google,
    );
    const fit = fitsRules(startsAt, duration, { ...config, durationMin: duration }, busy);
    if (!fit.ok) throw badRequest(fit.reason);
  } else if (startsAt.getTime() < Date.now() - 30 * DAY) {
    throw badRequest('That time is too far in the past.');
  }

  const created = await withBookingLock(workspaceId, async (tx) => {
    await assertSlotFree(tx, workspaceId, startsAt, endsAt, input.override ? 0 : config.bufferMin);
    return tx.appointment.create({
      data: {
        workspaceId,
        callId: input.callId,
        integrationId: google?.id,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        contactEmail: input.contactEmail || null,
        startsAt,
        endsAt,
        timezone: tz,
        title: input.title || null,
        location: input.location || null,
        notes: input.notes || null,
        source: input.source,
      },
    });
  });

  const external = await pushToGoogle(google, created);
  if (!external.externalEventId) return created;
  return prisma.appointment.update({ where: { id: created.id }, data: external });
}

export async function rescheduleAppointment(
  workspaceId: string,
  id: string,
  change: { start: string; durationMin?: number; override?: boolean },
) {
  const existing = await prisma.appointment.findFirst({ where: { id, workspaceId } });
  if (!existing) throw notFound('Appointment');
  if (existing.status !== 'SCHEDULED') throw badRequest('Only scheduled appointments can be moved');
  const config = await getCalendarConfig(workspaceId);
  const google = await googleFor(workspaceId, config, null);
  const duration =
    change.durationMin ??
    Math.round((existing.endsAt.getTime() - existing.startsAt.getTime()) / MIN);
  const startsAt = localToUtc(change.start, config.timezone);
  const endsAt = new Date(startsAt.getTime() + duration * MIN);

  if (!change.override) {
    const busy = (
      await busyBetween(
        workspaceId,
        new Date(startsAt.getTime() - DAY),
        new Date(endsAt.getTime() + DAY),
        google,
      )
    ).filter(
      // Our own current slot must not block moving by a few minutes.
      (b) => !(b.start === existing.startsAt.getTime() && b.end === existing.endsAt.getTime()),
    );
    const fit = fitsRules(startsAt, duration, { ...config, durationMin: duration }, busy);
    if (!fit.ok) throw badRequest(fit.reason);
  }

  const moved = await withBookingLock(workspaceId, async (tx) => {
    await assertSlotFree(
      tx,
      workspaceId,
      startsAt,
      endsAt,
      change.override ? 0 : config.bufferMin,
      id,
    );
    return tx.appointment.update({
      where: { id },
      data: { startsAt, endsAt, timezone: config.timezone },
    });
  });
  await syncChange(moved, google, 'update');
  return moved;
}

export async function cancelAppointment(workspaceId: string, id: string) {
  const existing = await prisma.appointment.findFirst({ where: { id, workspaceId } });
  if (!existing) throw notFound('Appointment');
  if (existing.status === 'CANCELED') return existing;
  const updated = await prisma.appointment.update({ where: { id }, data: { status: 'CANCELED' } });
  await syncChange(updated, await integrationOf(existing), 'delete');
  return updated;
}

async function integrationOf(a: Appointment): Promise<Integration | null> {
  if (!a.integrationId) return null;
  return prisma.integration.findFirst({
    where: { id: a.integrationId, workspaceId: a.workspaceId, type: 'GOOGLE_CALENDAR' },
  });
}

/** Mirrors an edit or cancellation onto the Google event, best effort. */
export async function syncChange(
  a: Appointment,
  google: Integration | null,
  action: 'update' | 'delete',
) {
  if (!a.externalEventId) return;
  const integration = google ?? (await integrationOf(a));
  if (!integration) return;
  try {
    if (action === 'delete') {
      await deleteEvent(integration, a.externalEventId);
    } else {
      await updateEvent(integration, a.externalEventId, {
        ...eventText(a),
        location: a.location ?? undefined,
        start: a.startsAt,
        end: a.endsAt,
        timeZone: a.timezone,
      });
    }
  } catch (err) {
    logger.warn({ err, appointmentId: a.id }, 'Could not update the Google Calendar event');
  }
}

/** A caller's own upcoming appointments, matched by the number they are calling from. */
export async function upcomingForPhone(workspaceId: string, phone: string) {
  if (!phone) return [];
  return prisma.appointment.findMany({
    where: { workspaceId, contactPhone: phone, status: 'SCHEDULED', startsAt: { gt: new Date() } },
    orderBy: { startsAt: 'asc' },
    take: 5,
  });
}

// ── Google sync ─────────────────────────────────────────────────────────────

/**
 * Pulls busy events from Google into read-only blocks (so slots stay right even
 * when Google is slow), and pushes any booking that never reached Google.
 */
export async function syncGoogle(workspaceId: string): Promise<{ pulled: number; pushed: number }> {
  const config = await getCalendarConfig(workspaceId);
  const google = await googleFor(workspaceId, config, null);
  if (!config.googleSyncEnabled || !google) return { pulled: 0, pushed: 0 };

  try {
    const from = new Date(Date.now() - DAY);
    const to = new Date(Date.now() + config.maxDaysAhead * DAY);
    const events = await listBusyEvents(google, from, to);
    // Events we pushed ourselves are already appointments; don't double-block them.
    const ours = new Set(
      (
        await prisma.appointment.findMany({
          where: { workspaceId, externalEventId: { not: null } },
          select: { externalEventId: true },
        })
      ).map((a) => a.externalEventId!),
    );
    const theirs = events.filter((e) => !ours.has(e.id));

    await prisma.$transaction([
      prisma.calendarBlock.deleteMany({
        where: {
          workspaceId,
          source: 'GOOGLE',
          startsAt: { lt: to },
          endsAt: { gt: from },
          externalEventId: { notIn: theirs.map((e) => e.id) },
        },
      }),
      ...theirs.map((e) =>
        prisma.calendarBlock.upsert({
          where: {
            workspaceId_source_externalEventId: {
              workspaceId,
              source: 'GOOGLE',
              externalEventId: e.id,
            },
          },
          create: {
            workspaceId,
            source: 'GOOGLE',
            externalEventId: e.id,
            title: e.title,
            startsAt: e.start,
            endsAt: e.end,
          },
          update: { title: e.title, startsAt: e.start, endsAt: e.end },
        }),
      ),
    ]);

    // Bookings made while Google was unreachable (or before sync was turned on).
    const unsynced = await prisma.appointment.findMany({
      where: {
        workspaceId,
        status: 'SCHEDULED',
        externalEventId: null,
        startsAt: { gt: new Date() },
      },
      take: 50,
    });
    let pushed = 0;
    for (const a of unsynced) {
      const external = await pushToGoogle(google, a);
      if (!external.externalEventId) continue;
      await prisma.appointment.update({
        where: { id: a.id },
        data: { ...external, integrationId: google.id },
      });
      pushed++;
    }

    await prisma.calendarSettings.update({
      where: { workspaceId },
      data: { lastSyncAt: new Date(), lastSyncError: null },
    });
    return { pulled: theirs.length, pushed };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    await prisma.calendarSettings
      .update({ where: { workspaceId }, data: { lastSyncError: message.slice(0, 300) } })
      .catch(() => undefined);
    throw err;
  }
}

/** Worker pass: every workspace with sync on. */
export async function syncAllGoogleCalendars() {
  const rows = await prisma.calendarSettings.findMany({
    where: { googleSyncEnabled: true },
    select: { workspaceId: true },
  });
  for (const { workspaceId } of rows) {
    await syncGoogle(workspaceId).catch((err) =>
      logger.warn({ err, workspaceId }, 'Google Calendar sync failed'),
    );
  }
}
