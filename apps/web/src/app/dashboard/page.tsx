'use client';

import Link from 'next/link';
import { ArrowRight, CalendarCheck, Check, PhoneCall, Target, Timer } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { useSession } from '@/lib/session';
import { useWorkspace } from '@/lib/workspace';
import { Gauge, Loading, PageHeader, Section, StatTile, StatusBadge } from '@/components/ui';
import { BarList, TrendChart } from '@/components/charts/Charts';
import {
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelative,
  humanize,
} from '@/lib/format';

interface Overview {
  setup: Record<'subscription' | 'ai' | 'telephony' | 'number' | 'agent', boolean>;
  kpis: { calls: number; avgDurationSec: number; appointments: number; conversionRate: number };
  series: Array<{ day: string; calls: number; minutes: number; answered: number }>;
  outcomes: Array<{ outcome: string; count: number }>;
  recentCalls: Array<{
    id: string;
    direction: string;
    status: string;
    toNumber: string;
    fromNumber: string;
    durationSec: number;
    outcome: string | null;
    createdAt: string;
    agent: { name: string } | null;
  }>;
  upcomingAppointments: Array<{
    id: string;
    contactName: string;
    contactPhone: string;
    startsAt: string;
  }>;
}

/** `href: null` marks a step our team does (the AI voice): shown, but nothing to click. */
const SETUP_STEPS: ReadonlyArray<{
  key: keyof Overview['setup'];
  label: string;
  href: string | null;
}> = [
  { key: 'subscription', label: 'Choose a plan', href: '/dashboard/billing' },
  { key: 'ai', label: 'AI voice ready (set up by our team)', href: null },
  { key: 'telephony', label: 'Connect a carrier', href: '/dashboard/numbers' },
  { key: 'number', label: 'Add a phone number', href: '/dashboard/numbers' },
  { key: 'agent', label: 'Build your agent', href: '/dashboard/agents/new' },
];

const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

