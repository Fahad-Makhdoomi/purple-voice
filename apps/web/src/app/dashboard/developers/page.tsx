'use client';

import { useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { WEBHOOK_EVENTS, type WebhookEvent } from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useFeature } from '@/lib/workspace';
import {
  Loading,
  Modal,
  PageHeader,
  Section,
  StatusBadge,
  Tabs,
  toast,
  UpgradeGate,
  useAction,
} from '@/components/ui';
import { Field } from '@/components/forms/Field';
import { formatDateTime, formatRelative } from '@/lib/format';

type Tab = 'webhooks' | 'api' | 'automations';

function copy(text: string) {
  void navigator.clipboard.writeText(text).then(() => toast('Copied'));
}

function SecretOnce({
  secret,
  onClose,
  title,
}: {
  secret: string | null;
  onClose: () => void;
  title: string;
}) {
  return (
    <Modal open={!!secret} onClose={onClose} title={title}>
      <p className="text-sm text-muted">
        Copy it now — for your security it won&apos;t be shown again.
      </p>
      <div className="mt-4 flex gap-2">
        <code className="flex-1 break-all rounded-sm bg-night-2 px-3 py-2.5 font-mono text-xs text-white">
          {secret}
        </code>
        <button
          className="btn btn-secondary btn-icon"
          onClick={() => secret && copy(secret)}
          aria-label="Copy"
        >
          <Copy size={16} />
        </button>
      </div>
      <button className="btn btn-primary mt-6 w-full" onClick={onClose}>
        I&apos;ve saved it
      </button>
    </Modal>
  );
}

