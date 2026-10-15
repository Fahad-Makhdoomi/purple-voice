'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { Loading, PageHeader, Section, useAction } from '@/components/ui';
import { TicketThread, type ThreadMessage } from '@/components/dashboard/TicketThread';
import { humanize } from '@/lib/format';

interface TicketDetail {
  ticket: {
    id: string;
    subject: string;
    status: string;
    priority: string;
    assignee: { id: string; name: string } | null;
    workspace: { id: string; name: string };
    messages: ThreadMessage[];
  };
}

export default function AdminTicketPage() {
  const { id } = useParams<{ id: string }>();
  const { data, reload } = useApi<TicketDetail>(`/admin/tickets/${id}`);
  const staff = useApi<{ staff: Array<{ id: string; name: string }> }>('/admin/staff');
  const { busy, run } = useAction();
  if (!data) return <Loading />;
  const { ticket } = data;
  const update = (body: Record<string, unknown>) =>
    run(async () => {
      await api(`/admin/tickets/${id}`, { method: 'PATCH', body });
      await reload();
    }, 'Ticket updated');

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <PageHeader
          title={ticket.subject}
          back={{ href: '/admin/support', label: 'Support queue' }}
          description={
            <>
              From{' '}
              <Link
                href={`/admin/subscribers/${ticket.workspace.id}`}
                className="font-semibold text-brand-700"
              >
                {ticket.workspace.name}
              </Link>
            </>
          }
        />
        <Section>
          <TicketThread messages={ticket.messages} viewer="staff" />
          <form
            className="mt-6 space-y-3 border-t border-line pt-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const body = String(new FormData(form).get('body') ?? '');
              const ok = await run(async () => {
                await api(`/admin/tickets/${id}/messages`, { body: { body } });
                return true;
              }, 'Reply sent — the customer was emailed');
              if (ok) {
                form.reset();
                await reload();
              }
            }}
          >
            <label htmlFor="reply" className="label">
              Reply to customer
            </label>
            <textarea id="reply" name="body" className="textarea" required />
            <button className="btn btn-primary" disabled={busy}>
              Send reply
            </button>
          </form>
        </Section>
      </div>
      <aside className="space-y-4 xl:pt-24">
        <Section title="Ticket">
          <div className="space-y-4">
            <label className="block">
              <span className="label">Status</span>
              <select
                className="select"
                value={ticket.status}
                onChange={(e) => update({ status: e.target.value })}
              >
                {['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'].map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Priority</span>
              <select
                className="select"
                value={ticket.priority}
                onChange={(e) => update({ priority: e.target.value })}
              >
                {['NORMAL', 'HIGH', 'URGENT'].map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Assignee</span>
              <select
                className="select"
                value={ticket.assignee?.id ?? ''}
                onChange={(e) => update({ assigneeId: e.target.value || null })}
              >
                <option value="">Unassigned</option>
                {staff.data?.staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </Section>
      </aside>
    </div>
  );
}
