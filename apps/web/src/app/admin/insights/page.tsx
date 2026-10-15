'use client';

import { CircleDollarSign, Repeat, TrendingDown, Users } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { Loading, PageHeader, Section, StatTile } from '@/components/ui';
import { BarList, ColumnChart } from '@/components/charts/Charts';
import { formatMoney, formatNumber, formatPercent, humanize } from '@/lib/format';

interface Insights {
  kpis: {
    mrrCents: number;
    arrCents: number;
    payingSubscribers: number;
    arpuCents: number;
    customerChurn: number;
    revenueChurn: number;
    ltvCents: number | null;
    pastDue: number;
    cancelingAtPeriodEnd: number;
    totalWorkspaces: number;
    trialToPaid: number;
    minutesThisMonth: number;
    callsThisMonth: number;
  };
  byPlan: Array<{ plan: string; subscribers: number; mrrCents: number }>;
  movement: Array<{
    month: string;
    newCents: number;
    expansionCents: number;
    contractionCents: number;
    churnedCents: number;
    newSubscribers: number;
    cancellations: number;
  }>;
  revenue: Array<{ month: string; cents: number }>;
  signups: Array<{ day: string; count: number }>;
  topUsage: Array<{ workspace: { id: string; name: string }; minutes: number; calls: number }>;
}

const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  });
const dayLabel = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

export default function RevenueInsights() {
  const { data } = useApi<Insights>('/admin/super/insights');
  if (!data) return <Loading />;
  const k = data.kpis;
  return (
    <>
      <PageHeader
        title="Revenue insights"
        description="Recurring revenue, churn and growth. Churn is measured over the last 30 days."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="MRR"
          value={formatMoney(k.mrrCents)}
          hint={`ARR ${formatMoney(k.arrCents)}`}
          icon={CircleDollarSign}
        />
        <StatTile
          label="Paying subscribers"
          value={formatNumber(k.payingSubscribers)}
          hint={`ARPU ${formatMoney(k.arpuCents)} / month`}
          icon={Users}
        />
        <StatTile
          label="Customer churn (30d)"
          value={formatPercent(k.customerChurn)}
          hint={`Revenue churn ${formatPercent(k.revenueChurn)}`}
          icon={TrendingDown}
        />
        <StatTile
          label="Lifetime value"
          value={k.ltvCents === null ? '—' : formatMoney(k.ltvCents)}
          hint="ARPU ÷ monthly churn"
          icon={Repeat}
        />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          tone="plain"
          label="Sign-up → paid"
          value={formatPercent(k.trialToPaid)}
          hint={`${formatNumber(k.totalWorkspaces)} workspaces`}
        />
        <StatTile
          tone="plain"
          label="At risk"
          value={formatNumber(k.pastDue + k.cancelingAtPeriodEnd)}
          hint={`${k.pastDue} past due · ${k.cancelingAtPeriodEnd} canceling`}
        />
        <StatTile
          tone="plain"
          label="Minutes this month"
          value={formatNumber(k.minutesThisMonth)}
        />
        <StatTile tone="plain" label="Calls this month" value={formatNumber(k.callsThisMonth)} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Section title="Revenue collected" description="Paid invoices per month.">
          <ColumnChart
            data={data.revenue}
            x="month"
            y="cents"
            label="Revenue"
            formatX={monthLabel}
            formatY={(v) => formatMoney(v)}
          />
        </Section>
        <Section title="New sign-ups" description="Workspaces created per day, last 30 days.">
          <ColumnChart data={data.signups} x="day" y="count" label="Sign-ups" formatX={dayLabel} />
        </Section>
        <Section title="MRR by plan">
          <BarList
            items={data.byPlan.map((p) => ({
              label: `${humanize(p.plan)} · ${p.subscribers} subs`,
              value: p.mrrCents,
            }))}
            formatValue={(v) => formatMoney(v)}
          />
        </Section>
        <Section title="Highest usage this period">
          <BarList
            items={data.topUsage.map((u) => ({ label: u.workspace.name, value: u.minutes }))}
            formatValue={(v) => `${formatNumber(v)} min`}
          />
        </Section>
      </div>

      <Section
        className="mt-6"
        title="MRR movement"
        description="Change in monthly recurring revenue by cause."
      >
        <div className="-mx-5 overflow-x-auto sm:-mx-6">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Month</th>
                <th scope="col" className="text-right">
                  New
                </th>
                <th scope="col" className="text-right">
                  Expansion
                </th>
                <th scope="col" className="text-right">
                  Contraction
                </th>
                <th scope="col" className="text-right">
                  Churned
                </th>
                <th scope="col" className="text-right">
                  Net
                </th>
                <th scope="col" className="text-right">
                  New subs / cancellations
                </th>
              </tr>
            </thead>
            <tbody>
              {[...data.movement].reverse().map((m) => {
                const net = m.newCents + m.expansionCents + m.contractionCents + m.churnedCents;
                return (
                  <tr key={m.month}>
                    <td className="font-medium">{monthLabel(m.month)}</td>
                    <td className="num text-right">{formatMoney(m.newCents)}</td>
                    <td className="num text-right">{formatMoney(m.expansionCents)}</td>
                    <td className="num text-right">{formatMoney(m.contractionCents)}</td>
                    <td className="num text-right">{formatMoney(m.churnedCents)}</td>
                    <td
                      className={`num text-right font-semibold ${net > 0 ? 'text-success' : net < 0 ? 'text-danger' : ''}`}
                    >
                      {net > 0 ? '+' : ''}
                      {formatMoney(net)}
                    </td>
                    <td className="num text-right text-muted">
                      {m.newSubscribers} / {m.cancellations}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