function Webhooks() {
  const { data, reload } = useApi<{
    endpoints: Array<{
      id: string;
      url: string;
      description: string | null;
      events: string[];
      active: boolean;
      createdAt: string;
    }>;
  }>('/app/developers/webhooks');
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<WebhookEvent[]>(['call.completed']);
  const [secret, setSecret] = useState<string | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<string | null>(null);
  const deliveries = useApi<{
    deliveries: Array<{
      id: string;
      event: string;
      status: string;
      attempts: number;
      responseStatus: number | null;
      lastError: string | null;
      createdAt: string;
    }>;
  }>(deliveriesFor ? `/app/developers/webhooks/${deliveriesFor}/deliveries` : null);
  const { busy, run } = useAction();
  if (!data) return <Loading />;

  return (
    <Section
      title="Webhook endpoints"
      description={
        <>
          We POST JSON events with an <code>X-PurpleVoice-Signature: t=…,v1=…</code> header —
          HMAC-SHA256 of <code>{'`${t}.${body}`'}</code> with your signing secret. Failed deliveries
          retry with backoff for ~24 hours.
        </>
      }
      actions={
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
          <Plus size={14} aria-hidden="true" /> Add endpoint
        </button>
      }
    >
      {data.endpoints.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No endpoints yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {data.endpoints.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 py-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm font-semibold">{e.url}</p>
                <p className="mt-1 text-xs text-muted">{e.events.join(', ')}</p>
              </div>
              <StatusBadge status={e.active ? 'ACTIVE' : 'PAUSED'} />
              <button className="btn btn-ghost btn-sm" onClick={() => setDeliveriesFor(e.id)}>
                Deliveries
              </button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() =>
                  run(
                    () => api(`/app/developers/webhooks/${e.id}/test`, { method: 'POST' }),
                    'Test event queued',
                  )
                }
              >
                Send test
              </button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api(`/app/developers/webhooks/${e.id}`, {
                      method: 'PATCH',
                      body: { active: !e.active },
                    });
                    await reload();
                  })
                }
              >
                {e.active ? 'Pause' : 'Resume'}
              </button>
              <button
                className="btn btn-ghost btn-icon h-9 w-9 text-danger"
                aria-label="Delete endpoint"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (!window.confirm('Delete this endpoint?')) return;
                    await api(`/app/developers/webhooks/${e.id}`, { method: 'DELETE' });
                    await reload();
                  }, 'Endpoint deleted')
                }
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Add webhook endpoint">
        <form
          className="space-y-5"
          onSubmit={async (ev) => {
            ev.preventDefault();
            const f = new FormData(ev.currentTarget);
            const r = await run(() =>
              api<{ secret: string }>('/app/developers/webhooks', {
                body: { url: f.get('url'), description: f.get('description') || undefined, events },
              }),
            );
            if (r) {
              setOpen(false);
              setSecret(r.secret);
              await reload();
            }
          }}
        >
          <Field id="url" label="Endpoint URL">
            <input
              id="url"
              name="url"
              type="url"
              className="input font-mono"
              required
              placeholder="https://example.com/purple-voice"
            />
          </Field>
          <fieldset>
            <legend className="label">Events</legend>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map((ev) => (
                <button
                  key={ev}
                  type="button"
                  className="chip font-mono"
                  aria-pressed={events.includes(ev)}
                  onClick={() =>
                    setEvents((cur) =>
                      cur.includes(ev) ? cur.filter((x) => x !== ev) : [...cur, ev],
                    )
                  }
                >
                  {ev}
                </button>
              ))}
            </div>
          </fieldset>
          <Field id="description" label="Description" optional>
            <input id="description" name="description" className="input" />
          </Field>
          <button className="btn btn-primary w-full" disabled={busy || !events.length}>
            Add endpoint
          </button>
        </form>
      </Modal>
      <SecretOnce secret={secret} onClose={() => setSecret(null)} title="Signing secret" />
      <Modal
        open={!!deliveriesFor}
        onClose={() => setDeliveriesFor(null)}
        title="Recent deliveries"
        size="lg"
      >
        {!deliveries.data ? (
          <Loading />
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Event</th>
                  <th scope="col">Status</th>
                  <th scope="col">Response</th>
                  <th scope="col">When</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.data.deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="font-mono text-xs">{d.event}</td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                    <td className="text-xs text-muted">
                      {d.responseStatus ?? d.lastError ?? '—'} · {d.attempts} attempt(s)
                    </td>
                    <td className="text-xs text-muted">{formatDateTime(d.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </Section>
  );
}

function ApiKeys() {
  const { data, reload } = useApi<{
    keys: Array<{
      id: string;
      name: string;
      prefix: string;
      lastUsedAt: string | null;
      createdAt: string;
    }>;
  }>('/app/developers/api-keys');
  const [secret, setSecret] = useState<string | null>(null);
  const { busy, run } = useAction();
  if (!data) return <Loading />;
  const base = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <Section
      title="API keys"
      description={
        <>
          Authenticate with <code>Authorization: Bearer pv_live_…</code>. Endpoints:{' '}
          <code>GET /api/v1/agents</code>, <code>GET /api/v1/calls</code>,{' '}
          <code>GET /api/v1/calls/:id</code>, <code>POST /api/v1/calls</code>,{' '}
          <code>GET /api/v1/campaigns</code>, <code>POST /api/v1/campaigns/:id/contacts</code>.
        </>
      }
      actions={
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const name = String(new FormData(form).get('name') ?? '');
            const r = await run(() =>
              api<{ key: string }>('/app/developers/api-keys', { body: { name } }),
            );
            if (r) {
              form.reset();
              setSecret(r.key);
              await reload();
            }
          }}
        >
          <label className="sr-only" htmlFor="key-name">
            Key name
          </label>
          <input
            id="key-name"
            name="name"
            className="input h-9 w-40"
            placeholder="Key name"
            required
            minLength={2}
          />
          <button className="btn btn-primary btn-sm" disabled={busy}>
            Create key
          </button>
        </form>
      }
    >
      {data.keys.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">No API keys yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {data.keys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 py-3">
              <div className="flex-1">
                <p className="font-semibold">{k.name}</p>
                <p className="font-mono text-xs text-muted">
                  {k.prefix}… · last used {formatRelative(k.lastUsedAt)}
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm text-danger"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    if (!window.confirm(`Revoke "${k.name}"? Apps using it will stop working.`))
                      return;
                    await api(`/app/developers/api-keys/${k.id}`, { method: 'DELETE' });
                    await reload();
                  }, 'Key revoked')
                }
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-muted">
        Example:{' '}
        <code className="break-all">
          curl -H &quot;Authorization: Bearer $KEY&quot; {base}/api/v1/calls
        </code>
      </p>
      <SecretOnce secret={secret} onClose={() => setSecret(null)} title="Your new API key" />
    </Section>
  );
}

const ACTION_LABELS = {
  webhook: 'POST to a URL',
  email: 'Send an email',
  slack: 'Post to Slack',
  mark_do_not_call: 'Mark contact do-not-call',
} as const;

