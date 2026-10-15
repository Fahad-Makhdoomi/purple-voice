'use client';

import Link from 'next/link';
import { Inbox, LifeBuoy, PhoneCall, Radio, UserPlus, Users } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { Loading, PageHeader, Section, StatTile, StatusBadge } from '@/components/ui';
import { formatNumber, formatRelative } from '@/lib/format';

interface Overview {
  counts: {
    workspaces: number;
    active: number;
    signupsWeek: number;
    openTickets: number;
    urgentTickets: number;
    newLeads: number;
    callsToday: number;
    liveCalls: number;
  };
  recentSignups: Array<{
    id: string;
    name: string;
    createdAt: string;
    users: Array<{ name: string; email: string }>;
    subscription: { status: string; plan: { name: string } } | null;
  }>;
}

export default function AdminHome() {
  const { data } = useApi<Overview>('/admin/overview');
  if (!data) return <Loading />;
  const c = data.counts;
  return (
    <>
      <PageHeader
        title="Admin overview"
        description="Customers, support and the website at a glance."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Workspaces"
          value={formatNumber(c.workspaces)}
          hint={`${formatNumber(c.active)} with an active plan`}
          icon={Users}
        />
        <StatTile label="Sign-ups this week" value={formatNumber(c.signupsWeek)} icon={UserPlus} />
        <StatTile
          label="Open tickets"
          value={formatNumber(c.openTickets)}
          hint={`${c.urgentTickets} high priority`}
          icon={LifeBuoy}
        />
        <StatTile
          label="New leads"
          value={formatNumber(c.newLeads)}
          hint="From the website"
          icon={Inbox}
        />
        <StatTile
          label="Calls in 24h"
          value={formatNumber(c.callsToday)}
          icon={PhoneCall}
          tone="plain"
        />
        <StatTile
          label="Live calls now"
          value={formatNumber(c.liveCalls)}
          icon={Radio}
          tone="plain"
        />
      </div>
      <Section
        className="mt-6"
        title="Latest sign-ups"
        actions={
          <Link href="/admin/subscribers" className="btn btn-ghost btn-sm">
            All subscribers
          </Link>
        }
      >
        <ul className="divide-y divide-line">
          {data.recentSignups.map((w) => (
            <li key={w.id}>
              <Link
                href={`/admin/subscribers/${w.id}`}
                className="flex flex-wrap items-center gap-3 py-3 hover:text-brand-700"
              >
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{w.name}</span>
                  <span className="block text-xs text-muted">{w.users[0]?.email}</span>
                </span>
                {w.subscription ? (
                  <span className="badge badge-brand">{w.subscription.plan.name}</span>
                ) : (
                  <span className="badge badge-neutral">No plan</span>
                )}
                {w.subscription && <StatusBadge status={w.subscription.status} />}
                <span className="w-28 text-right text-xs text-muted">
                  {formatRelative(w.createdAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}
