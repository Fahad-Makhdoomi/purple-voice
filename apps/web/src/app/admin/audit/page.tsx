'use client';

import { useState } from 'react';
import { useApi } from '@/lib/use-api';
import { Loading, PageHeader, Pagination } from '@/components/ui';
import { formatDateTime } from '@/lib/format';

interface Entry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
  actor: { name: string; email: string; role: string } | null;
  workspace: { name: string } | null;
}

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const { data } = useApi<{ entries: Entry[]; total: number; page: number; pageSize: number }>(
    `/admin/super/audit?page=${page}&pageSize=50${query ? `&q=${encodeURIComponent(query)}` : ''}`,
  );
  return (
    <>
      <PageHeader title="Audit log" description="Who did what, and in which workspace." />
      <form
        className="mb-4"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setQuery(q);
        }}
      >
        <label className="sr-only" htmlFor="audit-q">
          Filter
        </label>
        <input
          id="audit-q"
          className="input max-w-md"
          placeholder="Filter by action (e.g. subscription) or actor email"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>
      {!data ? (
        <Loading />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Action</th>
                <th scope="col">Who</th>
                <th scope="col">Workspace</th>
                <th scope="col">IP</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap text-muted">{formatDateTime(e.createdAt)}</td>
                  <td>
                    <code className="text-xs">{e.action}</code>
                  </td>
                  <td>
                    {e.actor ? (
                      <>
                        {e.actor.name}{' '}
                        <span className="text-xs text-muted">
                          ({e.actor.role.toLowerCase().replace('_', ' ')})
                        </span>
                      </>
                    ) : (
                      'System'
                    )}
                  </td>
                  <td className="text-ink-soft">{e.workspace?.name ?? '—'}</td>
                  <td className="font-mono text-xs text-muted">{e.ip ?? '—'}</td>
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
