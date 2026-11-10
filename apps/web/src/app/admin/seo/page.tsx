'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Eye, Hash, MousePointerClick, Percent, RefreshCw } from 'lucide-react';
import { isSuperAdmin } from '@pv/shared';
import { useApi } from '@/lib/use-api';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import {
  ErrorNote,
  Loading,
  PageHeader,
  Section,
  StatTile,
  Tabs,
  useAction,
} from '@/components/ui';
import { BarList, TrendChart } from '@/components/charts/Charts';
import { Table } from '@/components/admin/ReportTable';
import { Field } from '@/components/forms/Field';
import { formatDateTime, formatNumber, formatPercent } from '@/lib/format';

interface Metrics {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}
interface Row extends Metrics {
  key: string;
  previousPosition: number | null;
}
interface Performance {
  siteUrl: string;
  range: { start: string; end: string; days: number };
  totals: Metrics;
  previous: Metrics;
  series: Array<Metrics & { date: string }>;
  queries: Row[];
  pages: Row[];
  countries: Row[];
  devices: Row[];
  searchAppearance: Row[];
  rankBuckets: { top3: number; top10: number; top20: number; beyond: number };
  opportunities: Row[];
  strikingDistance: Row[];
}
interface Connection {
  connected: boolean;
  siteUrl: string | null;
  clientEmail: string | null;
  connectedAt: string | null;
}
interface PageAudit {
  url: string;
  path: string;
  status: number;
  ms: number;
  title: string | null;
  description: string | null;
  wordCount: number;
  structuredData: string[];
  issues: Array<{ severity: 'error' | 'warning' | 'notice'; message: string }>;
}
interface SiteAudit {
  runAt: string;
  site: string;
  score: number;
  pages: PageAudit[];
  siteIssues: PageAudit['issues'];
}

const RANGES = [
  { value: '7', label: '7 days' },
  { value: '28', label: '28 days' },
  { value: '90', label: '3 months' },
  { value: '180', label: '6 months' },
  { value: '480', label: '16 months' },
] as const;

const pathOf = (url: string) => {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
};

/** Position: lower is better, so an improvement is a fall in the number. */
function PositionChange({ now, before }: { now: number; before: number | null }) {
  if (before == null) return <span className="text-xs text-muted">new</span>;
  const d = before - now;
  if (Math.abs(d) < 0.5) return <span className="text-xs text-muted">–</span>;
  return (
    <span className={`text-xs font-semibold ${d > 0 ? 'text-success' : 'text-danger'}`}>
      {d > 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}
    </span>
  );
}

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

const sevClass = { error: 'badge-danger', warning: 'badge-warning', notice: 'badge-neutral' };

export default function SeoPerformancePage() {
  const { me } = useSession();
  const superAdmin = !!me && isSuperAdmin(me.user.role);
  const conn = useApi<Connection>('/admin/analytics/search-console');
  const [tab, setTab] = useState<'search' | 'health'>('search');

  return (
    <>
      <PageHeader
        title="SEO performance"
        description={
          <>
            How the site ranks in Google (from Search Console) and how healthy each page is for
            search engines. Visits from search, as measured on the site, are on{' '}
            <Link
              href="/admin/analytics"
              className="font-semibold text-brand-700 hover:text-brand-900"
            >
              Website traffic
            </Link>
            .
          </>
        }
        actions={
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'search', label: 'Google Search' },
              { value: 'health', label: 'Site health' },
            ]}
          />
        }
      />
      {tab === 'health' ? (
        <SiteHealth />
      ) : !conn.data ? (
        <Loading />
      ) : conn.data.connected ? (
        <div className="grid gap-6">
          <SearchPerformance />
          <Sitemaps />
          <ConnectionSection conn={conn.data} superAdmin={superAdmin} reload={conn.reload} />
        </div>
      ) : (
        <ConnectionSection conn={conn.data} superAdmin={superAdmin} reload={conn.reload} />
      )}
    </>
  );
}

