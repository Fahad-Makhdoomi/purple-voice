'use client';

import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { FileText, Pause, Pencil, Play, Plus, Trash2, Upload, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useWorkspace } from '@/lib/workspace';
import {
  Loading,
  Meter,
  PageHeader,
  Pagination,
  Section,
  StatTile,
  StatusBadge,
  Tabs,
  toast,
  useAction,
} from '@/components/ui';
import { formatNumber, formatRelative, humanize } from '@/lib/format';
import { Field } from '@/components/forms/Field';
import { MIN_CALL_DELAY_SECONDS, type FollowUpSegment } from '@pv/shared';
import { ContactModal, type EditableContact } from './contact-modal';
import { PersonalizationPanel, ScriptModal, UploadPreviewModal } from './personalization';
import { AiPanel, AnalyticsPanel, ExportButton, FollowUpPanel, type Report } from './insights';

interface CampaignDetail {
  campaign: {
    id: string;
    name: string;
    status: string;
    goal: string;
    personalization: string;
    timezone: string;
    callWindowStart: string;
    callWindowEnd: string;
    callDays: number[];
    concurrency: number;
    callDelaySeconds: number;
    maxAttempts: number;
    agent: { id: string; name: string; status: string };
    phoneNumber: { e164: string; routingConfigured: boolean };
    aiReport: Report | null;
    aiReportAt: string | null;
    parentCampaign: { id: string; name: string } | null;
    followUps: Array<{ id: string; name: string; status: string; followUpSegments: string[] }>;
  };
  stats: {
    contacts: Record<string, number>;
    outcomes: Record<string, number>;
    calls: number;
    minutes: number;
  };
}
interface Contact extends EditableContact {
  id: string;
  phone: string;
  name: string | null;
  company: string | null;
  status: string;
  attempts: number;
  lastOutcome: string | null;
  lastAttemptAt: string | null;
  fields: Record<string, unknown> | null;
}

type View = 'contacts' | 'analytics' | 'follow-up';

const FILTERS = ['ALL', 'PENDING', 'COMPLETED', 'NO_ANSWER', 'FAILED', 'DO_NOT_CALL'] as const;

