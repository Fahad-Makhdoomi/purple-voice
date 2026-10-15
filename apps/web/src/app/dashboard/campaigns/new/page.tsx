'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useWorkspace } from '@/lib/workspace';
import { ErrorNote, Loading, PageHeader } from '@/components/ui';
import { Field } from '@/components/forms/Field';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function NewCampaignPage() {
  const router = useRouter();
  const { entitlements, reload } = useWorkspace();
  const agents = useApi<{ agents: Array<{ id: string; name: string; status: string }> }>(
    '/app/agents',
  );
  const numbers = useApi<{
    numbers: Array<{ id: string; e164: string; friendlyName: string | null }>;
  }>('/app/telephony/numbers');
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!agents.data || !numbers.data) return <Loading />;
  if (!agents.data.agents.length || !numbers.data.numbers.length) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader
          title="New campaign"
          back={{ href: '/dashboard/campaigns', label: 'Campaigns' }}
        />
        <div className="card card-pad">
          <p className="text-ink-soft">
            A campaign needs an agent and a phone number to call from.
          </p>
          <div className="mt-5 flex gap-3">
            {!agents.data.agents.length && (
              <Link href="/dashboard/agents/new" className="btn btn-primary">
                Create an agent
              </Link>
            )}
            {!numbers.data.numbers.length && (
              <Link href="/dashboard/numbers" className="btn btn-secondary">
                Connect a number
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      const { campaign } = await api<{ campaign: { id: string } }>('/app/campaigns', {
        body: {
          name: f.get('name'),
          agentId: f.get('agentId'),
          phoneNumberId: f.get('phoneNumberId'),
          goal: f.get('goal') || '',
          timezone: f.get('timezone'),
          callWindowStart: f.get('start'),
          callWindowEnd: f.get('end'),
          callDays: days,
          maxAttempts: Number(f.get('maxAttempts')),
          retryDelayMinutes: Number(f.get('retryHours')) * 60,
          concurrency: Number(f.get('concurrency')),
        },
      });
      await reload();
      router.push(`/dashboard/campaigns/${campaign.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the campaign');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="New campaign"
        description="You'll add contacts on the next screen."
        back={{ href: '/dashboard/campaigns', label: 'Campaigns' }}
      />
      <section className="card card-pad grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Campaign name" className="sm:col-span-2">
          <input
            id="name"
            name="name"
            className="input"
            required
            minLength={2}
            maxLength={120}
            placeholder="October solar follow-ups"
          />
        </Field>
        <Field id="agentId" label="Agent">
          <select id="agentId" name="agentId" className="select" required>
            {agents.data.agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.status !== 'ACTIVE' ? ' (not active yet)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field id="phoneNumberId" label="Call from">
          <select id="phoneNumberId" name="phoneNumberId" className="select" required>
            {numbers.data.numbers.map((n) => (
              <option key={n.id} value={n.id}>
                {n.friendlyName ? `${n.friendlyName} · ` : ''}
                {n.e164}
              </option>
            ))}
          </select>
        </Field>
        <Field
          id="goal"
          label="Campaign goal"
          help="Added to the agent's instructions for these calls."
          optional
          className="sm:col-span-2"
        >
          <textarea
            id="goal"
            name="goal"
            className="textarea min-h-[80px]"
            maxLength={1000}
            placeholder="Re-engage quotes from September and book site surveys."
          />
        </Field>
      </section>

      <section className="card card-pad space-y-5">
        <h2 className="font-semibold">When to call</h2>
        <fieldset>
          <legend className="label">Days</legend>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d, i) => (
              <button
                key={d}
                type="button"
                className="chip"
                aria-pressed={days.includes(i)}
                onClick={() =>
                  setDays((cur) =>
                    cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort(),
                  )
                }
              >
                {d}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-5 sm:grid-cols-3">
          <Field id="start" label="From">
            <input
              id="start"
              name="start"
              type="time"
              className="input"
              defaultValue="09:00"
              required
            />
          </Field>
          <Field id="end" label="Until">
            <input
              id="end"
              name="end"
              type="time"
              className="input"
              defaultValue="18:00"
              required
            />
          </Field>
          <Field id="timezone" label="Time zone">
            <input
              id="timezone"
              name="timezone"
              className="input"
              defaultValue={Intl.DateTimeFormat().resolvedOptions().timeZone}
              required
            />
          </Field>
          <Field id="maxAttempts" label="Attempts per contact">
            <select id="maxAttempts" name="maxAttempts" className="select" defaultValue="2">
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <Field id="retryHours" label="Retry after (hours)">
            <input
              id="retryHours"
              name="retryHours"
              type="number"
              min={1}
              max={168}
              defaultValue={4}
              className="input"
            />
          </Field>
          <Field
            id="concurrency"
            label="Calls at once"
            help={`Your plan allows up to ${entitlements.limits.concurrentCalls}.`}
          >
            <input
              id="concurrency"
              name="concurrency"
              type="number"
              min={1}
              max={entitlements.limits.concurrentCalls}
              defaultValue={1}
              className="input"
            />
          </Field>
        </div>
      </section>

      {error && <ErrorNote message={error} />}
      <div className="flex justify-end">
        <button className="btn btn-primary btn-lg" disabled={busy || !days.length}>
          {busy ? 'Creating…' : 'Create campaign'}
        </button>
      </div>
    </form>
  );
}
