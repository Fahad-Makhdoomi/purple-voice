'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { Loading, PageHeader, Pagination, Tabs, useAction } from '@/components/ui';
import { formatDateTime, humanize } from '@/lib/format';

const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST'] as const;

interface Lead {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  message: string;
  plan: string | null;
  source: string;
  status: (typeof STATUSES)[number];
  notes: string;
  createdAt: string;
  owner: { id: string; name: string } | null;
}

export default function LeadsPage() {
  const [status, setStatus] = useState<'ALL' | (typeof STATUSES)[number]>('NEW');
  const [page, setPage] = useState(1);
  const { data, reload } = useApi<{
    leads: Lead[];
    total: number;
    page: number;
    pageSize: number;
    pipeline: Record<string, number>;
  }>(`/admin/leads?page=${page}&pageSize=25${status === 'ALL' ? '' : `&status=${status}`}`);
  const staff = useApi<{ staff: Array<{ id: string; name: string }> }>('/admin/staff');
  const { run } = useAction();
  const update = (id: string, body: Partial<Lead> & { ownerId?: string | null }) =>
    run(async () => {
      await api(`/admin/leads/${id}`, { method: 'PATCH', body, noWorkspace: true });
      await reload();
    }, 'Lead updated');

  return (
    <>
      <PageHeader
        title="Leads"
        description="Enquiries from the website's contact and Enterprise forms."
      />
      <div className="mb-4">
        <Tabs
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: 'ALL', label: 'All' },
            ...STATUSES.map((s) => ({
              value: s,
              label: `${humanize(s)} (${data?.pipeline[s] ?? 0})`,
            })),
          ]}
        />
      </div>
      {!data ? (
        <Loading />
      ) : data.leads.length === 0 ? (
        <p className="card card-pad text-center text-muted">No leads here.</p>
      ) : (
        <div className="space-y-4">
          {data.leads.map((l) => (
            <article key={l.id} className="card card-pad">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold">
                    {l.name}{' '}
                    {l.company && <span className="font-normal text-muted">· {l.company}</span>}
                  </h2>
                  <p className="text-sm text-muted">
                    <a href={`mailto:${l.email}`} className="font-medium text-brand-700">
                      {l.email}
                    </a>
                    {l.phone ? ` · ${l.phone}` : ''} · {formatDateTime(l.createdAt)}
                    {l.plan ? ` · interested in ${humanize(l.plan)}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <select
                    className="select h-9 w-auto"
                    aria-label="Status"
                    value={l.status}
                    onChange={(e) => update(l.id, { status: e.target.value as Lead['status'] })}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {humanize(s)}
                      </option>
                    ))}
                  </select>
                  <select
                    className="select h-9 w-auto"
                    aria-label="Owner"
                    value={l.owner?.id ?? ''}
                    onChange={(e) => update(l.id, { ownerId: e.target.value || null })}
                  >
                    <option value="">Unassigned</option>
                    {staff.data?.staff.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-ink-soft">{l.message}</p>
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-muted">
                  Notes{l.notes ? ' (1)' : ''}
                </summary>
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void update(l.id, {
                      notes: String(new FormData(e.currentTarget).get('notes') ?? ''),
                    });
                  }}
                >
                  <textarea
                    name="notes"
                    defaultValue={l.notes}
                    className="textarea min-h-[70px]"
                    aria-label="Notes"
                  />
                  <button className="btn btn-secondary btn-sm self-end">Save</button>
                </form>
              </details>
            </article>
          ))}
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onPage={setPage}
          />
        </div>
      )}
    </>
  );
}
