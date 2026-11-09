'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/cn';
import { Loading, Modal, PageHeader, Section, Tabs, useAction } from '@/components/ui';

interface Window {
  start: string;
  end: string;
}
type WorkingHours = Record<string, Window[]>;

interface Settings {
  timezone: string;
  workingHours: WorkingHours;
  defaultDurationMin: number;
  slotStepMin: number;
  bufferMin: number;
  minNoticeMin: number;
  maxDaysAhead: number;
  googleSyncEnabled: boolean;
}
interface SettingsResponse {
  settings: Settings;
  google: {
    connected: boolean;
    account: string | null;
    lastError: string | null;
    lastSyncAt: string | null;
  };
}
interface Appointment {
  id: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  startsAt: string;
  endsAt: string;
  status: string;
  title: string | null;
  location: string | null;
  notes: string | null;
  source: string;
  callId: string | null;
  externalEventUrl: string | null;
}
interface Block {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  source: string;
}
interface EventsResponse {
  timezone: string;
  appointments: Appointment[];
  blocks: Block[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SOURCE_LABEL: Record<string, string> = {
  AI: 'Booked by an agent',
  MANUAL: 'Added by hand',
  API: 'Added through the API',
};

// ── Date helpers (calendar days are plain Y-M-D strings in the calendar's time zone) ──

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const fromYmd = (s: string) => new Date(`${s}T00:00:00Z`);

function parts(iso: string, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

const timeLabel = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  );

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(fromYmd(date));

function todayIn(tz: string) {
  return parts(new Date().toISOString(), tz).date;
}

/** Six-week grid starting on the Sunday on or before the 1st. */
function monthGrid(month: string): string[] {
  const first = fromYmd(`${month}-01`);
  const start = new Date(first.getTime() - first.getUTCDay() * 86_400_000);
  return Array.from({ length: 42 }, (_, i) => ymd(new Date(start.getTime() + i * 86_400_000)));
}

const shiftMonth = (month: string, by: number) => {
  const d = fromYmd(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return ymd(d).slice(0, 7);
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [tab, setTab] = useState<'calendar' | 'settings'>('calendar');
  const config = useApi<SettingsResponse>('/app/calendar/settings');
  if (!config.data) return <Loading />;
  const tz = config.data.settings.timezone;
  return (
    <>
      <PageHeader
        title="Calendar"
        description="Your own calendar. Agents read it to offer open times and write to it when someone books, so it works without any other calendar. Connect Google Calendar to keep both in step."
        actions={
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'calendar', label: 'Calendar' },
              { value: 'settings', label: 'Hours & sync' },
            ]}
          />
        }
      />
      {tab === 'calendar' ? (
        <CalendarView tz={tz} settings={config.data.settings} />
      ) : (
        <SettingsView data={config.data} onSaved={config.reload} />
      )}
    </>
  );
}

