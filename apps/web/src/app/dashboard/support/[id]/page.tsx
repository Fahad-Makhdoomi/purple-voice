'use client';

import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { Loading, PageHeader, Section, StatusBadge, useAction } from '@/components/ui';
import { TicketThread, type ThreadMessage } from '@/components/dashboard/TicketThread';

export default function TicketPage() {
  const { id } = useParams<{ id: string }>();
  const { data, reload } = useApi<{
    ticket: { subject: string; status: string; priority: string; messages: ThreadMessage[] };
  }>(`/app/support/tickets/${id}`);
  const { busy, run } = useAction();
  if (!data) return <Loading />;
  const { ticket } = data;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={ticket.subject}
        back={{ href: '/dashboard/support', label: 'Support' }}
        description={
          <span className="inline-flex gap-2">
            <StatusBadge status={ticket.status} />
            {ticket.priority !== 'NORMAL' && <StatusBadge status={ticket.priority} />}
          </span>
        }
      />
      <Section>
        <TicketThread messages={ticket.messages} viewer="customer" />
        <form
          className="mt-6 space-y-3 border-t border-line pt-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const body = String(new FormData(form).get('body') ?? '');
            const ok = await run(async () => {
              await api(`/app/support/tickets/${id}/messages`, { body: { body } });
              return true;
            }, 'Reply sent');
            if (ok) {
              form.reset();
              await reload();
            }
          }}
        >
          <label htmlFor="reply" className="label">
            Reply
          </label>
          <textarea id="reply" name="body" className="textarea" required />
          <button className="btn btn-primary" disabled={busy}>
            Send reply
          </button>
        </form>
      </Section>
    </div>
  );
}
