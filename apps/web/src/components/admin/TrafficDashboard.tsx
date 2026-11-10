'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, Clock, Eye, MousePointerClick, Repeat, Users } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { Loading, PageHeader, Section, StatTile, Tabs, ErrorNote } from '@/components/ui';
import { BarList, TrendChart } from '@/components/charts/Charts';
import { formatDuration, formatNumber, formatPercent } from '@/lib/format';
import { Table } from '@/components/admin/ReportTable';

interface Totals {
  views: number;
  visitors: number;
  visits: number;
  bounceRate: number;
  avgVisitSeconds: number;
  viewsPerVisit: number;
}
interface Group {
  label: string | null;
  views?: number;
  visitors: number;
  visits?: number;
  bounces?: number;
}
interface Traffic {
  range: { from: string; to: string; days: number; bucket: 'hour' | 'day' };
  totals: Totals;
  previous: Totals;
  series: Array<{ t: string; views: number; visitors: number; visits: number }>;
  pages: Array<{ path: string; views: number; visitors: number; avgSeconds: number | null }>;
  entryPages: Array<Group & { bounceRate: number }>;
  exitPages: Array<{ label: string; exits: number }>;
  channels: Group[];
  sources: Group[];
  campaigns: Array<{ campaign: string; source: string | null; medium: string | null; visits: number }>;
  devices: Group[];
  browsers: Group[];
  os: Group[];
  countries: Group[];
  timeZones: Group[];
  organicLanding: Array<{ path: string; source: string | null; visits: number }>;
}

const RANGES = [
  { value: '1', label: '24 hours' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '12 months' },
] as const;

type Metric = 'visitors' | 'views' | 'visits';

/** Change versus the previous period of the same length. */
function Delta({ now, before, invert }: { now: number; before: number; invert?: boolean }) {
  if (!before) return <span>No earlier data to compare</span>;
  const change = (now - before) / before;
  const good = invert ? change < 0 : change > 0;
  return (
    <span className={change === 0 ? '' : good ? 'text-success' : 'text-danger'}>
      {change > 0 ? '▲' : change < 0 ? '▼' : '■'} {formatPercent(Math.abs(change), 0)} vs previous
      period
    </span>
  );
}

const countryName = (code: string) => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
};

/**
 * Website traffic from our own cookie-free tracker. This is the admin home
 * page (/admin); `before` and `after` hold the business snapshot around it.
 */
