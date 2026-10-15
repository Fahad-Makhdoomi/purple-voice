'use client';

import { useParams, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Pause, Play, Trash2, Upload, XCircle } from 'lucide-react';
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

interface CampaignDetail {
  campaign: {
    id: string;
    name: string;
    status: string;
    goal: string;
    timezone: string;
    callWindowStart: string;
    callWindowEnd: string;
    callDays: number[];
    concurrency: number;
    maxAttempts: number;
    agent: { id: string; name: string; status: string };
    phoneNumber: { e164: string; routingConfigured: boolean };
  };
  stats: {
    contacts: Record<string, number>;
    outcomes: Record<string, number>;
    calls: number;
    minutes: number;
  };
}
interface Contact {
  id: string;
  phone: string;
  name: string | null;
  company: string | null;
  status: string;
  attempts: number;
  lastOutcome: string | null;
  lastAttemptAt: string | null;
}

const FILTERS = ['ALL', 'PENDING', 'COMPLETED', 'NO_ANSWER', 'FAILED', 'DO_NOT_CALL'] as const;

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { entitlements, reload: reloadWs } = useWorkspace();
  const { data, reload } = useApi<CampaignDetail>(`/app/campaigns/${id}`);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('ALL');
  const [page, setPage] = useState(1);
  const contacts = useApi<{ contacts: Contact[]; total: number; page: number; pageSize: number }>(
    `/app/campaigns/${id}/contacts?page=${page}&pageSize=25${filter === 'ALL' ? '' : `&status=${filter}`}`,
  );
  const file = useRef<HTMLInputElement>(null);
  const { busy, run } = useAction();

  if (!data) return <Loading />;
  const { campaign, stats } = data;
  const total = Object.values(stats.contacts).reduce((a, b) => a + b, 0);
  const done = total - (stats.contacts.PENDING ?? 0) - (stats.contacts.CALLING ?? 0);
  const refresh = async () => {
    await Promise.all([reload(), contacts.reload()]);
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
    const csv = await f.text();
    await run(async () => {
      const r = await api<{
        added: number;
        duplicates: number;
        invalidCount: number;
        invalid: Array<{ row: number; reason: string }>;
      }>(`/app/campaigns/${id}/contacts`, { body: { csv } });
      await refresh();
      toast(
        `Added ${r.added} contacts${r.duplicates ? `, ${r.duplicates} already in the list` : ''}${r.invalidCount ? `, ${r.invalidCount} skipped (e.g. row ${r.invalid[0]?.row}: ${r.invalid[0]?.reason})` : ''}`,
      );
    });
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

      <Section
        className="mt-6"
        title="Contacts"
        description="CSV with a header row and a phone column. Other columns (name, email, company, anything else) become {{variables}} for the agent."
        actions={
          !['COMPLETED', 'CANCELED'].includes(campaign.status) && (
            <>
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
          )
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
              label: f === 'ALL' ? `All (${total})` : `${humanize(f)} (${stats.contacts[f] ?? 0})`,
            }))}
          />
        </div>
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
                      </td>
                      <td>
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="num">{c.attempts}</td>
                      <td>{c.lastOutcome ? humanize(c.lastOutcome) : '—'}</td>
                      <td className="text-muted">{formatRelative(c.lastAttemptAt)}</td>
                      <td className="text-right">
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
    </>
  );
}
