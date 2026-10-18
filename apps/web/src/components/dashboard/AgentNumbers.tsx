'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Section, StatusBadge, toast, useAction } from '@/components/ui';

export interface WorkspaceNumber {
  id: string;
  e164: string;
  friendlyName: string | null;
  inboundAgent: { id: string; name: string } | null;
}

export interface AgentCampaign {
  id: string;
  name: string;
  status: string;
  phoneNumberId: string;
}

/**
 * The agent's phone numbers, changed from its own settings: which numbers it
 * answers, and which number each of its unfinished campaigns calls from.
 * Rendered inside the agent page's form, so it uses plain buttons, not a form.
 */
export function AgentNumbers({
  agentId,
  agentName,
  numbers,
  campaigns,
  onChanged,
}: {
  agentId: string;
  agentName: string;
  numbers: WorkspaceNumber[];
  campaigns: AgentCampaign[];
  onChanged: () => Promise<void>;
}) {
  const current = numbers.filter((n) => n.inboundAgent?.id === agentId).map((n) => n.id);
  const [picked, setPicked] = useState<string[]>(current);
  const { busy, run } = useAction();
  const key = current.join(',');
  useEffect(() => setPicked(current), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = picked.slice().sort().join(',') !== current.slice().sort().join(',');
  const label = (n: Pick<WorkspaceNumber, 'e164' | 'friendlyName'>) =>
    n.friendlyName ? `${n.friendlyName} · ${n.e164}` : n.e164;

  async function save(move = false): Promise<void> {
    try {
      await api(`/app/agents/${agentId}/numbers`, {
        method: 'PUT',
        body: { phoneNumberIds: picked, move },
      });
      await onChanged();
      toast('Numbers updated');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'number_taken' && !move) {
        if (window.confirm(err.message)) return save(true);
        return;
      }
      throw err;
    }
  }

  if (!numbers.length) {
    return (
      <Section title="Phone numbers">
        <p className="text-sm text-muted">
          No numbers yet.{' '}
          <Link href="/dashboard/numbers" className="font-semibold text-brand-700">
            Connect a number
          </Link>{' '}
          and this agent can answer it and call from it.
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="Phone numbers"
      description={`Numbers ${agentName || 'this agent'} answers. Each number answers through one agent.`}
    >
      <fieldset className="space-y-2.5">
        <legend className="sr-only">Numbers this agent answers</legend>
        {numbers.map((n) => {
          const other = n.inboundAgent && n.inboundAgent.id !== agentId ? n.inboundAgent : null;
          return (
            <label key={n.id} className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                className="checkbox mt-0.5"
                checked={picked.includes(n.id)}
                onChange={(e) =>
                  setPicked((cur) =>
                    e.target.checked ? [...cur, n.id] : cur.filter((id) => id !== n.id),
                  )
                }
              />
              <span>
                <span className="num font-semibold">{label(n)}</span>
                {other && (
                  <span className="block text-xs text-muted">Now answers for {other.name}</span>
                )}
              </span>
            </label>
          );
        })}
      </fieldset>
      <button
        type="button"
        className="btn btn-secondary btn-sm mt-4 w-full"
        disabled={busy || !dirty}
        onClick={() => run(() => save())}
      >
        Save numbers
      </button>

      {campaigns.length > 0 && numbers.length > 1 && (
        <div className="mt-6 border-t border-line pt-5">
          <p className="text-sm font-semibold">Campaigns call from</p>
          <ul className="mt-3 space-y-3">
            {campaigns.map((c) => (
              <li key={c.id}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <Link
                    href={`/dashboard/campaigns/${c.id}`}
                    className="truncate font-semibold text-ink-soft hover:text-ink"
                  >
                    {c.name}
                  </Link>
                  <StatusBadge status={c.status} />
                </div>
                <select
                  className="select h-9 text-sm"
                  aria-label={`Caller number for ${c.name}`}
                  value={c.phoneNumberId}
                  disabled={busy}
                  onChange={(e) => {
                    const phoneNumberId = e.target.value;
                    void run(async () => {
                      await api(`/app/campaigns/${c.id}`, {
                        method: 'PATCH',
                        body: { phoneNumberId },
                      });
                      await onChanged();
                    }, 'Caller number changed');
                  }}
                >
                  {numbers.map((n) => (
                    <option key={n.id} value={n.id}>
                      {label(n)}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}