function SearchPerformance() {
  const [days, setDays] = useState<(typeof RANGES)[number]['value']>('28');
  const [metric, setMetric] = useState<'clicks' | 'impressions' | 'position'>('clicks');
  const [view, setView] = useState<'queries' | 'pages'>('pages');
  const [page, setPage] = useState<string | null>(null);
  const q = new URLSearchParams({ days, ...(page ? { page } : {}) });
  const { data, error, loading } = useApi<Performance>(`/admin/analytics/seo/performance?${q}`);

  if (error) return <ErrorNote message={error.message} />;
  if (!data) return <Loading label="Asking Google Search Console…" />;
  const t = data.totals;
  const p = data.previous;
  const rows = view === 'queries' ? data.queries : data.pages;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="font-mono">{data.siteUrl}</span> · {data.range.start} to{' '}
          {data.range.end}
          {loading && ' · updating…'}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {page && (
            <button className="chip" aria-pressed="true" onClick={() => setPage(null)}>
              Page: {pathOf(page)} ✕
            </button>
          )}
          <Tabs value={days} onChange={setDays} options={RANGES.map((r) => ({ ...r }))} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Clicks from Google"
          icon={MousePointerClick}
          value={formatNumber(t.clicks)}
          hint={<Delta now={t.clicks} before={p.clicks} />}
        />
        <StatTile
          label="Impressions"
          icon={Eye}
          value={formatNumber(t.impressions)}
          hint={<Delta now={t.impressions} before={p.impressions} />}
        />
        <StatTile
          tone="plain"
          label="Click-through rate"
          icon={Percent}
          value={formatPercent(t.ctr)}
          hint={<Delta now={t.ctr} before={p.ctr} />}
        />
        <StatTile
          tone="plain"
          label="Average position"
          icon={Hash}
          value={t.position ? t.position.toFixed(1) : '—'}
          hint={<Delta now={t.position} before={p.position} invert />}
        />
      </div>

      <Section
        title="Search performance over time"
        actions={
          <Tabs
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'clicks', label: 'Clicks' },
              { value: 'impressions', label: 'Impressions' },
              { value: 'position', label: 'Position' },
            ]}
          />
        }
      >
        <TrendChart
          data={data.series as unknown as Array<Record<string, string | number>>}
          x="date"
          y={metric}
          label={metric === 'position' ? 'Average position' : metric[0].toUpperCase() + metric.slice(1)}
          formatX={(v) =>
            new Date(`${v}T00:00:00Z`).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            })
          }
          formatY={metric === 'position' ? (v) => v.toFixed(1) : undefined}
        />
        {metric === 'position' && (
          <p className="mt-2 text-xs text-muted">Lower is better: position 1 is the top result.</p>
        )}
      </Section>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatTile tone="plain" label="Queries in top 3" value={formatNumber(data.rankBuckets.top3)} />
        <StatTile tone="plain" label="Positions 4–10" value={formatNumber(data.rankBuckets.top10)} hint="Rest of page one" />
        <StatTile tone="plain" label="Positions 11–20" value={formatNumber(data.rankBuckets.top20)} hint="Page two" />
        <StatTile tone="plain" label="Beyond 20" value={formatNumber(data.rankBuckets.beyond)} />
      </div>

      <Section
        title={view === 'pages' ? 'Ranking pages' : 'Search queries'}
        description={
          view === 'pages'
            ? 'Every page that appeared in Google. Click a page to see the queries it ranks for.'
            : 'What people searched for when the site appeared. ▲ = moved up since the previous period.'
        }
        actions={
          <Tabs
            value={view}
            onChange={setView}
            options={[
              { value: 'pages', label: 'Pages' },
              { value: 'queries', label: 'Queries' },
            ]}
          />
        }
      >
        <Table
          head={[view === 'pages' ? 'Page' : 'Query', 'Clicks', 'Impressions', 'CTR', 'Position', 'Change']}
          rows={rows.map((r) => [
            view === 'pages' ? (
              <button
                key="k"
                className="text-left font-mono text-xs font-semibold text-brand-700 hover:text-brand-900"
                title={r.key}
                onClick={() => {
                  setPage(r.key);
                  setView('queries');
                }}
              >
                {pathOf(r.key)}
              </button>
            ) : (
              <span key="k">{r.key}</span>
            ),
            formatNumber(r.clicks),
            formatNumber(r.impressions),
            formatPercent(r.ctr),
            r.position.toFixed(1),
            <PositionChange key="c" now={r.position} before={r.previousPosition} />,
          ])}
        />
        {page && <InspectUrl url={page} />}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section
          title="Striking distance"
          description="Queries on page two (positions 11–20). Improving these pages is the quickest way to page one."
        >
          <Table
            head={['Query', 'Impressions', 'Position']}
            rows={data.strikingDistance.map((r) => [r.key, formatNumber(r.impressions), r.position.toFixed(1)])}
          />
        </Section>
        <Section
          title="Low click-through"
          description="Seen often but rarely clicked. Rewrite the title and meta description of the page that ranks."
        >
          <Table
            head={['Query', 'Impressions', 'CTR']}
            rows={data.opportunities.map((r) => [r.key, formatNumber(r.impressions), formatPercent(r.ctr)])}
          />
        </Section>
        <Section title="Countries" description="Clicks from Google by searcher country.">
          <BarList
            items={data.countries.map((c) => {
              let label = c.key.toUpperCase();
              try {
                // Search Console uses ISO 3166-1 alpha-3; Intl wants alpha-2, so show the code if it can't map.
                label = new Intl.DisplayNames(['en'], { type: 'region' }).of(label) ?? label;
              } catch {
                /* keep the code */
              }
              return { label, value: c.clicks };
            })}
          />
        </Section>
        <Section title="Devices" description="Clicks from Google by device.">
          <BarList
            items={data.devices.map((d) => ({
              label: d.key[0] + d.key.slice(1).toLowerCase(),
              value: d.clicks,
            }))}
          />
          {data.searchAppearance.length > 0 && (
            <>
              <h3 className="mb-3 mt-6 text-sm font-semibold">Search appearance</h3>
              <BarList items={data.searchAppearance.map((d) => ({ label: d.key, value: d.impressions }))} />
            </>
          )}
        </Section>
      </div>
    </>
  );
}

