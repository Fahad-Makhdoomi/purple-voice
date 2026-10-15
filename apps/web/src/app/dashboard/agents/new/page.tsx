'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { AgentForm, EMPTY_AGENT } from '@/components/dashboard/AgentForm';
import { PageHeader, ErrorNote } from '@/components/ui';
import { useWorkspace } from '@/lib/workspace';

export default function NewAgentPage() {
  const router = useRouter();
  const { reload } = useWorkspace();
  const [draft, setDraft] = useState(EMPTY_AGENT);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { agent } = await api<{ agent: { id: string } }>('/app/agents', { body: draft });
      await reload();
      router.push(`/dashboard/agents/${agent.id}?created=1`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the agent');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-4xl">
      <PageHeader
        title="New agent"
        description="Describe who the agent is and what it should achieve. You can test it before it goes live."
        back={{ href: '/dashboard/agents', label: 'Agents' }}
      />
      <AgentForm value={draft} onChange={setDraft} />
      <div className="sticky bottom-4 mt-6 flex flex-col gap-3 rounded-lg bg-white/90 p-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        {error ? (
          <ErrorNote message={error} />
        ) : (
          <p className="px-2 text-sm text-muted">
            Saved as a draft. Activate it when it&apos;s ready.
          </p>
        )}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Creating…' : 'Create agent'}
        </button>
      </div>
    </form>
  );
}
