'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ClipboardCopy, Download, Sparkles } from 'lucide-react';
import {
  FOLLOW_UP_SEGMENTS,
  FOLLOW_UP_SEGMENT_INFO,
  parseTags,
  type FollowUpSegment,
} from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useWorkspace } from '@/lib/workspace';
import { Loading, Section, StatTile, StatusBadge, toast, useAction } from '@/components/ui';
import { BarList, ColumnChart, TrendChart } from '@/components/charts/Charts';
import { Field } from '@/components/forms/Field';
import { formatDate, formatDateTime, formatDuration, formatNumber, humanize } from '@/lib/format';

interface Analytics {
  totals: {
    contacts: number;
    called: number;
    reached: number;
    calls: number;
    answeredCalls: number;
    minutes: number;
    avgDurationSec: number;
    avgSentiment: number | null;
  };
  rates: {
    contactRate: number | null;
    answerRate: number | null;
    positiveRate: number | null;
    appointmentRate: number | null;
  };
  funnel: Array<{ key: string; label: string; count: number }>;
  outcomes: Record<string, number>;
  sentiment: { positive: number; neutral: number; negative: number; unscored: number };
  attempts: Array<{ attempts: number; contacts: number; reached: number }>;
  byHour: Array<{ hour: number; calls: number; answered: number }>;
  byDay: Array<{ date: string; calls: number; answered: number }>;
  durationBuckets: Array<{ label: string; calls: number }>;
  segments: Record<FollowUpSegment, number>;
  notReached?: {
    total: number;
    waitingRetry: number;
    byReason: Record<string, number>;
    sample: Array<{
      id: string;
      phone: string;
      name: string | null;
      reason: string;
      attempts: number;
    }>;
  };
}