function InspectUrl({ url }: { url: string }) {
  const { busy, run } = useAction();
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  return (
    <div className="mt-5 rounded-sm border border-line p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>
          Google index status for <span className="font-mono text-xs">{pathOf(url)}</span>
        </p>
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={() =>
            run(async () => setResult(await api('/admin/analytics/seo/inspect', { body: { url } })))
          }
        >
          {busy ? 'Inspecting…' : 'Inspect URL'}
        </button>
      </div>
      {result && (
        <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {(
            [
              ['Verdict', result.verdict],
              ['Coverage', result.coverage],
              ['Indexing allowed', result.indexing],
              ['robots.txt', result.robots],
              ['Page fetch', result.fetch],
              ['Last crawled', result.lastCrawl ? formatDateTime(String(result.lastCrawl)) : '—'],
              ['Crawled as', result.crawledAs],
              ['Google’s canonical', result.googleCanonical],
              ['Rich results', (result.richResults as string[]).join(', ') || 'None'],
            ] as Array<[string, unknown]>
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-line py-1">
              <dt className="text-muted">{k}</dt>
              <dd className="truncate text-right font-medium">{v ? String(v) : '—'}</dd>
            </div>
          ))}
          {typeof result.link === 'string' && (
            <a
              href={result.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-brand-700"
            >
              Open in Search Console <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}
        </dl>
      )}
    </div>
  );
}

function Sitemaps() {
  const { data, error } = useApi<{
    sitemaps: Array<{
      path: string;
      lastSubmitted: string | null;
      lastDownloaded: string | null;
      pending: boolean;
      errors: number;
      warnings: number;
      submitted: number;
    }>;
  }>('/admin/analytics/seo/sitemaps');
  return (
    <Section title="Sitemaps in Google" description="What Search Console has read from the sitemaps you submitted.">
      {error ? (
        <ErrorNote message={error.message} />
      ) : !data ? (
        <Loading />
      ) : data.sitemaps.length === 0 ? (
        <p className="text-sm text-muted">
          No sitemap submitted yet. In Search Console → Sitemaps, submit <span className="font-mono">sitemap.xml</span>.
        </p>
      ) : (
        <Table
          head={['Sitemap', 'URLs', 'Errors', 'Warnings', 'Last read by Google']}
          rows={data.sitemaps.map((s) => [
            <span key="p" className="font-mono text-xs">{s.path}</span>,
            formatNumber(s.submitted),
            formatNumber(s.errors),
            formatNumber(s.warnings),
            s.pending ? 'Pending' : s.lastDownloaded ? formatDateTime(s.lastDownloaded) : '—',
          ])}
        />
      )}
    </Section>
  );
}

function ConnectionSection({
  conn,
  superAdmin,
  reload,
}: {
  conn: Connection;
  superAdmin: boolean;
  reload: () => Promise<void>;
}) {
  const { busy, run } = useAction();
  return (
    <Section
      title={conn.connected ? 'Search Console connection' : 'Connect Google Search Console'}
      description={
        conn.connected
          ? `Reading ${conn.siteUrl} as ${conn.clientEmail}, read-only.`
          : 'Search Console is where Google reports which queries and pages rank, and how often people click. Connect it once to see it here.'
      }
    >
      {!superAdmin ? (
        <p className="text-sm text-muted">
          {conn.connected
            ? 'A super admin can change this connection.'
            : 'Ask a super admin to connect Search Console.'}
        </p>
      ) : (
        <>
          {!conn.connected && (
            <ol className="mb-5 list-decimal space-y-1.5 pl-5 text-sm text-ink-soft">
              <li>
                In Google Cloud Console, create (or pick) a project and enable the{' '}
                <strong>Google Search Console API</strong>.
              </li>
              <li>
                Under IAM → Service accounts, create a service account, then Keys → Add key → JSON.
              </li>
              <li>
                In Search Console → Settings → Users and permissions, add the service account’s
                email as a user (Restricted is enough).
              </li>
              <li>Paste the property name and the JSON key below.</li>
            </ol>
          )}
          <form
            className="grid gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
              void run(async () => {
                await api('/admin/analytics/search-console', {
                  method: 'PUT',
                  body: { siteUrl: f.siteUrl, serviceAccountJson: f.serviceAccountJson || null },
                });
                await reload();
              }, 'Search Console connected');
            }}
          >
            <Field
              id="siteUrl"
              label="Search Console property"
              help="Exactly as Search Console shows it: sc-domain:purplerocket.co for a domain property, or https://voice.purplerocket.co/ for a URL-prefix property."
            >
              <input
                id="siteUrl"
                name="siteUrl"
                className="input font-mono text-sm"
                defaultValue={conn.siteUrl ?? ''}
                placeholder="sc-domain:purplerocket.co"
                required
              />
            </Field>
            <Field
              id="serviceAccountJson"
              label="Service account JSON key"
              help="Stored encrypted; never shown again."
              optional={conn.connected}
            >
              <textarea
                id="serviceAccountJson"
                name="serviceAccountJson"
                className="textarea min-h-[120px] font-mono text-xs"
                placeholder={conn.connected ? 'Leave blank to keep the saved key' : '{ "type": "service_account", … }'}
                autoComplete="off"
                spellCheck={false}
                required={!conn.connected}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <button className="btn btn-primary" disabled={busy}>
                {conn.connected ? 'Save' : 'Connect'}
              </button>
              {conn.connected && (
                <button
                  type="button"
                  className="btn btn-ghost text-danger"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api('/admin/analytics/search-console', { method: 'DELETE' });
                      await reload();
                    }, 'Search Console disconnected')
                  }
                >
                  Disconnect
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </Section>
  );
}

