'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { RERUN_TARGETS, RERUN_TARGET_INFO, type RerunTarget } from '@pv/shared';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { ErrorNote, Loading, Modal, Section, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface EditableCampaign {
  id: string;
  name: string;
  status: string;
  goal: string;
  timezone: string;
  callWindowStart: string;
  callWindowEnd: string;
  callDays: number[];
  maxAttempts: number;
  retryDelayMinutes: number;
  agent: { id: string };
  phoneNumber: { id: string };
}

/** Edit everything about a campaign: name, goal, agent, number, schedule and retries. */
export function EditCampaignModal({
  campaign,
  onClose,
  onSaved,
}: {
  campaign: EditableCampaign;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const agents = useApi<{ agents: Array<{ id: string; name: string; status: string }> }>(
    '/app/agents',
  );
  const numbers = useApi<{
    numbers: Array<{ id: string; e164: string; friendlyName: string | null }>;
  }>('/app/telephony/numbers');
  const [days, setDays] = useState(campaign.callDays);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useAction();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    const ok = await run(async () => {
      try {
        await api(`/app/campaigns/${campaign.id}`, {
          method: 'PATCH',
          body: {
            name: f.get('name'),
            goal: f.get('goal') || '',
            agentId: f.get('agentId'),
            phoneNumberId: f.get('phoneNumberId'),
            timezone: f.get('timezone'),
            callWindowStart: f.get('start'),
            callWindowEnd: f.get('end'),
            callDays: days,
            maxAttempts: Number(f.get('maxAttempts')),
            retryDelayMinutes: Math.round(Number(f.get('retryHours')) * 60),
          },
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Could not save the campaign');
        throw err;
      }
      await onSaved();
      return true;
    }, 'Campaign updated');
    if (ok) onClose();
  }

  return (
    <Modal open onClose={onClose} title="Edit campaign" size="lg">
      {!agents.data || !numbers.data ? (
        <Loading />
      ) : (
        <form onSubmit={submit} className="grid gap-5 sm:grid-cols-2">
          <Field id="ec-name" label="Campaign name" className="sm:col-span-2">
            <input
              id="ec-name"
              name="name"
              className="input"
              required
              minLength={2}
              maxLength={120}
              defaultValue={campaign.name}
            />
          </Field>
          <Field id="ec-agent" label="Agent">
            <select
              id="ec-agent"
              name="agentId"
              className="select"
              defaultValue={campaign.agent.id}
            >
              {agents.data.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.status !== 'ACTIVE' ? ' (not active yet)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field id="ec-number" label="Call from">
            <select
              id="ec-number"
              name="phoneNumberId"
              className="select"
              defaultValue={campaign.phoneNumber.id}
            >
              {numbers.data.numbers.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.friendlyName ? `${n.friendlyName} · ` : ''}
                  {n.e164}
                </option>
              ))}
            </select>
          </Field>
          <Field
            id="ec-goal"
            label="Campaign goal"
            help="Added to the agent's instructions for these calls."
            optional
            className="sm:col-span-2"
          >
            <textarea
              id="ec-goal"
              name="goal"
              className="textarea min-h-[80px]"
              maxLength={1000}
              defaultValue={campaign.goal}
            />
          </Field>
          <fieldset className="sm:col-span-2">
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
          <Field id="ec-start" label="From">
            <input
              id="ec-start"
              name="start"
              type="time"
              className="input"
              required
              defaultValue={campaign.callWindowStart}
            />
          </Field>
          <Field id="ec-end" label="Until">
            <input
              id="ec-end"
              name="end"
              type="time"
              className="input"
              required
              defaultValue={campaign.callWindowEnd}
            />
          </Field>
          <Field id="ec-tz" label="Time zone">
            <input
              id="ec-tz"
              name="timezone"
              className="input"
              required
              defaultValue={campaign.timezone}
            />
          </Field>
          <Field id="ec-attempts" label="Attempts per contact">
            <select
              id="ec-attempts"
              name="maxAttempts"
              className="select"
              defaultValue={String(campaign.maxAttempts)}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Field>
          <Field id="ec-retry" label="Retry after (hours)">
            <input
              id="ec-retry"
              name="retryHours"
              type="number"
              min={1}
              max={168}
              step="any"
              className="input"
              defaultValue={Math.round((campaign.retryDelayMinutes / 60) * 100) / 100}
            />
          </Field>
          {error && (
            <div className="sm:col-span-2">
              <ErrorNote message={error} />
            </div>
          )}
          <div className="flex justify-end gap-3 sm:col-span-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" disabled={busy || !days.length}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Once a campaign has finished: start a new batch of calls to the people whose calls went a certain way. */
export function RerunPanel({
  campaign,
  onStarted,
}: {
  campaign: Pick<EditableCampaign, 'id' | 'maxAttempts'>;
  onStarted: () => Promise<void>;
}) {
  const preview = useApi<{ counts: Partial<Record<RerunTarget, number>> }>(
    `/app/campaigns/${campaign.id}/rerun/preview`,
  );
  const [picked, setPicked] = useState<RerunTarget[]>([]);
  const [attempts, setAttempts] = useState(String(campaign.maxAttempts));
  const { busy, run } = useAction();
  const counts = preview.data?.counts ?? {};
  const selected = picked.reduce((n, t) => n + (counts[t] ?? 0), 0);

  return (
    <Section
      className="mb-6"
      title="Run again"
      description="Start a new batch of calls in this campaign. Pick who to call again, based on how their last call went. Do-not-call contacts are never included."
    >
      {!preview.data ? (
        <Loading />
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {RERUN_TARGETS.map((t) => {
              const n = counts[t] ?? 0;
              return (
                <button
                  key={t}
                  type="button"
                  className="chip"
                  disabled={n === 0}
                  aria-pressed={picked.includes(t)}
                  title={RERUN_TARGET_INFO[t].description}
                  onClick={() =>
                    setPicked((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))
                  }
                >
                  {RERUN_TARGET_INFO[t].label} ({n})
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap items-end gap-4">
            <Field id="rerun-attempts" label="Attempts per contact">
              <select
                id="rerun-attempts"
                className="select w-32"
                value={attempts}
                onChange={(e) => setAttempts(e.target.value)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </Field>
            <button
              className="btn btn-brand"
              disabled={busy || selected === 0}
              onClick={() =>
                void run(async () => {
                  await api(`/app/campaigns/${campaign.id}/rerun`, {
                    method: 'POST',
                    body: { targets: picked, maxAttempts: Number(attempts) },
                  });
                  await onStarted();
                }, 'New batch started')
              }
            >
              <RefreshCw size={16} aria-hidden="true" /> Call {selected}{' '}
              {selected === 1 ? 'person' : 'people'} again
            </button>
          </div>
        </>
      )}
    </Section>
  );
}
