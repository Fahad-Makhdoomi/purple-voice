'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PhoneIncoming, PhoneOff, PhoneOutgoing, Search } from 'lucide-react';
import { CALL_OUTCOMES } from '@pv/shared';
import { useApi } from '@/lib/use-api';
import { useSession } from '@/lib/session';
import { Loading, PageHeader, Pagination, StatusBadge, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDateTime, formatDuration, humanize } from '@/lib/format';

interface CallRow {
  id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: string;
  fromNumber: string;
  toNumber: string;
  durationSec: number;
  outcome: string | null;
  sentiment: number | null;
  createdAt: string;
  agent: { id: string; name: string } | null;
  /** Set when a person called from the browser dialer. */
  placedBy: { id: string; name: string } | null;
  campaign: { id: string; name: string } | null;
  contact: { id: string; name: string | null } | null;
}

const LIVE_STATUSES = ['QUEUED', 'RINGING', 'IN_PROGRESS'];

export default function CallsPage() {
  const { me } = useSession();
  const { busy, run } = useAction();
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState('');
  const [outcome, setOutcome] = useState('');
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (query) params.set('q', query);
  if (direction) params.set('direction', direction);
  if (outcome) params.set('outcome', outcome);
  const { data, reload } = useApi<{ calls: CallRow[]; total: number; page: number; pageSize: number }>(
    `/app/calls?${params}`,
  );

  return (
    <>
      <PageHeader
        title="Calls"
        description="Every call your agents made or answered, with transcript and summary, plus calls made from the dialer."
      />
      <form
        className="mb-4 flex flex-wrap gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(q);
        }}
        role="search"
      >
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">Search calls</span>
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle"
            aria-hidden="true"
          />
          <input
            className="input pl-10"
            placeholder="Number, name or words in the summary"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className="sr-only" htmlFor="direction">
          Direction
        </label>
        <select
          id="direction"
          className="select w-auto"
          value={direction}
          onChange={(e) => {
            setDirection(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All directions</option>
          <option value="OUTBOUND">Outbound</option>
          <option value="INBOUND">Inbound</option>
        </select>
        <label className="sr-only" htmlFor="outcome">
          Outcome
        </label>
        <select
          id="outcome"
          className="select w-auto"
          value={outcome}
          onChange={(e) => {
            setOutcome(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All outcomes</option>
          {CALL_OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {humanize(o)}
            </option>
          ))}
        </select>
      </form>

      {!data ? (
        <Loading />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Contact</th>
                <th scope="col">Handled by</th>
                <th scope="col">Status</th>
                <th scope="col">Outcome</th>
                <th scope="col">Duration</th>
                <th scope="col">When</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.calls.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted">
                    No calls match.
                  </td>
                </tr>
              )}
              {data.calls.map((c) => {
                const other = c.direction === 'OUTBOUND' ? c.toNumber : c.fromNumber;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/dashboard/calls/${c.id}`}
                        className="flex items-center gap-2.5 font-semibold hover:text-brand-700"
                      >
                        {c.direction === 'OUTBOUND' ? (
                          <PhoneOutgoing
                            size={15}
                            className="text-brand-600"
                            aria-label="Outbound"
                          />
                        ) : (
                          <PhoneIncoming size={15} className="text-success" aria-label="Inbound" />
                        )}
                        {c.contact?.name ?? other}
                      </Link>
                      <p className="num pl-6 text-xs text-muted">
                        {c.contact?.name ? other : ''}
                        {c.campaign ? `${c.contact?.name ? ' · ' : ''}${c.campaign.name}` : ''}
                      </p>
                    </td>
                    <td className="text-ink-soft">
                      {c.agent?.name ??
                        (c.placedBy
                          ? `${c.placedBy.id === me?.user.id ? 'You' : c.placedBy.name} · dialer`
                          : '—')}
                    </td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>
                      {c.outcome ? (
                        <StatusBadge status={c.outcome} />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="num">{formatDuration(c.durationSec)}</td>
                    <td className="whitespace-nowrap text-muted">{formatDateTime(c.createdAt)}</td>
                    <td className="text-right">
                      {LIVE_STATUSES.includes(c.status) && (
                        <button
                          type="button"
                          className="btn btn-sm inline-flex items-center gap-1.5 text-danger"
                          disabled={busy}
                          title="Force end this call if it is stuck"
                          onClick={() => {
                            if (!window.confirm('End this call now?')) return;
                            void run(async () => {
                              await api(`/app/calls/${c.id}/end`, { method: 'POST' });
                              await reload();
                            }, 'Call ended');
                          }}
                        >
                          <PhoneOff size={14} aria-hidden="true" />
                          End call
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPage={setPage}
            />
          </div>
        </div>
      )}
    </>
  );
}
