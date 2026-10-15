'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useApi } from '@/lib/use-api';
import { Loading, PageHeader, StatusBadge, Tabs } from '@/components/ui';
import { formatRelative } from '@/lib/format';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  updatedAt: string;
  workspace: { id: string; name: string; subscription: { plan: { code: string } } | null };
  assignee: { name: string } | null;
  _count: { messages: number };
}

export default function AdminSupportPage() {
  const [status, setStatus] = useState<'' | 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED'>('');
  const { data } = useApi<{ tickets: Ticket[] }>(
    `/admin/tickets${status ? `?status=${status}` : ''}`,
  );
  return (
    <>
      <PageHeader
        title="Support queue"
        description="Priority (Pro and Enterprise) tickets come first, oldest first within each priority."
      />
      <div className="mb-4">
        <Tabs
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'Needs attention' },
            { value: 'OPEN', label: 'Open' },
            { value: 'PENDING', label: 'Waiting on customer' },
            { value: 'RESOLVED', label: 'Resolved' },
            { value: 'CLOSED', label: 'Closed' },
          ]}
        />
      </div>
      {!data ? (
        <Loading />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Ticket</th>
                <th scope="col">Customer</th>
                <th scope="col">Priority</th>
                <th scope="col">Status</th>
                <th scope="col">Assignee</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.tickets.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link
                      href={`/admin/support/${t.id}`}
                      className="font-semibold hover:text-brand-700"
                    >
                      {t.subject}
                    </Link>
                    <p className="text-xs text-muted">{t._count.messages} messages</p>
                  </td>
                  <td>
                    <Link
                      href={`/admin/subscribers/${t.workspace.id}`}
                      className="hover:text-brand-700"
                    >
                      {t.workspace.name}
                    </Link>
                    {t.workspace.subscription && (
                      <span className="ml-2 badge badge-neutral">
                        {t.workspace.subscription.plan.code}
                      </span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={t.priority} />
                  </td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                  <td className="text-ink-soft">{t.assignee?.name ?? '—'}</td>
                  <td className="text-muted">{formatRelative(t.updatedAt)}</td>
                </tr>
              ))}
              {!data.tickets.length && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-muted">
                    Inbox zero.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
