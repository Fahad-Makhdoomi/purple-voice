'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Search } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { Loading, PageHeader, Pagination, StatusBadge } from '@/components/ui';
import { formatDate, formatRelative } from '@/lib/format';

interface Row {
  id: string;
  name: string;
  suspended: boolean;
  createdAt: string;
  owner: { name: string; email: string; lastLoginAt: string | null } | null;
  plan: { code: string; name: string } | null;
  status: string | null;
  provider: string | null;
  currentPeriodEnd: string | null;
  counts: { agents: number; phoneNumbers: number; calls: number };
}

export default function SubscribersPage() {
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [plan, setPlan] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const params = new URLSearchParams({ page: String(page), pageSize: '25' });
  if (query) params.set('q', query);
  if (plan) params.set('plan', plan);
  if (status) params.set('status', status);
  const { data } = useApi<{ subscribers: Row[]; total: number; page: number; pageSize: number }>(
    `/admin/subscribers?${params}`,
  );

  return (
    <>
      <PageHeader
        title="Subscribers"
        description="Every customer workspace. Open one to manage its subscription or help set it up."
      />
      <form
        className="mb-4 flex flex-wrap gap-3"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(q);
        }}
      >
        <label className="relative min-w-[240px] flex-1">
          <span className="sr-only">Search</span>
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-subtle"
            aria-hidden="true"
          />
          <input
            className="input pl-10"
            placeholder="Company, name or email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <select
          className="select w-auto"
          aria-label="Plan"
          value={plan}
          onChange={(e) => {
            setPlan(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All plans</option>
          <option value="BASIC">Basic</option>
          <option value="PRO">Pro</option>
          <option value="ENTERPRISE">Enterprise</option>
          <option value="NONE">No plan</option>
        </select>
        <select
          className="select w-auto"
          aria-label="Status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Any status</option>
          {['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE'].map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ')}
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
                <th scope="col">Workspace</th>
                <th scope="col">Plan</th>
                <th scope="col">Status</th>
                <th scope="col">Usage</th>
                <th scope="col">Renews</th>
                <th scope="col">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.subscribers.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link
                      href={`/admin/subscribers/${s.id}`}
                      className="font-semibold hover:text-brand-700"
                    >
                      {s.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {s.owner?.email} · last seen {formatRelative(s.owner?.lastLoginAt)}
                    </p>
                  </td>
                  <td>
                    {s.plan ? (
                      <span className="badge badge-brand">{s.plan.name}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td>
                    {s.suspended ? (
                      <span className="badge badge-danger">Suspended</span>
                    ) : (
                      <StatusBadge status={s.status} />
                    )}
                  </td>
                  <td className="text-xs text-ink-soft">
                    {s.counts.agents} agents · {s.counts.phoneNumbers} numbers · {s.counts.calls}{' '}
                    calls
                  </td>
                  <td className="text-muted">{formatDate(s.currentPeriodEnd)}</td>
                  <td className="text-muted">{formatDate(s.createdAt)}</td>
                </tr>
              ))}
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