export function TrafficDashboard({
  title = 'Website traffic',
  before,
  after,
}: {
  title?: string;
  before?: React.ReactNode;
  after?: React.ReactNode;
}) {
  const [days, setDays] = useState<(typeof RANGES)[number]['value']>('30');
  const [metric, setMetric] = useState<Metric>('visitors');
  const [channel, setChannel] = useState<string | null>(null);
  const q = new URLSearchParams({ days, ...(channel ? { channel } : {}) });
  const { data, error } = useApi<Traffic>(`/admin/analytics/traffic?${q}`);
  const live = useApi<{ visitors: number; pages: Array<{ path: string; views: number }> }>(
    '/admin/analytics/live',
  );
  const reloadLive = live.reload;
  useEffect(() => {
    const t = setInterval(() => void reloadLive(), 30_000);
    return () => clearInterval(t);
  }, [reloadLive]);

  const t = data?.totals;
  const p = data?.previous;
  const fmtX = (v: string) =>
    new Date(v).toLocaleString('en-US', {
      ...(data?.range.bucket === 'hour'
        ? { hour: 'numeric' }
        : { month: 'short', day: 'numeric' }),
    });
  const locations = data?.countries.length
    ? data.countries.map((c) => ({ label: countryName(c.label!), value: c.visitors }))
    : (data?.timeZones ?? []).map((c) => ({
        label: c.label!.replace(/_/g, ' '),
        value: c.visitors,
      }));

  return (
    <>
      <PageHeader
        title={title}
        description={
          <>
            Visitors to the public website, measured by our own cookie-free tracker — no consent
            banner needed, no raw IPs stored. Search rankings are under{' '}
            <Link href="/admin/seo" className="font-semibold text-brand-700 hover:text-brand-900">
              SEO performance
            </Link>
            .
          </>
        }
        actions={
          <Tabs value={days} onChange={setDays} options={RANGES.map((r) => ({ ...r }))} />
        }
      />

      {before}
      {error && <ErrorNote message={error.message} />}
      {!data || !t || !p ? (
        <Loading />
      ) : (
        <div className="grid gap-6">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1 font-semibold text-success">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:hidden" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              {formatNumber(live.data?.visitors ?? 0)} on the site now
            </span>
            {live.data?.pages.slice(0, 3).map((pg) => (
              <span key={pg.path} className="font-mono text-xs text-muted">
                {pg.path}
              </span>
            ))}
            {channel && (
              <button className="chip" aria-pressed="true" onClick={() => setChannel(null)}>
                Channel: {channel} ✕
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile
              label="Unique visitors"
              icon={Users}
              value={formatNumber(t.visitors)}
              hint={<Delta now={t.visitors} before={p.visitors} />}
            />
            <StatTile
              label="Visits"
              icon={Repeat}
              value={formatNumber(t.visits)}
              hint={<Delta now={t.visits} before={p.visits} />}
            />
            <StatTile
              label="Page views"
              icon={Eye}
              value={formatNumber(t.views)}
              hint={<Delta now={t.views} before={p.views} />}
            />
            <StatTile
              tone="plain"
              label="Bounce rate"
              icon={MousePointerClick}
              value={formatPercent(t.bounceRate, 0)}
              hint={<Delta now={t.bounceRate} before={p.bounceRate} invert />}
            />
            <StatTile
              tone="plain"
              label="Avg. visit duration"
              icon={Clock}
              value={formatDuration(t.avgVisitSeconds)}
              hint={<Delta now={t.avgVisitSeconds} before={p.avgVisitSeconds} />}
            />
            <StatTile
              tone="plain"
              label="Pages per visit"
              icon={Activity}
              value={t.viewsPerVisit.toFixed(1)}
              hint={<Delta now={t.viewsPerVisit} before={p.viewsPerVisit} />}
            />
          </div>

          <Section
            title="Over time"
            actions={
              <Tabs
                value={metric}
                onChange={setMetric}
                options={[
                  { value: 'visitors', label: 'Visitors' },
                  { value: 'visits', label: 'Visits' },
                  { value: 'views', label: 'Page views' },
                ]}
              />
            }
          >
            <TrendChart
              data={data.series}
              x="t"
              y={metric}
              label={metric === 'views' ? 'Page views' : metric === 'visits' ? 'Visits' : 'Visitors'}
              formatX={fmtX}
            />
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section
              title="Channels"
              description="How visits arrived. Click a channel to filter the whole report."
            >
              <Table
                head={['Channel', 'Visits', 'Bounce']}
                rows={data.channels.map((c) => [
                  <button
                    key="c"
                    className="text-left font-semibold text-brand-700 hover:text-brand-900"
                    onClick={() => setChannel(c.label)}
                  >
                    {c.label}
                  </button>,
                  formatNumber(c.visits),
                  formatPercent(c.visits ? (c.bounces ?? 0) / c.visits : 0, 0),
                ])}
              />
            </Section>
            <Section title="Top sources" description="Search engines, sites, social networks and UTM sources.">
              <BarList items={data.sources.map((s) => ({ label: s.label!, value: s.visits ?? 0 }))} />
            </Section>
          </div>

          <Section title="Top pages" description="Most viewed pages, with average time visible on screen.">
            <Table
              head={['Page', 'Views', 'Visitors', 'Avg. time']}
              rows={data.pages.map((pg) => [
                <span key="p" className="font-mono text-xs">{pg.path}</span>,
                formatNumber(pg.views),
                formatNumber(pg.visitors),
                pg.avgSeconds != null ? formatDuration(Math.round(pg.avgSeconds)) : '—',
              ])}
            />
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Landing pages" description="Where visits start, and how many leave after one page.">
              <Table
                head={['Page', 'Visits', 'Bounce']}
                rows={data.entryPages.map((e) => [
                  <span key="p" className="font-mono text-xs">{e.label}</span>,
                  formatNumber(e.visits),
                  formatPercent(e.bounceRate, 0),
                ])}
              />
            </Section>
            <Section title="Exit pages" description="The last page seen in a visit.">
              <Table
                head={['Page', 'Exits']}
                rows={data.exitPages.map((e) => [
                  <span key="p" className="font-mono text-xs">{e.label}</span>,
                  formatNumber(e.exits),
                ])}
              />
            </Section>
          </div>

          <Section
            title="Organic search landing pages"
            description="Pages people reach from search engines — your SEO traffic, as measured on the site. Queries and positions come from Search Console on the SEO performance page."
          >
            <Table
              head={['Page', 'Search engine', 'Visits']}
              rows={data.organicLanding.map((o) => [
                <span key="p" className="font-mono text-xs">{o.path}</span>,
                o.source ?? '—',
                formatNumber(o.visits),
              ])}
            />
          </Section>

          <Section title="Campaigns" description="Visits tagged with utm_campaign.">
            <Table
              head={['Campaign', 'Source', 'Medium', 'Visits']}
              rows={data.campaigns.map((c) => [
                c.campaign,
                c.source ?? '—',
                c.medium ?? '—',
                formatNumber(c.visits),
              ])}
            />
          </Section>

          <div className="grid gap-6 lg:grid-cols-2">
            <Section
              title="Locations"
              description={
                data.countries.length
                  ? 'Countries, from the CDN.'
                  : 'By the visitor’s time zone (no IP lookup is done).'
              }
            >
              <BarList items={locations} />
            </Section>
            <Section title="Devices">
              <BarList items={data.devices.map((d) => ({ label: d.label ?? 'Unknown', value: d.visitors }))} />
            </Section>
            <Section title="Browsers">
              <BarList items={data.browsers.map((d) => ({ label: d.label ?? 'Unknown', value: d.visitors }))} />
            </Section>
            <Section title="Operating systems">
              <BarList items={data.os.map((d) => ({ label: d.label ?? 'Unknown', value: d.visitors }))} />
            </Section>
          </div>
        </div>
      )}
      {after}
    </>
  );
}
