'use client';

import Link from 'next/link';
import { Bot, Plus } from 'lucide-react';
import { languageLabel } from '@pv/shared';
import { useApi } from '@/lib/use-api';
import { useWorkspace } from '@/lib/workspace';
import { EmptyState, Loading, PageHeader, StatusBadge } from '@/components/ui';
import { formatNumber } from '@/lib/format';

interface AgentRow {
  id: string;
  name: string;
  status: string;
  language: string;
  _count: { calls: number; campaigns: number };
  inboundNumbers: Array<{ id: string; e164: string }>;
}

export default function AgentsPage() {
  const { entitlements, usage } = useWorkspace();
  const { data } = useApi<{ agents: AgentRow[] }>('/app/agents');
  const limit = entitlements.limits.agents;
  const atLimit = limit !== null && usage.agents >= limit;

  const newButton = entitlements.active ? (
    atLimit ? (
      <Link href="/dashboard/billing?plan=PRO" className="btn btn-brand">
        Upgrade for more agents
      </Link>
    ) : (
      <Link href="/dashboard/agents/new" className="btn btn-primary">
        <Plus size={16} aria-hidden="true" /> New agent
      </Link>
    )
  ) : (
    <Link href="/dashboard/billing" className="btn btn-primary">
      Choose a plan to create agents
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Agents"
        description={
          limit === null
            ? 'Your AI callers.'
            : `Your AI callers · ${usage.agents} of ${limit} on your plan.`
        }
        actions={newButton}
      />
      {!data ? (
        <Loading />
      ) : data.agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="No agents yet"
          body="An agent is the voice on your calls: its persona, what it sells and what it can do."
          action={newButton}
        />
      ) : (
        <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.agents.map((a) => (
            <li key={a.id}>
              <Link
                href={`/dashboard/agents/${a.id}`}
                className="card card-pad block h-full transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-brand text-white">
                    <Bot size={20} aria-hidden="true" />
                  </span>
                  <StatusBadge status={a.status} />
                </div>
                <h2 className="mt-4 font-semibold">{a.name}</h2>
                <p className="mt-1 text-sm text-muted">{languageLabel(a.language)}</p>
                <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
                  <div>
                    <dt className="text-xs text-muted">Calls</dt>
                    <dd className="num font-semibold">{formatNumber(a._count.calls)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Campaigns</dt>
                    <dd className="num font-semibold">{a._count.campaigns}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted">Inbound</dt>
                    <dd className="num font-semibold">{a.inboundNumbers.length}</dd>
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
