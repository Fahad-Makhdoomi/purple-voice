'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { Loading, PageHeader, Pagination, Section, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';
import { formatRelative, humanize } from '@/lib/format';

interface Row {
  id: string;
  phone: string;
  source: string;
  note: string | null;
  createdAt: string;
}

const SOURCES: Record<string, string> = {
  call: 'Asked on a call',
  manual: 'Added by hand',
  import: 'Imported',
};

/** The workspace's do-not-call list: numbers no campaign will ever dial. */
export default function DoNotCallPage() {
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [phones, setPhones] = useState('');
  const list = useApi<{ numbers: Row[]; total: number; page: number; pageSize: number }>(
    `/app/do-not-call?page=${page}&pageSize=50${q ? `&q=${encodeURIComponent(q)}` : ''}`,
  );
  const { busy, run } = useAction();

  return (
    <>
      <PageHeader
        title="Do-not-call list"
        back={{ href: '/dashboard/campaigns', label: 'Campaigns' }}
        description="No campaign calls these numbers. People who ask on a call not to be called again are added automatically; add numbers from your own suppression lists here (for example after screening against the US National DNC Registry or the UK TPS)."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Section
          title="Numbers"
          actions={
            <input
              className="input h-9 w-48 text-sm"
              placeholder="Search a number"
              aria-label="Search numbers"
              value={q}
              onChange={(e) => {
                setQ(e.target.value.trim());
                setPage(1);
              }}
            />
          }
        >
          {!list.data ? (
            <Loading />
          ) : list.data.numbers.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No numbers on the list.</p>
          ) : (
            <>
              <div className="-mx-5 overflow-x-auto sm:-mx-6">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Number</th>
                      <th scope="col">How it got here</th>
                      <th scope="col">Added</th>
                      <th scope="col">
                        <span className="sr-only">Remove</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.numbers.map((n) => (
                      <tr key={n.id}>
                        <td className="num font-semibold">{n.phone}</td>
                        <td className="text-ink-soft">
                          {SOURCES[n.source] ?? humanize(n.source)}
                          {n.note && <span className="block text-xs text-muted">{n.note}</span>}
                        </td>
                        <td className="text-muted">{formatRelative(n.createdAt)}</td>
                        <td className="text-right">
                          <button
                            className="btn btn-ghost btn-icon h-8 w-8 text-danger"
                            aria-label={`Remove ${n.phone}`}
                            disabled={busy}
                            onClick={() =>
                              window.confirm(
                                n.source === 'call'
                                  ? `${n.phone} asked not to be called. Only remove it if they have since given you consent again. Remove?`
                                  : `Remove ${n.phone} from the list?`,
                              ) &&
                              run(async () => {
                                await api(`/app/do-not-call/${n.id}`, { method: 'DELETE' });
                                await list.reload();
                              }, 'Removed')
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                pageSize={list.data.pageSize}
                total={list.data.total}
                onPage={setPage}
              />
            </>
          )}
        </Section>

        <Section title="Add numbers">
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const r = await api<{ added: number; invalid: number }>('/app/do-not-call', {
                  body: { phones },
                });
                setPhones('');
                await list.reload();
                return r;
              }, 'Added to the do-not-call list');
            }}
          >
            <Field
              id="dnc-phones"
              label="Phone numbers"
              help="One per line, in international format. Pending contacts with these numbers in any campaign stop being called."
            >
              <textarea
                id="dnc-phones"
                className="textarea min-h-[160px] font-mono text-sm"
                value={phones}
                onChange={(e) => setPhones(e.target.value)}
                placeholder={'+14155550123\n+447700900123'}
                required
              />
            </Field>
            <button className="btn btn-primary w-full" disabled={busy || !phones.trim()}>
              Add to list
            </button>
          </form>
        </Section>
      </div>
    </>
  );
}