/** Calls at once and the pause between calls; changes apply from the next call. */
function PaceEditor({
  campaignId,
  delaySeconds,
  concurrency,
  maxConcurrency,
  onSaved,
}: {
  campaignId: string;
  delaySeconds: number;
  concurrency: number;
  maxConcurrency: number;
  onSaved: () => Promise<void>;
}) {
  const [delay, setDelay] = useState(String(delaySeconds));
  const [lines, setLines] = useState(String(concurrency));
  const { busy, run } = useAction();
  const dirty = delay !== String(delaySeconds) || lines !== String(concurrency);
  return (
    <form
      className="card card-pad mb-6 flex flex-wrap items-end gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void run(async () => {
          await api(`/app/campaigns/${campaignId}`, {
            method: 'PATCH',
            body: { callDelaySeconds: Number(delay), concurrency: Number(lines) },
          });
          await onSaved();
        }, 'Calling pace saved');
      }}
    >
      <Field
        id="pace-delay"
        label="Wait between calls (seconds)"
        help={`Minimum ${MIN_CALL_DELAY_SECONDS}.`}
      >
        <input
          id="pace-delay"
          type="number"
          className="input w-40"
          min={MIN_CALL_DELAY_SECONDS}
          max={3600}
          required
          value={delay}
          onChange={(e) => setDelay(e.target.value)}
        />
      </Field>
      <Field
        id="pace-lines"
        label="Calls at once"
        help={`Your plan allows up to ${maxConcurrency}.`}
      >
        <input
          id="pace-lines"
          type="number"
          className="input w-32"
          min={1}
          max={maxConcurrency}
          required
          value={lines}
          onChange={(e) => setLines(e.target.value)}
        />
      </Field>
      <button className="btn btn-secondary" disabled={busy || !dirty}>
        Save pace
      </button>
    </form>
  );
}

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { entitlements, reload: reloadWs } = useWorkspace();
  const { data, reload } = useApi<CampaignDetail>(`/app/campaigns/${id}`);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [page, setPage] = useState(1);
  const [tag, setTag] = useState('');
  const contacts = useApi<{ contacts: Contact[]; total: number; page: number; pageSize: number }>(
    `/app/campaigns/${id}/contacts?page=${page}&pageSize=25${filter === 'ALL' ? '' : `&status=${filter}`}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`,
  );
  const tags = useApi<{ tags: Array<{ tag: string; count: number }> }>(`/app/campaigns/${id}/tags`);
  const tagList = tags.data?.tags ?? [];
  const file = useRef<HTMLInputElement>(null);
  const { busy, run } = useAction();
  const [view, setView] = useState<View | null>(null);
  const [uploadTags, setUploadTags] = useState('');
  const [editing, setEditing] = useState<Contact | 'new' | null>(null);
  const [pendingCsv, setPendingCsv] = useState<string | null>(null);
  const [scriptFor, setScriptFor] = useState<Contact | null>(null);
  const [followUpSegment, setFollowUpSegment] = useState<FollowUpSegment | undefined>();

  if (!data) return <Loading />;
  const { campaign, stats } = data;
  const finished = ['COMPLETED', 'CANCELED'].includes(campaign.status);
  const activeView: View = view ?? (finished && stats.calls > 0 ? 'analytics' : 'contacts');
  const total = Object.values(stats.contacts).reduce((a, b) => a + b, 0);
  const done = total - (stats.contacts.PENDING ?? 0) - (stats.contacts.CALLING ?? 0);
  const refresh = async () => {
    await Promise.all([reload(), contacts.reload(), tags.reload()]);
  };
  const lifecycle = (action: 'start' | 'pause' | 'cancel', msg: string) =>
    run(async () => {
      await api(`/app/campaigns/${id}/${action}`, { method: 'POST' });
      await refresh();
    }, msg);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 5_000_000) return toast('CSV files must be under 5 MB', 'error');
    setPendingCsv(await f.text());
  }

  const limit = entitlements.limits.contactsPerCampaign;

  return (
    <>
      <PageHeader
        title={campaign.name}
        back={{ href: '/dashboard/campaigns', label: 'Campaigns' }}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge status={campaign.status} /> {campaign.agent.name} · from{' '}
            {campaign.phoneNumber.e164} · {campaign.callWindowStart}–{campaign.callWindowEnd}{' '}
            {campaign.timezone}
          </span>
        }
        actions={
          <>
            {['DRAFT', 'PAUSED'].includes(campaign.status) && (
              <button
                className="btn btn-brand"
                disabled={busy}
                onClick={() => lifecycle('start', 'Campaign started')}
              >
                <Play size={16} aria-hidden="true" />{' '}
                {campaign.status === 'PAUSED' ? 'Resume' : 'Start calling'}
              </button>
            )}
            {campaign.status === 'RUNNING' && (
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => lifecycle('pause', 'Campaign paused')}
              >
                <Pause size={16} aria-hidden="true" /> Pause
              </button>
            )}
            {!['COMPLETED', 'CANCELED'].includes(campaign.status) && (
              <button
                className="btn btn-ghost text-danger"
                disabled={busy}
                onClick={() =>
                  window.confirm('Cancel this campaign? Remaining contacts will not be called.') &&
                  lifecycle('cancel', 'Campaign canceled')
                }
              >
                <XCircle size={16} aria-hidden="true" /> Cancel
              </button>
            )}
            {campaign.status !== 'RUNNING' && (
              <button
                className="btn btn-ghost btn-icon text-danger"
                aria-label="Delete campaign"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (
                      !window.confirm(
                        'Delete this campaign and its contact list? Call history is kept.',
                      )
                    )
                      return;
                    await api(`/app/campaigns/${id}`, { method: 'DELETE' });
                    await reloadWs();
                    router.push('/dashboard/campaigns');
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            )}
          </>
        }
      />

      <PaceEditor
        key={`${campaign.callDelaySeconds}-${campaign.concurrency}`}
        campaignId={campaign.id}
        delaySeconds={campaign.callDelaySeconds}
        concurrency={campaign.concurrency}
        maxConcurrency={entitlements.limits.concurrentCalls}
        onSaved={reload}
      />

      {!finished && (
        <PersonalizationPanel
          key={campaign.personalization}
          campaignId={campaign.id}
          personalization={campaign.personalization}
          contactCount={total}
          onSaved={reload}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Contacts"
          value={formatNumber(total)}
          hint={limit === null ? 'No limit on your plan' : `Up to ${limit} on your plan`}
        />
        <StatTile
          label="Reached"
          value={formatNumber(done)}
          hint={<Meter value={done} max={Math.max(total, 1)} />}
        />
        <StatTile
          label="Calls placed"
          value={formatNumber(stats.calls)}
          hint={`${formatNumber(stats.minutes)} minutes`}
        />
        <StatTile
          label="Appointments"
          value={formatNumber(stats.outcomes.APPOINTMENT_BOOKED ?? 0)}
          hint={`${stats.outcomes.INTERESTED ?? 0} more interested`}
        />
      </div>

      <div className="mt-6">
        <Tabs
          value={activeView}
          onChange={setView}
          options={[
            { value: 'contacts', label: `Contacts (${total})` },
            { value: 'analytics', label: 'Analytics' },
            { value: 'follow-up', label: 'Follow-up' },
          ]}
        />
      </div>

      {activeView === 'analytics' && (
        <div className="mt-6 space-y-6">
          <AiPanel
            campaignId={campaign.id}
            status={campaign.status}
            report={campaign.aiReport}
            reportAt={campaign.aiReportAt}
            onChanged={reload}
            onFollowUp={(s) => {
              setFollowUpSegment(s);
              setView('follow-up');
            }}
          />
          <AnalyticsPanel campaignId={campaign.id} />
        </div>
      )}

      {activeView === 'follow-up' && (
        <div className="mt-6">
          <FollowUpPanel campaign={campaign} initialSegment={followUpSegment} />
        </div>
      )}

      {activeView === 'contacts' && (
        <Section
          className="mt-6"
          title="Contacts"
          description="Add people one at a time or upload a CSV with a header row and a phone column. A tags column (e.g. vip; webinar) labels contacts, and any other column (business name, industry, city…) is shown to you before you import and given to the AI to personalise each call."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <ExportButton campaignId={campaign.id} />
              {!finished && (
                <>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() => setEditing('new')}
                  >
                    <Plus size={14} aria-hidden="true" /> Add contact
                  </button>
                  <input
                    className="input h-9 w-36 text-sm"
                    value={uploadTags}
                    onChange={(e) => setUploadTags(e.target.value)}
                    placeholder="Tag this upload"
                    aria-label="Tags to put on every contact in the upload (optional)"
                  />
                  <input
                    ref={file}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={onFile}
                    aria-label="Upload CSV"
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => file.current?.click()}
                  >
                    <Upload size={14} aria-hidden="true" /> Upload CSV
                  </button>
                </>
              )}
            </div>
          }
        >
          <div className="mb-4">
            <Tabs
              value={filter}
              onChange={(v) => {
                setFilter(v);
                setPage(1);
              }}
              options={FILTERS.map((f) => ({
                value: f,
                label:
                  f === 'ALL' ? `All (${total})` : `${humanize(f)} (${stats.contacts[f] ?? 0})`,
              }))}
            />
          </div>
          {tagList.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Tag:</span>
              <button
                className="chip"
                aria-pressed={!tag}
                onClick={() => {
                  setTag('');
                  setPage(1);
                }}
              >
                Any
              </button>
              {tagList.map((t) => (
                <button
                  key={t.tag}
                  className="chip"
                  aria-pressed={tag === t.tag}
                  onClick={() => {
                    setTag(t.tag);
                    setPage(1);
                  }}
                >
                  {t.tag} ({t.count})
                </button>
              ))}
            </div>
          )}
          {!contacts.data ? (
            <Loading />
          ) : contacts.data.contacts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No contacts here yet.</p>
          ) : (
            <>
              <div className="-mx-5 overflow-x-auto sm:-mx-6">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Contact</th>
                      <th scope="col">Status</th>
                      <th scope="col">Attempts</th>
                      <th scope="col">Last outcome</th>
                      <th scope="col">Last call</th>
                      <th scope="col">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.data.contacts.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <p className="font-semibold">{c.name ?? c.phone}</p>
                          <p className="num text-xs text-muted">
                            {c.name ? c.phone : ''}
                            {c.company ? ` · ${c.company}` : ''}
                          </p>
                          {c.fields && Object.keys(c.fields).length > 0 && (
                            <p className="mt-1 text-xs text-muted">
                              {Object.entries(c.fields)
                                .slice(0, 3)
                                .map(([k, v]) => `${k}: ${String(v)}`)
                                .join(' · ')}
                            </p>
                          )}
                          {c.tags.length > 0 && (
                            <p className="mt-1 flex flex-wrap gap-1">
                              {c.tags.map((t) => (
                                <span key={t} className="badge badge-neutral">
                                  {t}
                                </span>
                              ))}
                            </p>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="num">{c.attempts}</td>
                        <td>{c.lastOutcome ? humanize(c.lastOutcome) : '—'}</td>
                        <td className="text-muted">{formatRelative(c.lastAttemptAt)}</td>
                        <td className="whitespace-nowrap text-right">
                          <button
                            className="btn btn-ghost btn-icon h-8 w-8"
                            aria-label={`Preview call script for ${c.name ?? c.phone}`}
                            title="Preview call script"
                            onClick={() => setScriptFor(c)}
                          >
                            <FileText size={14} />
                          </button>
                          {c.status !== 'CALLING' && (
                            <button
                              className="btn btn-ghost btn-icon h-8 w-8"
                              aria-label={`Edit ${c.name ?? c.phone}`}
                              onClick={() => setEditing(c)}
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {c.status !== 'CALLING' && (
                            <button
                              className="btn btn-ghost btn-icon h-8 w-8 text-danger"
                              aria-label={`Remove ${c.phone}`}
                              onClick={() =>
                                run(async () => {
                                  await api(`/app/campaigns/${id}/contacts/${c.id}`, {
                                    method: 'DELETE',
                                  });
                                  await refresh();
                                })
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                pageSize={contacts.data.pageSize}
                total={contacts.data.total}
                onPage={setPage}
              />
            </>
          )}
        </Section>
      )}

      {pendingCsv && (
        <UploadPreviewModal
          campaignId={campaign.id}
          csv={pendingCsv}
          tags={uploadTags
            .split(/[;,]/)
            .map((t) => t.trim())
            .filter(Boolean)}
          onClose={() => setPendingCsv(null)}
          onImported={async (message) => {
            await refresh();
            toast(message);
          }}
        />
      )}
      {scriptFor && (
        <ScriptModal
          campaignId={campaign.id}
          contactId={scriptFor.id}
          label={scriptFor.name ?? scriptFor.phone}
          onClose={() => setScriptFor(null)}
        />
      )}

      {editing && (
        <ContactModal
          campaignId={campaign.id}
          contact={editing === 'new' ? undefined : editing}
          finished={finished}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}