function Automations() {
  const { data, reload } = useApi<{
    automations: Array<{
      id: string;
      name: string;
      trigger: string;
      active: boolean;
      runCount: number;
      lastRunAt: string | null;
      lastError: string | null;
      conditions: unknown[];
      actions: Array<{ type: string }>;
    }>;
  }>('/app/developers/automations');
  const integrations = useApi<{ integrations: Array<{ id: string; type: string }> }>(
    '/app/integrations',
  );
  const [open, setOpen] = useState(false);
  const [actionType, setActionType] = useState<keyof typeof ACTION_LABELS>('email');
  const { busy, run } = useAction();
  if (!data) return <Loading />;
  const slack = integrations.data?.integrations.find((i) => i.type === 'SLACK');

  return (
    <Section
      title="Automations"
      description="When an event happens and the conditions match, run an action."
      actions={
        <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
          <Plus size={14} aria-hidden="true" /> New automation
        </button>
      }
    >
      {data.automations.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          No automations yet. Try: when a call ends as “Interested”, email your sales lead.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {data.automations.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.name}</p>
                <p className="text-xs text-muted">
                  On <code>{a.trigger}</code> ·{' '}
                  {a.actions
                    .map((x) => ACTION_LABELS[x.type as keyof typeof ACTION_LABELS] ?? x.type)
                    .join(', ')}{' '}
                  · ran {a.runCount}×{a.lastError ? ` · last error: ${a.lastError}` : ''}
                </p>
              </div>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  run(async () => {
                    await api(`/app/developers/automations/${a.id}`, {
                      method: 'PATCH',
                      body: { active: !a.active },
                    });
                    await reload();
                  })
                }
              >
                {a.active ? 'Pause' : 'Resume'}
              </button>
              <button
                className="btn btn-ghost btn-icon h-9 w-9 text-danger"
                aria-label="Delete automation"
                onClick={() =>
                  run(async () => {
                    if (!window.confirm('Delete this automation?')) return;
                    await api(`/app/developers/automations/${a.id}`, { method: 'DELETE' });
                    await reload();
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New automation">
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const outcome = String(f.get('outcome') ?? '');
            const action =
              actionType === 'email'
                ? {
                    type: 'email',
                    to: f.get('to'),
                    subject: f.get('subject') || 'Purple Voice call update',
                  }
                : actionType === 'webhook'
                  ? { type: 'webhook', url: f.get('url') }
                  : actionType === 'slack'
                    ? { type: 'slack', integrationId: slack?.id }
                    : { type: 'mark_do_not_call' };
            const ok = await run(async () => {
              await api('/app/developers/automations', {
                body: {
                  name: f.get('name'),
                  trigger: f.get('trigger'),
                  conditions: outcome ? [{ field: 'outcome', op: 'eq', value: outcome }] : [],
                  actions: [action],
                },
              });
              return true;
            }, 'Automation created');
            if (ok) {
              setOpen(false);
              await reload();
            }
          }}
        >
          <Field id="a-name" label="Name">
            <input
              id="a-name"
              name="name"
              className="input"
              required
              minLength={2}
              placeholder="Email hot leads to sales"
            />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="trigger" label="When">
              <select id="trigger" name="trigger" className="select" defaultValue="call.completed">
                {WEBHOOK_EVENTS.map((ev) => (
                  <option key={ev}>{ev}</option>
                ))}
              </select>
            </Field>
            <Field id="outcome" label="And the outcome is" optional>
              <select id="outcome" name="outcome" className="select" defaultValue="">
                <option value="">Any</option>
                {[
                  'INTERESTED',
                  'APPOINTMENT_BOOKED',
                  'CALLBACK_REQUESTED',
                  'NOT_INTERESTED',
                  'DO_NOT_CALL',
                  'VOICEMAIL',
                ].map((o) => (
                  <option key={o} value={o}>
                    {o.charAt(0) + o.slice(1).toLowerCase().replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <fieldset>
            <legend className="label">Then</legend>
            <Tabs
              value={actionType}
              onChange={setActionType}
              options={(Object.keys(ACTION_LABELS) as Array<keyof typeof ACTION_LABELS>)
                .filter((k) => k !== 'slack' || slack)
                .map((k) => ({ value: k, label: ACTION_LABELS[k] }))}
            />
          </fieldset>
          {actionType === 'email' && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="to" label="Email to">
                <input id="to" name="to" type="email" className="input" required />
              </Field>
              <Field id="subject" label="Subject" optional>
                <input id="subject" name="subject" className="input" />
              </Field>
            </div>
          )}
          {actionType === 'webhook' && (
            <Field id="a-url" label="URL">
              <input id="a-url" name="url" type="url" className="input font-mono" required />
            </Field>
          )}
          <button className="btn btn-primary w-full" disabled={busy}>
            Create automation
          </button>
        </form>
      </Modal>
    </Section>
  );
}

export default function DevelopersPage() {
  const webhooks = useFeature('webhooks');
  const [tab, setTab] = useState<Tab>('webhooks');
  if (!webhooks) {
    return (
      <>
        <PageHeader title="Developers" />
        <UpgradeGate
          feature="Webhooks, API and automations"
          body="Stream call events to your systems, place calls from your own code and automate what happens after every call."
        />
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Developers"
        description="Connect Purple Voice to your own systems."
        actions={
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'webhooks', label: 'Webhooks' },
              { value: 'api', label: 'API keys' },
              { value: 'automations', label: 'Automations' },
            ]}
          />
        }
      />
      {tab === 'webhooks' && <Webhooks />}
      {tab === 'api' && <ApiKeys />}
      {tab === 'automations' && <Automations />}
    </>
  );
}