export default function OverviewPage() {
  const { me } = useSession();
  const { entitlements, usage } = useWorkspace();
  const { data } = useApi<Overview>('/app/overview');

  if (!data) return <Loading />;
  const setupDone = SETUP_STEPS.filter((s) => data.setup[s.key]).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <PageHeader
        title={`${greeting}, ${me?.user.name.split(' ')[0] ?? 'there'}`}
        description="Here's how your agents are doing over the last 14 days."
        actions={
          <Link href="/dashboard/campaigns/new" className="btn btn-primary">
            New campaign
          </Link>
        }
      />

      {setupDone < SETUP_STEPS.length && (
        <section
          className="mb-6 rounded-xl bg-gradient-wash p-5 sm:p-6"
          aria-labelledby="setup-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="setup-title" className="font-semibold">
              Get set up
            </h2>
            <span className="text-sm text-ink-soft">
              {setupDone} of {SETUP_STEPS.length} done
            </span>
          </div>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SETUP_STEPS.map((step, i) => {
              const done = data.setup[step.key];
              const content = (
                <>
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${done ? 'bg-success text-white' : step.href ? 'bg-ink text-white' : 'bg-brand-100 text-brand-800'}`}
                  >
                    {done ? <Check size={14} aria-label="Done" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    {step.label}
                    {!step.href && !done && (
                      <span className="block text-xs font-normal text-muted">
                        Our team is on it
                      </span>
                    )}
                  </span>
                </>
              );
              return (
                <li key={step.key}>
                  {step.href ? (
                    <Link
                      href={step.href}
                      className={`flex h-full items-center gap-3 rounded-lg p-3 text-sm font-semibold transition ${done ? 'bg-white/50 text-ink-soft' : 'bg-white text-ink shadow hover:shadow-lg'}`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div
                      className={`flex h-full items-center gap-3 rounded-lg p-3 text-sm font-semibold ${done ? 'bg-white/50 text-ink-soft' : 'bg-white/70 text-ink-soft'}`}
                    >
                      {content}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Calls"
              value={formatNumber(data.kpis.calls)}
              hint={`Avg ${formatDuration(data.kpis.avgDurationSec)} per call`}
              icon={PhoneCall}
            />
            <StatTile
              label="Appointments booked"
              value={formatNumber(data.kpis.appointments)}
              hint="From calls in this period"
              icon={CalendarCheck}
            />
            <StatTile
              label="Booking rate"
              value={formatPercent(data.kpis.conversionRate)}
              hint="Appointments per call"
              icon={Target}
            />
          </div>

          <Section title="Calls per day" description="All calls, inbound and outbound.">
            <TrendChart data={data.series} x="day" y="calls" label="Calls" formatX={dayLabel} />
          </Section>

          <Section
            title="Recent calls"
            actions={
              <Link href="/dashboard/calls" className="btn btn-ghost btn-sm">
                View all <ArrowRight size={14} aria-hidden="true" />
              </Link>
            }
          >
            {data.recentCalls.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">
                No calls yet. Test an agent or start a campaign.
              </p>
            ) : (
              <div className="-mx-5 overflow-x-auto sm:-mx-6">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Contact</th>
                      <th scope="col">Agent</th>
                      <th scope="col">Duration</th>
                      <th scope="col">Outcome</th>
                      <th scope="col">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentCalls.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link
                            href={`/dashboard/calls/${c.id}`}
                            className="font-semibold hover:text-brand-700"
                          >
                            {c.direction === 'OUTBOUND' ? c.toNumber : c.fromNumber}
                          </Link>
                          <p className="text-xs text-muted">{humanize(c.direction)}</p>
                        </td>
                        <td className="text-ink-soft">{c.agent?.name ?? '—'}</td>
                        <td className="num">{formatDuration(c.durationSec)}</td>
                        <td>
                          <StatusBadge status={c.outcome ?? c.status} />
                        </td>
                        <td className="text-muted">{formatRelative(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>

        <aside className="space-y-6">
          <section
            className="rounded-xl bg-gradient-to-b from-brand-400 to-brand-600 p-6 text-white shadow-lg"
            aria-labelledby="minutes-title"
          >
            <div className="flex items-center justify-between">
              <h2 id="minutes-title" className="font-semibold text-white">
                Minutes this period
              </h2>
              <Timer size={18} aria-hidden="true" />
            </div>
            <div className="mt-4">
              <Gauge
                value={usage.minutesUsed}
                max={entitlements.includedMinutes}
                label="Minutes used"
                sublabel={
                  entitlements.includedMinutes === null
                    ? 'Custom allowance'
                    : `of ${formatNumber(entitlements.includedMinutes)} included`
                }
              />
            </div>
            <dl className="mt-4 space-y-2 border-t border-white/20 pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-white/70">Plan</dt>
                <dd className="font-semibold">{entitlements.planName ?? 'None'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/70">Renews</dt>
                <dd className="font-semibold">
                  {entitlements.currentPeriodEnd
                    ? new Date(entitlements.currentPeriodEnd).toLocaleDateString()
                    : '—'}
                </dd>
              </div>
            </dl>
            <Link href="/dashboard/billing" className="btn btn-primary mt-5 w-full">
              {entitlements.planCode === 'BASIC' ? 'Upgrade for 20,000 minutes' : 'Manage plan'}
            </Link>
          </section>

          <Section title="Outcomes">
            <BarList
              items={data.outcomes.map((o) => ({ label: humanize(o.outcome), value: o.count }))}
            />
          </Section>

          <Section
            title="Upcoming appointments"
            actions={
              <Link href="/dashboard/appointments" className="btn btn-ghost btn-sm">
                All
              </Link>
            }
          >
            {data.upcomingAppointments.length === 0 ? (
              <p className="text-sm text-muted">Nothing booked yet.</p>
            ) : (
              <ul className="space-y-3">
                {data.upcomingAppointments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                      <CalendarCheck size={16} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{a.contactName}</p>
                      <p className="text-xs text-muted">{formatDateTime(a.startsAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </aside>
      </div>
    </>
  );
}