function CalendarView({ tz, settings }: { tz: string; settings: Settings }) {
  const today = todayIn(tz);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const [booking, setBooking] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const grid = useMemo(() => monthGrid(month), [month]);
  const from = new Date(fromYmd(grid[0]!).getTime() - 86_400_000).toISOString();
  const to = new Date(fromYmd(grid[41]!).getTime() + 2 * 86_400_000).toISOString();
  const events = useApi<EventsResponse>(
    `/app/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  const { run } = useAction();

  const byDay = useMemo(() => {
    const map = new Map<string, { appointments: Appointment[]; blocks: Block[] }>();
    const slot = (d: string) => {
      if (!map.has(d)) map.set(d, { appointments: [], blocks: [] });
      return map.get(d)!;
    };
    for (const a of events.data?.appointments ?? [])
      if (a.status !== 'CANCELED') slot(parts(a.startsAt, tz).date).appointments.push(a);
    for (const b of events.data?.blocks ?? []) slot(parts(b.startsAt, tz).date).blocks.push(b);
    return map;
  }, [events.data, tz]);

  const day = byDay.get(selected);
  const open = settings.workingHours[String(fromYmd(selected).getUTCDay())]?.length;

  const patch = (id: string, body: object, ok: string) =>
    run(async () => {
      await api(`/app/appointments/${id}`, { method: 'PATCH', body });
      await events.reload();
    }, ok);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="card p-3 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {new Intl.DateTimeFormat('en-US', {
              timeZone: 'UTC',
              month: 'long',
              year: 'numeric',
            }).format(fromYmd(`${month}-01`))}
          </h2>
          <div className="flex items-center gap-1">
            <button
              className="btn btn-ghost btn-icon"
              aria-label="Previous month"
              onClick={() => setMonth(shiftMonth(month, -1))}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setMonth(today.slice(0, 7));
                setSelected(today);
              }}
            >
              Today
            </button>
            <button
              className="btn btn-ghost btn-icon"
              aria-label="Next month"
              onClick={() => setMonth(shiftMonth(month, 1))}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-line bg-line text-sm">
          {DAYS.map((d) => (
            <div
              key={d}
              className="bg-surface-2 px-2 py-1.5 text-center text-xs font-semibold text-muted"
            >
              {d}
            </div>
          ))}
          {grid.map((date) => {
            const info = byDay.get(date);
            const count = (info?.appointments.length ?? 0) + (info?.blocks.length ?? 0);
            const closed = !settings.workingHours[String(fromYmd(date).getUTCDay())]?.length;
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelected(date)}
                aria-pressed={selected === date}
                aria-label={`${dayLabel(date)}, ${count} item${count === 1 ? '' : 's'}`}
                className={cn(
                  'flex min-h-[64px] flex-col items-start gap-1 bg-surface p-1.5 text-left transition-colors hover:bg-brand-50 sm:min-h-[84px] sm:p-2',
                  date.slice(0, 7) !== month && 'text-muted/60',
                  closed && 'bg-surface-2',
                  selected === date && 'ring-2 ring-inset ring-brand-600',
                )}
              >
                <span
                  className={cn(
                    'num inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold',
                    date === today && 'bg-brand-600 text-white',
                  )}
                >
                  {Number(date.slice(8))}
                </span>
                {info?.appointments.slice(0, 2).map((a) => (
                  <span
                    key={a.id}
                    className="hidden w-full truncate rounded bg-brand-100 px-1 text-[11px] font-medium text-brand-900 sm:block"
                  >
                    {timeLabel(a.startsAt, tz)} {a.title || a.contactName}
                  </span>
                ))}
                {count > 0 && (
                  <span className="num text-[11px] font-semibold text-brand-700 sm:hidden">
                    {count}
                  </span>
                )}
                {count > 2 && (
                  <span className="hidden text-[11px] text-muted sm:block">+{count - 2} more</span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">
          Times shown in {tz}. Shaded days are closed under your opening hours.
        </p>
      </div>

      <div className="space-y-4">
        <div className="card card-pad">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{dayLabel(selected)}</h2>
              <p className="text-xs text-muted">{open ? 'Open for bookings' : 'Closed'}</p>
            </div>
            <div className="flex gap-1.5">
              <button className="btn btn-primary btn-sm" onClick={() => setBooking(true)}>
                <Plus size={14} /> Book
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setBlocking(true)}>
                Block time
              </button>
            </div>
          </div>
          {!day || day.appointments.length + day.blocks.length === 0 ? (
            <p className="text-sm text-muted">Nothing scheduled.</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {[
                ...day.appointments.map((a) => ({ kind: 'a' as const, at: a.startsAt, a })),
                ...day.blocks.map((b) => ({ kind: 'b' as const, at: b.startsAt, b })),
              ]
                .sort((x, y) => x.at.localeCompare(y.at))
                .map((item) =>
                  item.kind === 'a' ? (
                    <li key={item.a.id} className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="num text-sm font-semibold">
                            {timeLabel(item.a.startsAt, tz)} – {timeLabel(item.a.endsAt, tz)}
                          </p>
                          <p className="truncate font-medium">
                            {item.a.title || item.a.contactName}
                          </p>
                          <p className="num truncate text-xs text-muted">
                            {item.a.contactName}
                            {item.a.contactPhone ? ` · ${item.a.contactPhone}` : ''}
                            {item.a.contactEmail ? ` · ${item.a.contactEmail}` : ''}
                          </p>
                          {item.a.location && (
                            <p className="text-xs text-ink-soft">{item.a.location}</p>
                          )}
                          {item.a.notes && (
                            <p className="mt-1 text-xs text-ink-soft">{item.a.notes}</p>
                          )}
                          <p className="mt-1 text-[11px] text-muted">
                            {SOURCE_LABEL[item.a.source] ?? item.a.source}
                            {item.a.externalEventUrl && (
                              <>
                                {' · '}
                                <a
                                  href={item.a.externalEventUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="font-semibold text-brand-700"
                                >
                                  In Google Calendar
                                </a>
                              </>
                            )}
                            {item.a.callId && (
                              <>
                                {' · '}
                                <Link
                                  href={`/dashboard/calls/${item.a.callId}`}
                                  className="font-semibold text-brand-700"
                                >
                                  Call
                                </Link>
                              </>
                            )}
                          </p>
                        </div>
                        {item.a.status !== 'SCHEDULED' && (
                          <span className="badge badge-neutral">{item.a.status.toLowerCase()}</span>
                        )}
                      </div>
                      {item.a.status === 'SCHEDULED' && (
                        <div className="mt-2 flex gap-1">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              patch(item.a.id, { status: 'COMPLETED' }, 'Marked as held')
                            }
                          >
                            Held
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              patch(item.a.id, { status: 'NO_SHOW' }, 'Marked as no-show')
                            }
                          >
                            No-show
                          </button>
                          <button
                            className="btn btn-ghost btn-sm text-danger"
                            onClick={() => patch(item.a.id, { status: 'CANCELED' }, 'Cancelled')}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </li>
                  ) : (
                    <li key={item.b.id} className="flex items-center justify-between gap-2 py-3">
                      <div>
                        <p className="num text-sm font-semibold">
                          {timeLabel(item.b.startsAt, tz)} – {timeLabel(item.b.endsAt, tz)}
                        </p>
                        <p className="text-sm">{item.b.title}</p>
                        <p className="text-[11px] text-muted">
                          {item.b.source === 'GOOGLE' ? 'From Google Calendar' : 'Blocked by you'}
                        </p>
                      </div>
                      {item.b.source === 'MANUAL' && (
                        <button
                          className="btn btn-ghost btn-sm text-danger"
                          onClick={() =>
                            run(async () => {
                              await api(`/app/calendar/blocks/${item.b.id}`, { method: 'DELETE' });
                              await events.reload();
                            }, 'Removed')
                          }
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ),
                )}
            </ul>
          )}
        </div>
        <OpenSlots date={selected} tz={tz} duration={settings.defaultDurationMin} />
      </div>

      <BookingModal
        open={booking}
        date={selected}
        defaultDuration={settings.defaultDurationMin}
        onClose={() => setBooking(false)}
        onDone={() => {
          setBooking(false);
          void events.reload();
        }}
      />
      <BlockModal
        open={blocking}
        date={selected}
        onClose={() => setBlocking(false)}
        onDone={() => {
          setBlocking(false);
          void events.reload();
        }}
      />
    </div>
  );
}

/** What an agent would offer for this day, straight from the same slot logic. */
function OpenSlots({ date, tz, duration }: { date: string; tz: string; duration: number }) {
  const slots = useApi<{ slots: string[] }>(`/app/calendar/slots?date=${date}`);
  return (
    <div className="card card-pad">
      <h3 className="font-semibold">Open {duration}-minute slots</h3>
      <p className="mb-3 text-xs text-muted">What agents can offer callers for this day.</p>
      {!slots.data ? (
        <p className="text-sm text-muted">Checking…</p>
      ) : slots.data.slots.length === 0 ? (
        <p className="text-sm text-muted">No open slots.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {slots.data.slots.map((s) => (
            <span key={s} className="chip num">
              {timeLabel(s, tz)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function BookingModal(props: {
  open: boolean;
  date: string;
  defaultDuration: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, busy } = useAction();
  const [f, setF] = useState({
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    time: '10:00',
    durationMin: props.defaultDuration,
    title: '',
    location: '',
    notes: '',
    override: false,
  });
  const set = (k: keyof typeof f, v: string | number | boolean) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Modal open={props.open} onClose={props.onClose} title={`Book on ${dayLabel(props.date)}`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api('/app/calendar/appointments', {
              method: 'POST',
              body: {
                contactName: f.contactName,
                contactPhone: f.contactPhone,
                contactEmail: f.contactEmail,
                start: `${props.date}T${f.time}`,
                durationMin: f.durationMin,
                title: f.title || undefined,
                location: f.location || undefined,
                notes: f.notes || undefined,
                override: f.override,
              },
            });
            props.onDone();
          }, 'Appointment booked');
        }}
      >
        <div>
          <label className="label" htmlFor="ap-name">
            Name
          </label>
          <input
            id="ap-name"
            className="input"
            required
            value={f.contactName}
            maxLength={160}
            onChange={(e) => set('contactName', e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ap-phone">
              Phone
            </label>
            <input
              id="ap-phone"
              className="input"
              value={f.contactPhone}
              onChange={(e) => set('contactPhone', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="ap-email">
              Email
            </label>
            <input
              id="ap-email"
              type="email"
              className="input"
              value={f.contactEmail}
              onChange={(e) => set('contactEmail', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="ap-time">
              Start time
            </label>
            <input
              id="ap-time"
              type="time"
              className="input"
              required
              value={f.time}
              onChange={(e) => set('time', e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="ap-dur">
              Minutes
            </label>
            <input
              id="ap-dur"
              type="number"
              min={5}
              max={480}
              step={5}
              className="input"
              value={f.durationMin}
              onChange={(e) => set('durationMin', Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="ap-title">
            Title (optional)
          </label>
          <input
            id="ap-title"
            className="input"
            value={f.title}
            maxLength={160}
            onChange={(e) => set('title', e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="ap-loc">
            Location or meeting link (optional)
          </label>
          <input
            id="ap-loc"
            className="input"
            value={f.location}
            maxLength={300}
            onChange={(e) => set('location', e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="ap-notes">
            Notes
          </label>
          <textarea
            id="ap-notes"
            className="input min-h-[70px]"
            value={f.notes}
            maxLength={2000}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.override}
            onChange={(e) => set('override', e.target.checked)}
          />
          Allow outside opening hours
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={props.onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            Book appointment
          </button>
        </div>
      </form>
    </Modal>
  );
}

function BlockModal(props: {
  open: boolean;
  date: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const { run, busy } = useAction();
  const [title, setTitle] = useState('Busy');
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('17:00');
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={`Block time on ${dayLabel(props.date)}`}
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api('/app/calendar/blocks', {
              method: 'POST',
              body: { title, start: `${props.date}T${from}`, end: `${props.date}T${to}` },
            });
            props.onDone();
          }, 'Time blocked');
        }}
      >
        <p className="text-sm text-muted">Agents will not offer or book anything in this window.</p>
        <div>
          <label className="label" htmlFor="bl-title">
            Label
          </label>
          <input
            id="bl-title"
            className="input"
            value={title}
            maxLength={160}
            required
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="bl-from">
              From
            </label>
            <input
              id="bl-from"
              type="time"
              className="input"
              value={from}
              required
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="bl-to">
              To
            </label>
            <input
              id="bl-to"
              type="time"
              className="input"
              value={to}
              required
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn btn-ghost" onClick={props.onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            Block time
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ── Hours & sync ─────────────────────────────────────────────────────────────

function SettingsView({ data, onSaved }: { data: SettingsResponse; onSaved: () => Promise<void> }) {
  const { run, busy } = useAction();
  const [s, setS] = useState<Settings>(data.settings);
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf(
        'timeZone',
      );
    } catch {
      return [];
    }
  }, []);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((x) => ({ ...x, [k]: v }));

  const setDay = (d: number, w: Window[] | null) =>
    setS((x) => {
      const hours = { ...x.workingHours };
      if (w) hours[String(d)] = w;
      else delete hours[String(d)];
      return { ...x, workingHours: hours };
    });

  const num = (
    label: string,
    id: string,
    k: keyof Settings,
    suffix: string,
    min = 0,
    max = 1000,
  ) => (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          className="input w-28"
          min={min}
          max={max}
          value={s[k] as number}
          onChange={(e) => set(k, Number(e.target.value) as never)}
        />
        <span className="text-sm text-muted">{suffix}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Section
        title="Opening hours"
        description="Agents only offer and book times inside these hours."
      >
        <div className="mb-4 max-w-sm">
          <label className="label" htmlFor="cal-tz">
            Time zone
          </label>
          <input
            id="cal-tz"
            className="input"
            list="cal-zones"
            value={s.timezone}
            onChange={(e) => set('timezone', e.target.value)}
          />
          <datalist id="cal-zones">
            {zones.map((z) => (
              <option key={z} value={z} />
            ))}
          </datalist>
        </div>
        <ul className="divide-y divide-line/70">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const w = s.workingHours[String(d)]?.[0];
            return (
              <li key={d} className="flex flex-wrap items-center gap-3 py-2.5">
                <label className="flex w-28 items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={!!w}
                    onChange={(e) =>
                      setDay(d, e.target.checked ? [{ start: '09:00', end: '17:00' }] : null)
                    }
                  />
                  {DAYS[d]}
                </label>
                {w ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      className="input h-9 w-32"
                      aria-label={`${DAYS[d]} opens`}
                      value={w.start}
                      onChange={(e) => setDay(d, [{ ...w, start: e.target.value }])}
                    />
                    <span className="text-muted">to</span>
                    <input
                      type="time"
                      className="input h-9 w-32"
                      aria-label={`${DAYS[d]} closes`}
                      value={w.end}
                      onChange={(e) => setDay(d, [{ ...w, end: e.target.value }])}
                    />
                  </div>
                ) : (
                  <span className="text-sm text-muted">Closed</span>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Booking rules">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {num('Default length', 'cal-dur', 'defaultDurationMin', 'minutes', 5, 480)}
          {num('Slot spacing', 'cal-step', 'slotStepMin', 'minutes', 5, 240)}
          {num('Gap between meetings', 'cal-buf', 'bufferMin', 'minutes', 0, 240)}
          {num('Minimum notice', 'cal-notice', 'minNoticeMin', 'minutes', 0, 20160)}
          {num('Book up to', 'cal-ahead', 'maxDaysAhead', 'days ahead', 1, 365)}
        </div>
        <p className="mt-3 text-xs text-muted">
          An agent&apos;s own appointment length (set on the agent) overrides the default length.
        </p>
      </Section>

      <Section
        title="Google Calendar sync"
        description="Optional. Bookings are added to your Google calendar, and busy events in it block those times here."
      >
        {data.google.connected ? (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={s.googleSyncEnabled}
                onChange={(e) => set('googleSyncEnabled', e.target.checked)}
              />
              Sync with {data.google.account ?? 'Google Calendar'}
            </label>
            {data.google.lastSyncAt && (
              <p className="text-xs text-muted">
                Last synced {new Date(data.google.lastSyncAt).toLocaleString()}
              </p>
            )}
            {data.google.lastError && (
              <p className="text-sm text-danger">Last sync problem: {data.google.lastError}</p>
            )}
            {data.settings.googleSyncEnabled && (
              <button
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api('/app/calendar/sync', { method: 'POST' });
                    await onSaved();
                  }, 'Synced with Google')
                }
              >
                <RefreshCw size={14} /> Sync now
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Google Calendar is not connected.{' '}
            <Link href="/dashboard/integrations" className="font-semibold text-brand-700">
              Connect it in Integrations
            </Link>
            , then turn sync on here.
          </p>
        )}
      </Section>

      <div className="flex justify-end">
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api('/app/calendar/settings', { method: 'PUT', body: s });
              await onSaved();
            }, 'Calendar settings saved')
          }
        >
          <CalendarDays size={16} /> Save settings
        </button>
      </div>
    </div>
  );
}
