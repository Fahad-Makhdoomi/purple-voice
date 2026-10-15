'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LifeBuoy, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useFeature } from '@/lib/workspace';
import { Assistant } from '@/components/dashboard/Assistant';
import {
  EmptyState,
  Loading,
  Modal,
  PageHeader,
  Section,
  StatusBadge,
  useAction,
} from '@/components/ui';
import { Field } from '@/components/forms/Field';
import { formatRelative } from '@/lib/format';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  updatedAt: string;
  _count: { messages: number };
}

export default function SupportPage() {
  const assistant = useFeature('aiSupportAssistant');
  const priority = useFeature('prioritySupport');
  const { data, reload } = useApi<{ tickets: Ticket[] }>('/app/support/tickets');
  const [open, setOpen] = useState(false);
  const { busy, run } = useAction();

  return (
    <>
      <PageHeader
        title="Support"
        description={
          priority
            ? 'Your plan includes priority support — your tickets go to the front of the queue.'
            : 'We reply within one business day.'
        }
        actions={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={16} aria-hidden="true" /> New ticket
          </button>
        }
      />
      <div className={assistant ? 'grid gap-6 xl:grid-cols-[1fr_420px]' : ''}>
        <Section title="Your tickets">
          {!data ? (
            <Loading />
          ) : data.tickets.length === 0 ? (
            <EmptyState
              icon={LifeBuoy}
              title="No tickets"
              body="Stuck on something? Open a ticket and the team will help."
            />
          ) : (
            <ul className="divide-y divide-line">
              {data.tickets.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/dashboard/support/${t.id}`}
                    className="flex items-center gap-3 py-3.5 hover:text-brand-700"
                  >
                    <span className="flex-1 font-semibold">{t.subject}</span>
                    {t.priority !== 'NORMAL' && <StatusBadge status={t.priority} />}
                    <StatusBadge status={t.status} />
                    <span className="hidden w-28 text-right text-xs text-muted sm:block">
                      {formatRelative(t.updatedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
        {assistant && <Assistant />}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="New support ticket">
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const ok = await run(async () => {
              await api('/app/support/tickets', {
                body: { subject: f.get('subject'), body: f.get('body') },
              });
              return true;
            }, 'Ticket opened');
            if (ok) {
              setOpen(false);
              await reload();
            }
          }}
        >
          <Field id="subject" label="Subject">
            <input
              id="subject"
              name="subject"
              className="input"
              required
              minLength={4}
              maxLength={200}
            />
          </Field>
          <Field
            id="body"
            label="What's happening?"
            help="Include the agent, number or call involved if relevant."
          >
            <textarea id="body" name="body" className="textarea" required minLength={10} />
          </Field>
          <button className="btn btn-primary w-full" disabled={busy}>
            Open ticket
          </button>
        </form>
      </Modal>
    </>
  );
}
