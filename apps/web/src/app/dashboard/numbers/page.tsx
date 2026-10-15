'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Phone, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { TELEPHONY_PROVIDER_LABELS, type TelephonyProvider } from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useWorkspace } from '@/lib/workspace';
import { EmptyState, Loading, Modal, PageHeader, Section, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';

interface Account {
  id: string;
  provider: TelephonyProvider;
  label: string | null;
  publicId: string;
  numberCount: number;
}
interface NumberRow {
  id: string;
  e164: string;
  friendlyName: string | null;
  routingConfigured: boolean;
  routingError: string | null;
  inboundAgentId: string | null;
  telephonyAccount: { provider: TelephonyProvider; label: string | null };
}

export default function NumbersPage() {
  const { entitlements, usage, reload: reloadWs } = useWorkspace();
  const accounts = useApi<{ accounts: Account[] }>('/app/telephony/accounts');
  const numbers = useApi<{ numbers: NumberRow[] }>('/app/telephony/numbers');
  const agents = useApi<{ agents: Array<{ id: string; name: string }> }>('/app/agents');
  const [accountOpen, setAccountOpen] = useState(false);
  const [numberOpen, setNumberOpen] = useState(false);
  const { busy, run } = useAction();

  const refresh = async () => {
    await Promise.all([accounts.reload(), numbers.reload(), reloadWs()]);
  };
  const limit = entitlements.limits.phoneNumbers;
  const atLimit = limit !== null && usage.phoneNumbers >= limit;

  if (!accounts.data || !numbers.data) return <Loading />;

  return (
    <>
      <PageHeader
        title="Phone numbers"
        description="Connect your carrier account, then choose which numbers Purple Voice answers and calls from. Number rental stays on your carrier bill."
        actions={
          entitlements.active ? (
            <>
              <button className="btn btn-secondary" onClick={() => setAccountOpen(true)}>
                Connect carrier
              </button>
              {atLimit ? (
                <Link href="/dashboard/billing?plan=PRO" className="btn btn-brand">
                  Upgrade for more numbers
                </Link>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => setNumberOpen(true)}
                  disabled={!accounts.data.accounts.length}
                >
                  <Plus size={16} aria-hidden="true" /> Add number
                </button>
              )}
            </>
          ) : (
            <Link href="/dashboard/billing" className="btn btn-primary">
              Choose a plan to connect numbers
            </Link>
          )
        }
      />

      <div className="space-y-6">
        <Section
          title="Numbers"
          description={
            limit === null ? undefined : `${usage.phoneNumbers} of ${limit} numbers on your plan`
          }
        >
          {numbers.data.numbers.length === 0 ? (
            <EmptyState
              icon={Phone}
              title="No numbers yet"
              body={
                accounts.data.accounts.length
                  ? 'Add a number from your carrier account.'
                  : 'Connect a Twilio or Plivo account first.'
              }
            />
          ) : (
            <div className="-mx-5 overflow-x-auto sm:-mx-6">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Number</th>
                    <th scope="col">Carrier</th>
                    <th scope="col">Answers with</th>
                    <th scope="col">Routing</th>
                    <th scope="col">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {numbers.data.numbers.map((n) => (
                    <tr key={n.id}>
                      <td>
                        <p className="num font-semibold">{n.e164}</p>
                        {n.friendlyName && <p className="text-xs text-muted">{n.friendlyName}</p>}
                      </td>
                      <td className="text-ink-soft">
                        {TELEPHONY_PROVIDER_LABELS[n.telephonyAccount.provider]}
                      </td>
                      <td>
                        <label className="sr-only" htmlFor={`agent-${n.id}`}>
                          Inbound agent for {n.e164}
                        </label>
                        <select
                          id={`agent-${n.id}`}
                          className="select h-9 min-w-[180px]"
                          value={n.inboundAgentId ?? ''}
                          onChange={(e) =>
                            run(async () => {
                              await api(`/app/telephony/numbers/${n.id}`, {
                                method: 'PATCH',
                                body: { inboundAgentId: e.target.value || null },
                              });
                              await numbers.reload();
                            }, 'Inbound agent updated')
                          }
                        >
                          <option value="">Nobody (outbound only)</option>
                          {agents.data?.agents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        {n.routingConfigured ? (
                          <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                            <CheckCircle2 size={16} aria-hidden="true" /> Connected
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-warning"
                            title={n.routingError ?? undefined}
                          >
                            <AlertTriangle size={16} aria-hidden="true" />{' '}
                            {n.routingError ? 'Needs attention' : 'Not routed'}
                          </span>
                        )}
                        {n.routingError && (
                          <p className="mt-1 max-w-xs text-xs text-muted">{n.routingError}</p>
                        )}
                      </td>
                      <td className="whitespace-nowrap text-right">
                        <button
                          className="btn btn-ghost btn-icon"
                          aria-label={`Re-sync ${n.e164}`}
                          title="Re-apply routing on the carrier"
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              await api(`/app/telephony/numbers/${n.id}/resync`, {
                                method: 'POST',
                              });
                              await numbers.reload();
                            }, 'Routing re-applied')
                          }
                        >
                          <RefreshCw size={16} />
                        </button>
                        <button
                          className="btn btn-ghost btn-icon text-danger"
                          aria-label={`Remove ${n.e164}`}
                          disabled={busy}
                          onClick={() =>
                            run(async () => {
                              if (
                                !window.confirm(
                                  `Disconnect ${n.e164} from Purple Voice? It stays on your carrier account.`,
                                )
                              )
                                return;
                              await api(`/app/telephony/numbers/${n.id}`, { method: 'DELETE' });
                              await refresh();
                            }, 'Number disconnected')
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section
          title="Carrier accounts"
          description="Credentials are encrypted and only used to route and place your calls."
        >
          {accounts.data.accounts.length === 0 ? (
            <p className="text-sm text-muted">No carrier connected yet.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {accounts.data.accounts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line p-4"
                >
                  <div>
                    <p className="font-semibold">
                      {TELEPHONY_PROVIDER_LABELS[a.provider]}
                      {a.label ? ` · ${a.label}` : ''}
                    </p>
                    <p className="num text-xs text-muted">
                      {a.publicId} · {a.numberCount} number{a.numberCount === 1 ? '' : 's'}
                    </p>
                    {a.provider === 'SUPERPHONE' && (
                      <p className="mt-1 text-xs text-warning">
                        AI calling on SuperPhone is coming soon — forward to a Twilio or Plivo
                        number meanwhile.
                      </p>
                    )}
                  </div>
                  <button
                    className="btn btn-ghost btn-icon text-danger"
                    aria-label="Remove carrier account"
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        if (
                          !window.confirm('Remove this carrier account and disconnect its numbers?')
                        )
                          return;
                        await api(`/app/telephony/accounts/${a.id}`, { method: 'DELETE' });
                        await refresh();
                      }, 'Carrier removed')
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <ConnectCarrierModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        onDone={refresh}
      />
      <AddNumberModal
        open={numberOpen}
        onClose={() => setNumberOpen(false)}
        onDone={refresh}
        accounts={accounts.data.accounts}
        agents={agents.data?.agents ?? []}
      />
    </>
  );
}

function ConnectCarrierModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [provider, setProvider] = useState<TelephonyProvider>('TWILIO');
  const { busy, run } = useAction();

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body =
      provider === 'TWILIO'
        ? {
            provider,
            label: f.get('label') || undefined,
            accountSid: f.get('a'),
            authToken: f.get('b'),
          }
        : provider === 'PLIVO'
          ? {
              provider,
              label: f.get('label') || undefined,
              authId: f.get('a'),
              authToken: f.get('b'),
            }
          : {
              provider,
              label: f.get('label') || undefined,
              apiKey: f.get('a'),
              sipDomain: f.get('b') || undefined,
            };
    const ok = await run(async () => {
      await api('/app/telephony/accounts', { body });
      return true;
    }, 'Carrier connected');
    if (ok) {
      await onDone();
      onClose();
    }
  }

  const labels = {
    TWILIO: ['Account SID', 'Auth token', 'Find both on the Twilio Console home page.'],
    PLIVO: ['Auth ID', 'Auth token', 'Find both on the Plivo console overview.'],
    SUPERPHONE: [
      'API key',
      'SIP domain (optional)',
      'Saved for when SuperPhone AI calling is available.',
    ],
  }[provider];

  return (
    <Modal open={open} onClose={onClose} title="Connect a carrier">
      <form onSubmit={submit} className="space-y-5">
        <div className="flex gap-2" role="group" aria-label="Carrier">
          {(['TWILIO', 'PLIVO', 'SUPERPHONE'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className="chip"
              aria-pressed={provider === p}
              onClick={() => setProvider(p)}
            >
              {TELEPHONY_PROVIDER_LABELS[p]}
            </button>
          ))}
        </div>
        <Field id="a" label={labels[0]} help={labels[2]}>
          <input id="a" name="a" className="input font-mono" required autoComplete="off" />
        </Field>
        <Field id="b" label={labels[1]}>
          <input
            id="b"
            name="b"
            type={provider === 'SUPERPHONE' ? 'text' : 'password'}
            className="input font-mono"
            required={provider !== 'SUPERPHONE'}
            autoComplete="off"
          />
        </Field>
        <Field id="label" label="Label" optional>
          <input id="label" name="label" className="input" placeholder="Main sales line" />
        </Field>
        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? 'Checking credentials…' : 'Connect'}
        </button>
      </form>
    </Modal>
  );
}

function AddNumberModal({
  open,
  onClose,
  onDone,
  accounts,
  agents,
}: {
  open: boolean;
  onClose: () => void;
  onDone: () => Promise<void>;
  accounts: Account[];
  agents: Array<{ id: string; name: string }>;
}) {
  const [accountId, setAccountId] = useState('');
  const [available, setAvailable] = useState<Array<{
    id: string;
    e164: string;
    friendlyName?: string;
    connected: boolean;
  }> | null>(null);
  const [e164, setE164] = useState('');
  const [providerNumberId, setProviderNumberId] = useState<string | undefined>();
  const [agentId, setAgentId] = useState('');
  const { busy, run } = useAction();

  useEffect(() => {
    if (open && !accountId && accounts[0]) setAccountId(accounts[0].id);
  }, [open, accountId, accounts]);

  useEffect(() => {
    if (!open || !accountId) return;
    setAvailable(null);
    api<{
      numbers: Array<{ id: string; e164: string; friendlyName?: string; connected: boolean }>;
    }>(`/app/telephony/accounts/${accountId}/available-numbers`)
      .then((r) => setAvailable(r.numbers))
      .catch(() => setAvailable([]));
  }, [open, accountId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await run(async () => {
      await api('/app/telephony/numbers', {
        body: {
          telephonyAccountId: accountId,
          e164,
          providerNumberId,
          inboundAgentId: agentId || null,
        },
      });
      return true;
    }, 'Number connected');
    if (ok) {
      await onDone();
      onClose();
      setE164('');
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a phone number">
      <form onSubmit={submit} className="space-y-5">
        <Field id="account" label="Carrier account">
          <select
            id="account"
            className="select"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {TELEPHONY_PROVIDER_LABELS[a.provider]} · {a.label ?? a.publicId}
              </option>
            ))}
          </select>
        </Field>
        {available && available.length > 0 && (
          <fieldset>
            <legend className="label">Numbers on this account</legend>
            <ul className="max-h-48 space-y-1.5 overflow-y-auto">
              {available.map((n) => (
                <li key={n.id}>
                  <label
                    className={`flex items-center gap-3 rounded-sm border px-3 py-2 text-sm ${e164 === n.e164 ? 'border-ink' : 'border-line'} ${n.connected ? 'opacity-50' : ''}`}
                  >
                    <input
                      type="radio"
                      name="pick"
                      disabled={n.connected}
                      checked={e164 === n.e164}
                      onChange={() => {
                        setE164(n.e164);
                        setProviderNumberId(n.id);
                      }}
                    />
                    <span className="num font-semibold">{n.e164}</span>
                    <span className="text-muted">
                      {n.connected ? 'already connected' : n.friendlyName}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}
        <Field id="e164" label="Phone number" help="International format, e.g. +14155550123">
          <input
            id="e164"
            className="input num"
            required
            value={e164}
            onChange={(e) => {
              setE164(e.target.value.trim());
              setProviderNumberId(undefined);
            }}
          />
        </Field>
        <Field id="agent" label="Answer incoming calls with" optional>
          <select
            id="agent"
            className="select"
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
          >
            <option value="">Nobody (outbound only)</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <button className="btn btn-primary w-full" disabled={busy || !e164}>
          {busy ? 'Connecting…' : 'Connect number'}
        </button>
      </form>
    </Modal>
  );
}
