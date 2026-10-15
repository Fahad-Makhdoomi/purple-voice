'use client';

import { useState } from 'react';
import { PhoneCall, Smile, Target } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { useFeature } from '@/lib/workspace';
import { Loading, PageHeader, Section, StatTile, Tabs, UpgradeGate } from '@/components/ui';
import { BarList, ColumnChart } from '@/components/charts/Charts';
import { formatNumber, formatPercent, humanize } from '@/lib/format';

interface Insights {
  connectRate: number;
  averageSentiment: number | null;
  outcomes: Array<{ outcome: string; count: number }>;
  agents: Array<{
    agentId: string;
    name: string;
    calls: number;
    minutes: number;
    booked: number;
    avgSec: number | null;
  }>;
  campaigns: Array<{
    campaignId: string;
    name: string;
    calls: number;
    answered: number;
    booked: number;
  }>;
  hours: Array<{ hour: number; calls: number; answered: number }>;
}

const hourLabel = (h: string) => `${String(h).padStart(2, '0')}:00`;

export default function InsightsPage() {
  const allowed = useFeature('detailedInsights');
  const [days, setDays] = useState<'7' | '30' | '90'>('30');
  const { data } = useApi<Insights>(allowed ? `/app/insights?days=${days}` : null);

  if (!allowed) {
    return (
      <>
        <PageHeader title="Insights" />
        <UpgradeGate
          feature="Detailed calling insights"
          body="See connect rates by hour, conversion by agent and campaign, and caller sentiment — so you know what to change."
        />
      </>
    );
  }

  const answeredByHour =
    data?.hours.map((h) => ({
      hour: String(h.hour),
      rate: h.calls ? Math.round((h.answered / h.calls) * 100) : 0,
    })) ?? [];
  const totalCalls = data?.outcomes.reduce((n, o) => n + o.count, 0) ?? 0;
  const booked = data?.outcomes.find((o) => o.outcome === 'APPOINTMENT_BOOKED')?.count ?? 0;

  return (
    <>
      <PageHeader
        title="Insights"
        description="What's working across your agents and campaigns."
        actions={
          <Tabs
            value={days}
            onChange={setDays}
            options={[
              { value: '7', label: '7 days' },
              { value: '30', label: '30 days' },
              { value: '90', label: '90 days' },
            ]}
          />
        }
      />
      {!data ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Connect rate"
              value={formatPercent(data.connectRate)}
              hint="Outbound calls answered"
              icon={PhoneCall}
            />
            <StatTile
              label="Booking rate"
              value={formatPercent(totalCalls ? booked / totalCalls : 0)}
              hint={`${formatNumber(booked)} appointments`}
              icon={Target}
            />
            <StatTile
              label="Caller sentiment"
              value={data.averageSentiment === null ? '—' : data.averageSentiment.toFixed(2)}
              hint="−1 hostile · +1 enthusiastic"
              icon={Smile}
            />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Section
              title="Answer rate by hour"
              description="Share of outbound calls answered, by the hour they were placed (server time)."
            >
              <ColumnChart
                data={answeredByHour}
                x="hour"
                y="rate"
                label="Answer rate"
                formatX={hourLabel}
                formatY={(v) => `${v}%`}
              />
            </Section>
            <Section title="Outcomes">
              <BarList
                items={data.outcomes.map((o) => ({
                  label: o.outcome === 'NONE' ? 'No outcome (unanswered)' : humanize(o.outcome),
                  value: o.count,
                }))}
              />
            </Section>
          </div>
          <Section title="By agent">
            <div className="-mx-5 overflow-x-auto sm:-mx-6">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Agent</th>
                    <th scope="col" className="text-right">
                      Calls
                    </th>
                    <th scope="col" className="text-right">
                      Minutes
                    </th>
                    <th scope="col" className="text-right">
                      Avg talk time
                    </th>
                    <th scope="col" className="text-right">
                      Booked
                    </th>
                    <th scope="col" className="text-right">
                      Booking rate
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.agents.map((a) => (
                    <tr key={a.agentId}>
                      <td className="font-semibold">{a.name}</td>
                      <td className="num text-right">{formatNumber(a.calls)}</td>
                      <td className="num text-right">{formatNumber(a.minutes)}</td>
                      <td className="num text-right">
                        {a.avgSec ? `${Math.round(a.avgSec)}s` : '—'}
                      </td>
                      <td className="num text-right">{formatNumber(a.booked)}</td>
                      <td className="num text-right">
                        {formatPercent(a.calls ? a.booked / a.calls : 0)}
                      </td>
                    </tr>
                  ))}
                  {!data.agents.length && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-muted">
                        No calls in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
          <Section title="By campaign">
            <div className="-mx-5 overflow-x-auto sm:-mx-6">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Campaign</th>
                    <th scope="col" className="text-right">
                      Calls
                    </th>
                    <th scope="col" className="text-right">
                      Connect rate
                    </th>
                    <th scope="col" className="text-right">
                      Booked
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.campaigns.map((c) => (
                    <tr key={c.campaignId}>
                      <td className="font-semibold">{c.name}</td>
                      <td className="num text-right">{formatNumber(c.calls)}</td>
                      <td className="num text-right">
                        {formatPercent(c.calls ? c.answered / c.calls : 0)}
                      </td>
                      <td className="num text-right">{formatNumber(c.booked)}</td>
                    </tr>
                  ))}
                  {!data.campaigns.length && (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-muted">
                        No campaign calls in this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}
    </>
  );
}