/** Numbers the campaign never got through to, by why, with the people to act on. */
function NotReached({ data }: { data: NonNullable<Analytics['notReached']> }) {
  if (!data.total) return null;
  return (
    <Section
      title={`Not reached (${formatNumber(data.total)})`}
      description={
        data.waitingRetry
          ? `${formatNumber(data.waitingRetry)} still waiting for a retry.`
          : 'Out of retries or never called. Run them again or start a follow-up campaign.'
      }
    >
      <BarList
        items={Object.entries(data.byReason)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => ({ label: humanize(k), value: v }))}
      />
      <ul className="mt-5 divide-y divide-line text-sm">
        {data.sample.slice(0, 12).map((c) => (
          <li key={c.id} className="flex justify-between gap-3 py-2">
            <span>
              <span className="font-semibold">{c.name ?? c.phone}</span>
              {c.name && <span className="num ml-2 text-muted">{c.phone}</span>}
            </span>
            <span className="text-muted">
              {humanize(c.reason)} · {c.attempts} call{c.attempts === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export interface Report {
  headline: string;
  verdict: 'strong' | 'mixed' | 'weak';
  whatWorked: string[];
  whatToImprove: string[];
  objections: Array<{ theme: string; detail: string }>;
  recommendations: Array<{ title: string; detail: string; priority: 'high' | 'medium' | 'low' }>;
  followUps: Array<{ segment: FollowUpSegment; reason: string }>;
  scriptTweaks: string[];
}

const pct = (n: number | null) => (n === null ? '—' : `${n}%`);
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

export function AnalyticsPanel({ campaignId }: { campaignId: string }) {
  const { data } = useApi<{ analytics: Analytics }>(`/app/campaigns/${campaignId}/analytics`);
  if (!data) return <Loading />;
  const a = data.analytics;
  if (!a.totals.calls)
    return (
      <Section>
        <p className="py-8 text-center text-sm text-muted">
          No calls yet. Results appear here as soon as the campaign starts calling.
        </p>
      </Section>
    );
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Spoke to a person"
          value={formatNumber(a.totals.reached)}
          hint={`${pct(a.rates.contactRate)} of the ${formatNumber(a.totals.called)} contacts called`}
        />
        <StatTile
          label="Answer rate"
          value={pct(a.rates.answerRate)}
          hint={`${formatNumber(a.totals.answeredCalls)} of ${formatNumber(a.totals.calls)} calls answered`}
        />
        <StatTile
          label="Positive result"
          value={pct(a.rates.positiveRate)}
          hint="Of people reached: interested, callback, transfer or appointment"
        />
        <StatTile
          label="Appointments"
          value={formatNumber(a.outcomes.APPOINTMENT_BOOKED ?? 0)}
          hint={`${pct(a.rates.appointmentRate)} of people reached`}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          tone="plain"
          label="Average call"
          value={formatDuration(a.totals.avgDurationSec)}
          hint="Answered calls, minutes:seconds"
        />
        <StatTile
          tone="plain"
          label="Minutes used"
          value={formatNumber(a.totals.minutes)}
          hint={`${formatNumber(a.totals.calls)} calls placed`}
        />
        <StatTile
          tone="plain"
          label="Average sentiment"
          value={a.totals.avgSentiment === null ? '—' : a.totals.avgSentiment.toFixed(2)}
          hint="From −1 (hostile) to 1 (enthusiastic)"
        />
      </div>

      {a.notReached && <NotReached data={a.notReached} />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Funnel" description="How many people made it to each step.">
          <BarList items={a.funnel.map((f) => ({ label: f.label, value: f.count }))} />
        </Section>
        <Section title="Call outcomes" description="How each call ended, as judged from the call.">
          <BarList
            items={Object.entries(a.outcomes)
              .sort((x, y) => y[1] - x[1])
              .map(([k, v]) => ({ label: humanize(k), value: v }))}
          />
        </Section>
        <Section
          title="People reached by hour"
          description="Calling hours in the campaign's time zone. Move your window to where answers cluster."
        >
          <ColumnChart
            data={a.byHour.map((h) => ({ hour: hourLabel(h.hour), reached: h.answered }))}
            x="hour"
            y="reached"
            label="People reached"
          />
        </Section>
        <Section title="Sentiment" description="How people sounded on calls where they picked up.">
          <BarList
            items={[
              { label: 'Positive', value: a.sentiment.positive },
              { label: 'Neutral', value: a.sentiment.neutral },
              { label: 'Negative', value: a.sentiment.negative },
              { label: 'Not scored', value: a.sentiment.unscored },
            ]}
          />
        </Section>
        {a.byDay.length > 1 && (
          <Section title="Calls per day">
            <TrendChart
              data={a.byDay.map((d) => ({ date: d.date, calls: d.calls }))}
              x="date"
              y="calls"
              label="Calls"
              formatX={(v) => formatDate(`${v}T12:00:00`, { month: 'short', day: 'numeric' })}
            />
          </Section>
        )}
        <Section title="Call length" description="Answered calls by how long they lasted.">
          <BarList items={a.durationBuckets.map((b) => ({ label: b.label, value: b.calls }))} />
        </Section>
      </div>

      {a.attempts.length > 0 && (
        <Section
          title="Attempts needed"
          description="If most people are reached on the first call, retries add little; if later calls still connect, keep them."
        >
          <div className="-mx-5 overflow-x-auto sm:-mx-6">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Calls made to the contact</th>
                  <th scope="col">Contacts</th>
                  <th scope="col">Reached a person</th>
                </tr>
              </thead>
              <tbody>
                {a.attempts.map((r) => (
                  <tr key={r.attempts}>
                    <td className="num">{r.attempts}</td>
                    <td className="num">{formatNumber(r.contacts)}</td>
                    <td className="num">{formatNumber(r.reached)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}

const PRIORITY_TONE: Record<string, string> = {
  high: 'badge-danger',
  medium: 'badge-warning',
  low: 'badge-neutral',
};
const VERDICT_TONE: Record<string, string> = {
  strong: 'badge-success',
  mixed: 'badge-warning',
  weak: 'badge-danger',
};

function Bullets({ items }: { items: string[] }) {
  if (!items.length) return <p className="text-sm text-muted">Nothing to report.</p>;
  return (
    <ul className="list-disc space-y-2 pl-5 text-sm text-ink-soft">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export function AiPanel({
  campaignId,
  status,
  report,
  reportAt,
  onChanged,
  onFollowUp,
}: {
  campaignId: string;
  status: string;
  report: Report | null;
  reportAt: string | null;
  onChanged: () => Promise<void>;
  onFollowUp: (segment: FollowUpSegment) => void;
}) {
  const { busy, run } = useAction();
  const canAnalyse = ['COMPLETED', 'CANCELED', 'PAUSED'].includes(status);

  async function copySummary() {
    await run(async () => {
      const r = await api<{ summary: string }>(`/app/campaigns/${campaignId}/summary`);
      await navigator.clipboard.writeText(r.summary);
    }, 'Summary copied. Paste it into any AI assistant.');
  }

  return (
    <Section
      title="AI analysis"
      description="What worked, what to change, and who to call next, written from this campaign's results and call summaries."
      actions={
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-secondary btn-sm" disabled={busy} onClick={copySummary}>
            <ClipboardCopy size={14} aria-hidden="true" /> Copy AI-ready summary
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={busy || !canAnalyse}
            onClick={() =>
              run(async () => {
                await api(`/app/campaigns/${campaignId}/ai-report`, { method: 'POST' });
                await onChanged();
              }, 'Analysis ready')
            }
          >
            <Sparkles size={14} aria-hidden="true" />{' '}
            {busy ? 'Analysing…' : report ? 'Analyse again' : 'Analyse with AI'}
          </button>
        </div>
      }
    >
      {!canAnalyse && !report && (
        <p className="text-sm text-muted">
          Available once the campaign has finished. The summary can be copied at any time.
        </p>
      )}
      {canAnalyse && !report && !busy && (
        <p className="text-sm text-muted">
          Run the analysis for recommendations on your script, calling hours and follow-ups. It
          takes about half a minute.
        </p>
      )}
      {report && (
        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${VERDICT_TONE[report.verdict]}`}>
                {humanize(report.verdict)}
              </span>
              {reportAt && (
                <span className="text-xs text-muted">Analysed {formatDateTime(reportAt)}</span>
              )}
            </div>
            <p className="mt-2 text-base font-medium">{report.headline}</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold">What worked</h3>
              <Bullets items={report.whatWorked} />
            </div>
            <div>
              <h3 className="mb-2 text-sm font-semibold">What to improve</h3>
              <Bullets items={report.whatToImprove} />
            </div>
          </div>
          {report.recommendations.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold">Recommendations</h3>
              <ul className="space-y-3">
                {report.recommendations.map((r) => (
                  <li key={r.title} className="rounded-sm border border-line p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`badge ${PRIORITY_TONE[r.priority]}`}>
                        {humanize(r.priority)}
                      </span>
                      <p className="text-sm font-semibold">{r.title}</p>
                    </div>
                    <p className="mt-1.5 text-sm text-ink-soft">{r.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.objections.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold">Objections heard</h3>
              <ul className="space-y-2 text-sm text-ink-soft">
                {report.objections.map((o) => (
                  <li key={o.theme}>
                    <span className="font-semibold text-ink">{o.theme}.</span> {o.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {report.scriptTweaks.length > 0 && (
            <div>
              <h3 className="mb-2 text-sm font-semibold">Script changes to try</h3>
              <Bullets items={report.scriptTweaks} />
            </div>
          )}
          {report.followUps.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold">Suggested follow-ups</h3>
              <ul className="space-y-2">
                {report.followUps.map((f) => (
                  <li
                    key={f.segment}
                    className="flex flex-wrap items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 flex-1 text-ink-soft">
                      <span className="font-semibold text-ink">
                        {FOLLOW_UP_SEGMENT_INFO[f.segment].label}.
                      </span>{' '}
                      {f.reason}
                    </span>
                    {status === 'COMPLETED' || status === 'CANCELED' ? (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onFollowUp(f.segment)}
                      >
                        Plan this follow-up
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-subtle">
            AI analysis can be wrong. Check it against the numbers above before changing your
            script.
          </p>
        </div>
      )}
    </Section>
  );
}

interface FollowUpRef {
  id: string;
  name: string;
  status: string;
  followUpSegments: string[];
}

export function FollowUpPanel({
  campaign,
  initialSegment,
}: {
  campaign: {
    id: string;
    name: string;
    status: string;
    goal: string;
    agent: { id: string };
    parentCampaign: { id: string; name: string } | null;
    followUps: FollowUpRef[];
  };
  initialSegment?: FollowUpSegment;
}) {
  const router = useRouter();
  const { reload: reloadWs } = useWorkspace();
  const { data } = useApi<{ analytics: Analytics }>(`/app/campaigns/${campaign.id}/analytics`);
  const tagData = useApi<{ tags: Array<{ tag: string; count: number }> }>(
    `/app/campaigns/${campaign.id}/tags`,
  );
  const agents = useApi<{ agents: Array<{ id: string; name: string; status: string }> }>(
    '/app/agents',
  );
  const finished = ['COMPLETED', 'CANCELED'].includes(campaign.status);
  const [segments, setSegments] = useState<FollowUpSegment[]>(
    initialSegment ? [initialSegment] : [],
  );
  const [tags, setTags] = useState('');
  const [name, setName] = useState(`${campaign.name} (follow-up)`);
  const [goal, setGoal] = useState('');
  const [agentId, setAgentId] = useState(campaign.agent.id);
  const [selected, setSelected] = useState<number | null>(null);
  const { busy, run } = useAction();

  useEffect(() => {
    if (initialSegment) setSegments([initialSegment]);
  }, [initialSegment]);

  const tagList = useMemo(() => parseTags(tags), [tags]);
  useEffect(() => {
    if (!finished || (!segments.length && !tagList.length)) {
      setSelected(0);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      api<{ selected: number }>(
        `/app/campaigns/${campaign.id}/follow-up/preview?segments=${segments.join(',')}&tags=${encodeURIComponent(tagList.join(','))}`,
      )
        .then((r) => live && setSelected(r.selected))
        .catch(() => live && setSelected(null));
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [campaign.id, finished, segments, tagList]);

  const toggle = (s: FollowUpSegment) =>
    setSegments((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));
  const suggestedGoal =
    segments.length === 1 ? FOLLOW_UP_SEGMENT_INFO[segments[0]!].goal : campaign.goal;

  if (!data) return <Loading />;

  return (
    <div className="space-y-6">
      {(campaign.parentCampaign || campaign.followUps.length > 0) && (
        <Section title="Related campaigns">
          <ul className="space-y-2 text-sm">
            {campaign.parentCampaign && (
              <li>
                Follow-up of{' '}
                <Link
                  className="font-semibold text-brand-700 hover:underline"
                  href={`/dashboard/campaigns/${campaign.parentCampaign.id}`}
                >
                  {campaign.parentCampaign.name}
                </Link>
              </li>
            )}
            {campaign.followUps.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2">
                <Link
                  className="font-semibold text-brand-700 hover:underline"
                  href={`/dashboard/campaigns/${f.id}`}
                >
                  {f.name}
                </Link>
                <StatusBadge status={f.status} />
                <span className="text-muted">
                  {f.followUpSegments.map((s) => humanize(s)).join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section
        title="Create a follow-up campaign"
        description="Pick who to call again. Contacts who asked not to be called or had the wrong number are never included."
      >
        {!finished ? (
          <p className="text-sm text-muted">
            Follow-ups can be created once this campaign has completed or been canceled.
          </p>
        ) : (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await api<{ campaign: { id: string }; contacts: number }>(
                  `/app/campaigns/${campaign.id}/follow-up`,
                  {
                    body: {
                      name,
                      segments,
                      tags: tagList,
                      goal: goal.trim() || undefined,
                      agentId,
                    },
                  },
                );
                await reloadWs();
                toast(
                  `Follow-up created with ${r.contacts} contacts. Review it, then start calling.`,
                );
                router.push(`/dashboard/campaigns/${r.campaign.id}`);
              });
            }}
          >
            <fieldset>
              <legend className="label">Who to call</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {FOLLOW_UP_SEGMENTS.map((s) => {
                  const count = data.analytics.segments[s];
                  return (
                    <label
                      key={s}
                      className={`flex cursor-pointer items-start gap-3 rounded-sm border p-3 text-sm ${
                        segments.includes(s) ? 'border-brand-600 bg-brand-50' : 'border-line'
                      } ${count ? '' : 'opacity-60'}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={segments.includes(s)}
                        onChange={() => toggle(s)}
                        disabled={!count}
                      />
                      <span>
                        <span className="font-semibold">
                          {FOLLOW_UP_SEGMENT_INFO[s].label}{' '}
                          <span className="num font-normal text-muted">
                            ({formatNumber(count)})
                          </span>
                        </span>
                        <span className="block text-xs text-muted">
                          {FOLLOW_UP_SEGMENT_INFO[s].description}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <Field
              id="fu-tags"
              label="Only with these tags"
              optional
              help={
                tagData.data?.tags.length
                  ? `Tags on this list: ${tagData.data.tags.map((t) => `${t.tag} (${t.count})`).join(', ')}. Separate with commas.`
                  : 'No tags on this list yet. Add them when you add or edit contacts.'
              }
            >
              <input
                id="fu-tags"
                className="input"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="vip, webinar"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="fu-name" label="Campaign name">
                <input
                  id="fu-name"
                  className="input"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field id="fu-agent" label="Agent" help="Use another agent for a different script.">
                <select
                  id="fu-agent"
                  className="select"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                >
                  {agents.data?.agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                      {a.status !== 'ACTIVE' ? ` (${humanize(a.status)})` : ''}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field
              id="fu-goal"
              label="Goal"
              optional
              help={
                segments.includes('APPOINTMENT_BOOKED')
                  ? 'Booked contacts carry their appointment time as {{appointment_time}}. Every contact also gets {{previous_outcome}} and {{previous_call_summary}} for the agent to use.'
                  : 'Every contact carries {{previous_outcome}} and {{previous_call_summary}} for the agent to use.'
              }
            >
              <textarea
                id="fu-goal"
                className="textarea min-h-[80px]"
                maxLength={1000}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder={suggestedGoal}
              />
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted" aria-live="polite">
                {selected === null
                  ? ''
                  : selected
                    ? `${formatNumber(selected)} ${selected === 1 ? 'person' : 'people'} will be called.`
                    : 'Choose at least one group or tag.'}
              </p>
              <button className="btn btn-primary" disabled={busy || !selected}>
                Create follow-up campaign
              </button>
            </div>
          </form>
        )}
      </Section>
    </div>
  );
}

export function ExportButton({ campaignId }: { campaignId: string }) {
  return (
    <a className="btn btn-secondary btn-sm" href={`/api/app/campaigns/${campaignId}/export`}>
      <Download size={14} aria-hidden="true" /> Export CSV
    </a>
  );
}
