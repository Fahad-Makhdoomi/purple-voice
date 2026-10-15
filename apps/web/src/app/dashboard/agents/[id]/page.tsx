'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, PhoneOutgoing, Trash2 } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useWorkspace } from '@/lib/workspace';
import { AgentForm, EMPTY_AGENT, type AgentDraft } from '@/components/dashboard/AgentForm';
import {
  ErrorNote,
  Loading,
  Modal,
  PageHeader,
  Section,
  StatusBadge,
  toast,
  useAction,
} from '@/components/ui';
import { Field } from '@/components/forms/Field';
import { humanize } from '@/lib/format';

interface AgentResponse {
  agent: AgentDraft & {
    id: string;
    status: 'DRAFT' | 'ACTIVE' | 'PAUSED';
    inboundNumbers: Array<{ id: string; e164: string }>;
  };
  readiness: Array<{ key: string; label: string; ok: boolean; blocking: boolean }>;
  outcomes: Array<{ outcome: string | null; _count: { _all: number } }>;
}

const EDITABLE = Object.keys(EMPTY_AGENT) as Array<keyof AgentDraft>;

export default function AgentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { reload: reloadWorkspace } = useWorkspace();
  const { data, reload } = useApi<AgentResponse>(`/app/agents/${id}`);
  const numbers = useApi<{
    numbers: Array<{ id: string; e164: string; friendlyName: string | null }>;
  }>('/app/telephony/numbers');
  const [draft, setDraft] = useState<AgentDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testOpen, setTestOpen] = useState(false);
  const { busy, run } = useAction();

  useEffect(() => {
    if (data) setDraft(Object.fromEntries(EDITABLE.map((k) => [k, data.agent[k]])) as AgentDraft);
  }, [data]);

  if (!data || !draft) return <Loading />;
  const { agent, readiness } = data;
  const blocking = readiness.filter((r) => !r.ok && r.blocking);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/app/agents/${id}`, { method: 'PATCH', body: draft });
      toast('Agent saved');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save');
    }
  }

  const setStatus = (status: 'ACTIVE' | 'PAUSED') =>
    run(
      async () => {
        await api(`/app/agents/${id}`, { method: 'PATCH', body: { ...draft, status } });
        await reload();
      },
      status === 'ACTIVE' ? 'Agent is live' : 'Agent paused',
    );

  const remove = () =>
    run(async () => {
      if (!window.confirm(`Delete ${agent.name}? Call history is kept.`)) return;
      await api(`/app/agents/${id}`, { method: 'DELETE' });
      await reloadWorkspace();
      router.push('/dashboard/agents');
    });

  return (
    <>
      <form onSubmit={save}>
        <PageHeader
          title={agent.name}
          back={{ href: '/dashboard/agents', label: 'Agents' }}
          description={
            <span className="inline-flex items-center gap-2">
              <StatusBadge status={agent.status} />
              {agent.inboundNumbers.length > 0 && (
                <span>Answers {agent.inboundNumbers.map((n) => n.e164).join(', ')}</span>
              )}
            </span>
          }
          actions={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setTestOpen(true)}
                disabled={!numbers.data?.numbers.length}
              >
                <PhoneOutgoing size={16} aria-hidden="true" /> Test call
              </button>
              {agent.status === 'ACTIVE' ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => setStatus('PAUSED')}
                >
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-brand"
                  disabled={busy || blocking.length > 0}
                  onClick={() => setStatus('ACTIVE')}
                >
                  Activate
                </button>
              )}
            </>
          }
        />

        <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            <AgentForm value={draft} onChange={setDraft} />
            <div className="sticky bottom-4 mt-6 flex flex-col gap-3 rounded-lg bg-white/90 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              {error ? (
                <ErrorNote message={error} />
              ) : (
                <span className="px-2 text-sm text-muted">Changes apply to the next call.</span>
              )}
              <button className="btn btn-primary">Save changes</button>
            </div>
          </div>

          <aside className="space-y-6">
            <Section title="Ready to go live?">
              <ul className="space-y-3">
                {readiness.map((r) => (
                  <li key={r.key} className="flex items-start gap-2.5 text-sm">
                    {r.ok ? (
                      <CheckCircle2
                        size={18}
                        className="mt-0.5 shrink-0 text-success"
                        aria-label="Done"
                      />
                    ) : (
                      <Circle
                        size={18}
                        className={`mt-0.5 shrink-0 ${r.blocking ? 'text-danger' : 'text-subtle'}`}
                        aria-label="To do"
                      />
                    )}
                    <span className={r.ok ? 'text-muted line-through' : 'text-ink'}>
                      {r.label}
                      {!r.ok && r.blocking && (
                        <span className="ml-1 text-xs text-danger">(required)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs text-muted">
                Connect numbers under{' '}
                <Link href="/dashboard/numbers" className="font-semibold text-brand-700">
                  Phone numbers
                </Link>
                . Our team sets up the AI voice for you.
              </p>
            </Section>

            <Section title="Outcomes so far">
              {data.outcomes.length === 0 ? (
                <p className="text-sm text-muted">No calls yet.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.outcomes.map((o) => (
                    <li key={o.outcome ?? 'none'} className="flex justify-between">
                      <span className="text-ink-soft">
                        {o.outcome ? humanize(o.outcome) : 'No outcome'}
                      </span>
                      <span className="num font-semibold">{o._count._all}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <button
              type="button"
              onClick={remove}
              className="btn btn-ghost w-full text-danger hover:bg-danger/5"
              disabled={busy}
            >
              <Trash2 size={16} aria-hidden="true" /> Delete agent
            </button>
          </aside>
        </div>
      </form>
      <TestCallModal
        open={testOpen}
        onClose={() => setTestOpen(false)}
        agentId={id}
        numbers={numbers.data?.numbers ?? []}
      />
    </>
  );
}

function TestCallModal({
  open,
  onClose,
  agentId,
  numbers,
}: {
  open: boolean;
  onClose: () => void;
  agentId: string;
  numbers: Array<{ id: string; e164: string; friendlyName: string | null }>;
}) {
  const [to, setTo] = useState('');
  const [numberId, setNumberId] = useState(numbers[0]?.id ?? '');
  const { busy, run } = useAction();
  useEffect(() => setNumberId((v) => v || numbers[0]?.id || ''), [numbers]);

  return (
    <Modal open={open} onClose={onClose} title="Call me with this agent">
      <div className="space-y-5">
        <p className="text-sm text-muted">
          We&apos;ll ring your phone and the agent will run its opening exactly as it would on a
          real call.
        </p>
        <Field id="test-from" label="Call from">
          <select
            id="test-from"
            className="select"
            value={numberId}
            onChange={(e) => setNumberId(e.target.value)}
          >
            {numbers.map((n) => (
              <option key={n.id} value={n.id}>
                {n.friendlyName ? `${n.friendlyName} · ` : ''}
                {n.e164}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="test-to"
          label="Your phone number"
          help="International format, e.g. +14155550123"
        >
          <input
            id="test-to"
            type="tel"
            className="input"
            value={to}
            onChange={(e) => setTo(e.target.value.trim())}
            placeholder="+1…"
          />
        </Field>
        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={busy || !to || !numberId}
          onClick={() =>
            run(async () => {
              await api(`/app/agents/${agentId}/test-call`, {
                body: { to, phoneNumberId: numberId },
              });
              onClose();
            }, 'Calling you now…')
          }
        >
          {busy ? 'Dialling…' : 'Call me'}
        </button>
      </div>
    </Modal>
  );
}
