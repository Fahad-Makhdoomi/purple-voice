'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CalendarCheck } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { Loading, PageHeader, Section, StatusBadge } from '@/components/ui';
import { formatDateTime, formatDuration, humanize } from '@/lib/format';
import { cn } from '@/lib/cn';

interface CallDetail {
  call: {
    id: string;
    direction: string;
    status: string;
    fromNumber: string;
    toNumber: string;
    durationSec: number;
    billedMinutes: number;
    outcome: string | null;
    sentiment: number | null;
    summary: string | null;
    transferredTo: string | null;
    endReason: string | null;
    errorMessage: string | null;
    createdAt: string;
    transcript: Array<{ role: 'agent' | 'caller' | 'system'; text: string; at: string }>;
    agent: { id: string; name: string } | null;
    campaign: { id: string; name: string } | null;
    contact: { name: string | null; email: string | null; company: string | null } | null;
    appointments: Array<{
      id: string;
      startsAt: string;
      contactName: string;
      externalEventUrl: string | null;
    }>;
  };
}

function sentimentLabel(s: number | null) {
  if (s === null) return '—';
  if (s > 0.35) return 'Positive';
  if (s < -0.35) return 'Negative';
  return 'Neutral';
}

export default function CallPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useApi<CallDetail>(`/app/calls/${id}`);
  if (!data) return <Loading />;
  const { call } = data;
  const other = call.direction === 'OUTBOUND' ? call.toNumber : call.fromNumber;

  return (
    <>
      <PageHeader
        title={call.contact?.name ?? other}
        back={{ href: '/dashboard/calls', label: 'Calls' }}
        description={`${humanize(call.direction)} · ${formatDateTime(call.createdAt)} · ${formatDuration(call.durationSec)}`}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Section title="Transcript">
          {call.transcript.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              No conversation was recorded for this call.
            </p>
          ) : (
            <ol className="space-y-3">
              {call.transcript.map((line, i) =>
                line.role === 'system' ? (
                  <li key={i} className="text-center text-xs font-medium text-muted">
                    {line.text}
                  </li>
                ) : (
                  <li
                    key={i}
                    className={cn('flex', line.role === 'agent' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[78%] rounded-lg px-4 py-2.5 text-sm leading-relaxed',
                        line.role === 'agent'
                          ? 'rounded-br-sm bg-ink text-white'
                          : 'rounded-bl-sm bg-brand-50 text-ink',
                      )}
                    >
                      <span className="sr-only">
                        {line.role === 'agent' ? 'Agent: ' : 'Caller: '}
                      </span>
                      {line.text}
                    </div>
                  </li>
                ),
              )}
            </ol>
          )}
        </Section>

        <aside className="space-y-6">
          <Section title="Summary">
            {call.summary ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                {call.summary}
              </p>
            ) : (
              <p className="text-sm text-muted">No summary for this call.</p>
            )}
            <dl className="mt-5 space-y-2.5 border-t border-line pt-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Outcome</dt>
                <dd>{call.outcome ? <StatusBadge status={call.outcome} /> : '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Status</dt>
                <dd>
                  <StatusBadge status={call.status} />
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Sentiment</dt>
                <dd className="font-medium">{sentimentLabel(call.sentiment)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Billed</dt>
                <dd className="num font-medium">{call.billedMinutes} min</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">Agent</dt>
                <dd className="font-medium">
                  {call.agent ? (
                    <Link
                      href={`/dashboard/agents/${call.agent.id}`}
                      className="hover:text-brand-700"
                    >
                      {call.agent.name}
                    </Link>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              {call.campaign && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Campaign</dt>
                  <dd className="font-medium">
                    <Link
                      href={`/dashboard/campaigns/${call.campaign.id}`}
                      className="hover:text-brand-700"
                    >
                      {call.campaign.name}
                    </Link>
                  </dd>
                </div>
              )}
              {call.transferredTo && (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Transferred to</dt>
                  <dd className="num font-medium">{call.transferredTo}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-muted">From → To</dt>
                <dd className="num text-right text-xs">
                  {call.fromNumber} → {call.toNumber}
                </dd>
              </div>
            </dl>
            {call.errorMessage && (
              <p className="mt-4 rounded-sm bg-danger/5 px-3 py-2 text-xs text-danger">
                {call.errorMessage}
              </p>
            )}
          </Section>

          {call.appointments.length > 0 && (
            <Section title="Booked">
              <ul className="space-y-3">
                {call.appointments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 text-sm">
                    <CalendarCheck size={18} className="text-success" aria-hidden="true" />
                    <span>
                      <span className="font-semibold">{a.contactName}</span> ·{' '}
                      {formatDateTime(a.startsAt)}
                      {a.externalEventUrl && (
                        <a
                          href={a.externalEventUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 font-semibold text-brand-700"
                        >
                          Open in Calendar
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </aside>
      </div>
    </>
  );
}