function SiteHealth() {
  const saved = useApi<{ audit: SiteAudit | null }>('/admin/analytics/seo/audit');
  const { busy, run } = useAction();
  const [filter, setFilter] = useState<'issues' | 'all'>('issues');
  const audit = saved.data?.audit;

  const counts = { error: 0, warning: 0, notice: 0 };
  for (const p of audit?.pages ?? []) for (const i of p.issues) counts[i.severity]++;
  const pages = (audit?.pages ?? []).filter((p) => filter === 'all' || p.issues.length);

  return (
    <div className="grid gap-6">
      <Section
        title="On-site SEO audit"
        description="Crawls every page in sitemap.xml and checks titles, descriptions, canonicals, indexing, headings, alt text, structured data, content length and response time."
        actions={
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                const r = await api<{ audit: SiteAudit }>('/admin/analytics/seo/audit', {
                  method: 'POST',
                });
                saved.setData(r);
              })
            }
          >
            <RefreshCw size={15} className={busy ? 'animate-spin' : ''} aria-hidden="true" />
            {busy ? 'Crawling…' : audit ? 'Run again' : 'Run audit'}
          </button>
        }
      >
        {!saved.data ? (
          <Loading />
        ) : !audit ? (
          <p className="text-sm text-muted">No audit yet. Run one to check every page.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-4">
            <StatTile label="SEO health score" value={`${audit.score}/100`} hint={`Last run ${formatDateTime(audit.runAt)}`} />
            <StatTile tone="plain" label="Errors" value={formatNumber(counts.error)} hint={`${audit.pages.length} pages crawled`} />
            <StatTile tone="plain" label="Warnings" value={formatNumber(counts.warning)} />
            <StatTile tone="plain" label="Notices" value={formatNumber(counts.notice)} />
          </div>
        )}
        {audit && audit.siteIssues.length > 0 && (
          <ul className="mt-5 space-y-2 text-sm">
            {audit.siteIssues.map((i) => (
              <li key={i.message} className="flex items-start gap-2">
                <span className={`badge ${sevClass[i.severity]}`}>{i.severity}</span>
                {i.message}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {audit && (
        <Section
          title="Pages"
          actions={
            <Tabs
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'issues', label: 'With issues' },
                { value: 'all', label: 'All pages' },
              ]}
            />
          }
        >
          {pages.length === 0 ? (
            <p className="text-sm text-muted">No issues found. 🎉</p>
          ) : (
            <ul className="divide-y divide-line">
              {pages.map((p) => (
                <li key={p.url} className="py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-sm font-semibold text-brand-700 hover:text-brand-900"
                    >
                      {p.path}
                    </a>
                    <span className="num text-xs text-muted">
                      HTTP {p.status} · {p.ms} ms · {p.wordCount} words
                      {p.structuredData.length ? ` · ${p.structuredData.join(', ')}` : ''}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm">{p.title ?? <em className="text-muted">No title</em>}</p>
                  <p className="truncate text-xs text-muted">{p.description ?? 'No meta description'}</p>
                  {p.issues.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {p.issues.map((i) => (
                        <li key={i.message} className={`badge ${sevClass[i.severity]}`}>
                          {i.message}
                        </li>
                      ))}
                    </ul>
                  )}
                  <PageSpeedButton path={p.path} />
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  );
}

interface Speed {
  scores: { performance: number | null; seo: number | null; accessibility: number | null; bestPractices: number | null };
  lab: { lcp: string | null; cls: string | null; tbt: string | null; fcp: string | null };
  field: { overall: string | null; lcpMs: number | null; inpMs: number | null; cls: number | null } | null;
}

function PageSpeedButton({ path }: { path: string }) {
  const { busy, run } = useAction();
  const [r, setR] = useState<Speed | null>(null);
  return (
    <div className="mt-2 text-xs">
      {!r ? (
        <button
          className="font-semibold text-brand-700 hover:text-brand-900 disabled:opacity-60"
          disabled={busy}
          onClick={() =>
            run(async () =>
              setR(await api('/admin/analytics/seo/pagespeed', { body: { path, strategy: 'mobile' } })),
            )
          }
        >
          {busy ? 'Running PageSpeed Insights (up to a minute)…' : 'Check speed & Core Web Vitals'}
        </button>
      ) : (
        <p className="num text-muted">
          Mobile — Performance {r.scores.performance ?? '—'} · SEO {r.scores.seo ?? '—'} ·
          Accessibility {r.scores.accessibility ?? '—'} · Best practices {r.scores.bestPractices ?? '—'}
          {' · '}LCP {r.lab.lcp ?? '—'} · CLS {r.lab.cls ?? '—'} · TBT {r.lab.tbt ?? '—'}
          {r.field &&
            ` · Real users: ${r.field.overall ?? '—'} (LCP ${r.field.lcpMs ?? '—'} ms, INP ${r.field.inpMs ?? '—'} ms)`}
        </p>
      )}
    </div>
  );
}
