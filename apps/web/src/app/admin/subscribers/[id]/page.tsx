'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import {
  LIMIT_LABELS,
  PAYMENT_GATEWAY_LABELS,
  type Entitlements,
  type LimitKey,
  type PaymentGateway,
  type UsageSnapshot,
} from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useSession } from '@/lib/session';
import { Loading, Meter, PageHeader, Section, StatusBadge, useAction } from '@/components/ui';
import { AiSettingsPanel } from '@/components/admin/AiSettingsPanel';
import { Field } from '@/components/forms/Field';
import { formatDate, formatDateTime, formatDuration, formatMoney, humanize } from '@/lib/format';

interface Detail {
  workspace: {
    id: string;
    name: string;
    notes: string;
    suspended: boolean;
    timezone: string;
    createdAt: string;
    users: Array<{
      id: string;
      name: string;
      email: string;
      role: string;
      lastLoginAt: string | null;
    }>;
  };
  subscription: {
    status: string;
    provider: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    customPriceCents: number | null;
    customMinutes: number | null;
    customLimits: Partial<Record<LimitKey, number | null>> | null;
    stripeCustomerId: string | null;
    plan: { code: string; name: string; priceMonthlyCents: number | null };
  } | null;
  entitlements: Entitlements;
  usage: UsageSnapshot;
  events: Array<{
    id: string;
    type: string;
    fromPlan: string | null;
    toPlan: string | null;
    mrrDeltaCents: number;
    note: string | null;
    occurredAt: string;
  }>;
  payments: Array<{ id: string; amountCents: number; paidAt: string | null }>;
  recentCalls: Array<{
    id: string;
    direction: string;
    status: string;
    toNumber: string;
    fromNumber: string;
    durationSec: number;
    outcome: string | null;
    createdAt: string;
  }>;
  auditLog: Array<{
    id: string;
    action: string;
    createdAt: string;
    actor: { name: string; role: string } | null;
  }>;
  telephony: Array<{ id: string; provider: string; label: string | null; publicId: string }>;
}

const OVERRIDABLE: LimitKey[] = [
  'agents',
  'phoneNumbers',
  'campaigns',
  'contactsPerCampaign',
  'integrations',
  'concurrentCalls',
];

export default function SubscriberPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { actAs } = useSession();
  const { data, reload } = useApi<Detail>(`/admin/subscribers/${id}`);
  const { busy, run } = useAction();
  const [notes, setNotes] = useState('');
  useEffect(() => setNotes(data?.workspace.notes ?? ''), [data]);

  if (!data) return <Loading />;
  const { workspace, subscription, entitlements, usage } = data;
  // Paid through a gateway: it owns plan and status (they sync back from it).
  const gateway =
    subscription && subscription.provider !== 'MANUAL'
      ? PAYMENT_GATEWAY_LABELS[subscription.provider as PaymentGateway]
      : null;
  const stripe = !!gateway;

  const openDashboard = () => {
    actAs({ id: workspace.id, name: workspace.name });
    router.push('/dashboard');
  };

  async function saveSubscription(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const num = (key: string) => {
      const v = String(f.get(key) ?? '').trim();
      return v === '' ? undefined : v === 'unlimited' ? null : Number(v);
    };
    const customLimits = Object.fromEntries(
      OVERRIDABLE.map((k) => [k, num(`limit_${k}`)]).filter(([, v]) => v !== undefined),
    );
    const body: Record<string, unknown> = {
      currentPeriodEnd: f.get('periodEnd')
        ? new Date(String(f.get('periodEnd'))).toISOString()
        : undefined,
      cancelAtPeriodEnd: f.get('cancelAtPeriodEnd') === 'on',
      customMinutes: num('customMinutes') ?? null,
      customPriceCents: f.get('customPrice')
        ? Math.round(Number(f.get('customPrice')) * 100)
        : null,
      customLimits: Object.keys(customLimits).length ? customLimits : null,
      note: f.get('note') || undefined,
    };
    if (!stripe) {
      body.planCode = f.get('planCode');
      body.status = f.get('status');
    }
    await run(async () => {
      await api(`/admin/subscribers/${id}/subscription`, { method: 'PATCH', body });
      await reload();
    }, 'Subscription updated');
  }

  return (
    <>
      <PageHeader
        title={workspace.name}
        back={{ href: '/admin/subscribers', label: 'Subscribers' }}
        description={`Joined ${formatDate(workspace.createdAt)} · ${workspace.users.map((u) => u.email).join(', ')}`}
        actions={
          <>
            <button className="btn btn-primary" onClick={openDashboard}>
              <ExternalLink size={16} aria-hidden="true" /> Open their dashboard
            </button>
            <button
              className={workspace.suspended ? 'btn btn-secondary' : 'btn btn-ghost text-danger'}
              disabled={busy}
              onClick={() =>
                run(
                  async () => {
                    if (
                      !workspace.suspended &&
                      !window.confirm(
                        'Suspend this workspace? Its users are signed out and calls stop.',
                      )
                    )
                      return;
                    await api(`/admin/subscribers/${id}`, {
                      method: 'PATCH',
                      body: { suspended: !workspace.suspended },
                    });
                    await reload();
                  },
                  workspace.suspended ? 'Workspace restored' : 'Workspace suspended',
                )
              }
            >
              {workspace.suspended ? 'Unsuspend' : 'Suspend'}
            </button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Section
            title="Subscription"
            description={
              stripe
                ? `Billed through ${gateway}: change plan or status in ${gateway} (it syncs back). You can still grant extra minutes and limits here.`
                : 'Managed manually: plan, status and dates are set here.'
            }
          >
            <form onSubmit={saveSubscription} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-3">
                <Field id="planCode" label="Plan">
                  <select
                    id="planCode"
                    name="planCode"
                    className="select"
                    defaultValue={subscription?.plan.code ?? 'BASIC'}
                    disabled={stripe}
                  >
                    <option value="BASIC">Basic</option>
                    <option value="PRO">Pro</option>
                    <option value="ENTERPRISE">Enterprise</option>
                  </select>
                </Field>
                <Field id="status" label="Status">
                  <select
                    id="status"
                    name="status"
                    className="select"
                    defaultValue={subscription?.status ?? 'ACTIVE'}
                    disabled={stripe}
                  >
                    {['ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'UNPAID', 'INCOMPLETE'].map(
                      (s) => (
                        <option key={s} value={s}>
                          {humanize(s)}
                        </option>
                      ),
                    )}
                  </select>
                </Field>
                <Field id="periodEnd" label="Current period ends">
                  <input
                    id="periodEnd"
                    name="periodEnd"
                    type="date"
                    className="input"
                    defaultValue={subscription?.currentPeriodEnd?.slice(0, 10)}
                    disabled={stripe}
                  />
                </Field>
                <Field id="customMinutes" label="Minutes override" help="Blank = plan default">
                  <input
                    id="customMinutes"
                    name="customMinutes"
                    type="number"
                    min={0}
                    className="input"
                    defaultValue={subscription?.customMinutes ?? ''}
                  />
                </Field>
                <Field
                  id="customPrice"
                  label="Custom price ($/mo)"
                  help="Enterprise; counts toward MRR"
                >
                  <input
                    id="customPrice"
                    name="customPrice"
                    type="number"
                    min={0}
                    step="0.01"
                    className="input"
                    defaultValue={
                      subscription?.customPriceCents != null
                        ? subscription.customPriceCents / 100
                        : ''
                    }
                  />
                </Field>
                <label className="flex items-center gap-2 self-end pb-3 text-sm font-medium">
                  <input
                    type="checkbox"
                    name="cancelAtPeriodEnd"
                    className="checkbox"
                    defaultChecked={subscription?.cancelAtPeriodEnd}
                  />
                  Cancel at period end
                </label>
              </div>
              <fieldset>
                <legend className="label">
                  Limit overrides (blank = plan default, &quot;unlimited&quot; = no limit)
                </legend>
                <div className="grid gap-4 sm:grid-cols-3">
                  {OVERRIDABLE.map((k) => (
                    <Field key={k} id={`limit_${k}`} label={LIMIT_LABELS[k]}>
                      <input
                        id={`limit_${k}`}
                        name={`limit_${k}`}
                        className="input"
                        defaultValue={
                          subscription?.customLimits?.[k] === null
                            ? 'unlimited'
                            : (subscription?.customLimits?.[k] ?? '')
                        }
                        placeholder={String(entitlements.limits[k] ?? 'unlimited')}
                      />
                    </Field>
                  ))}
                </div>
              </fieldset>
              <Field id="note" label="Note for the history" optional>
                <input
                  id="note"
                  name="note"
                  className="input"
                  placeholder="e.g. Comped 2 months after outage"
                />
              </Field>
              <button className="btn btn-primary" disabled={busy}>
                {subscription ? 'Save subscription' : 'Create subscription'}
              </button>
            </form>
          </Section>

          <AiSettingsPanel workspaceId={workspace.id} />

          <Section title="Recent calls">
            {data.recentCalls.length === 0 ? (
              <p className="text-sm text-muted">No calls yet.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto sm:-mx-6">
                <table className="table">
                  <tbody>
                    {data.recentCalls.map((c) => (
                      <tr key={c.id}>
                        <td className="num">
                          {c.direction === 'OUTBOUND' ? c.toNumber : c.fromNumber}
                        </td>
                        <td>
                          <StatusBadge status={c.outcome ?? c.status} />
                        </td>
                        <td className="num">{formatDuration(c.durationSec)}</td>
                        <td className="text-muted">{formatDateTime(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Activity">
            <ul className="space-y-2 text-sm">
              {data.auditLog.map((a) => (
                <li key={a.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    <code className="text-xs">{a.action}</code>{' '}
                    <span className="text-muted">by {a.actor?.name ?? 'system'}</span>
                  </span>
                  <span className="text-xs text-muted">{formatDateTime(a.createdAt)}</span>
                </li>
              ))}
              {!data.auditLog.length && <li className="text-muted">Nothing recorded yet.</li>}
            </ul>
          </Section>
        </div>

        <aside className="space-y-6">
          <Section title="Usage this period">
            <div className="space-y-4">
              <Meter label="Minutes" value={usage.minutesUsed} max={entitlements.includedMinutes} />
              <Meter label="Agents" value={usage.agents} max={entitlements.limits.agents} />
              <Meter
                label="Numbers"
                value={usage.phoneNumbers}
                max={entitlements.limits.phoneNumbers}
              />
              <Meter
                label="Campaigns"
                value={usage.campaigns}
                max={entitlements.limits.campaigns}
              />
            </div>
          </Section>

          <Section title="Setup">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Carriers</dt>
                <dd>{data.telephony.map((t) => humanize(t.provider)).join(', ') || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Time zone</dt>
                <dd>{workspace.timezone}</dd>
              </div>
            </dl>
          </Section>

          <Section title="Staff notes">
            <textarea
              className="textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              aria-label="Staff notes"
              placeholder="Only staff can see this."
            />
            <button
              className="btn btn-secondary btn-sm mt-3"
              disabled={busy}
              onClick={() =>
                run(
                  () => api(`/admin/subscribers/${id}`, { method: 'PATCH', body: { notes } }),
                  'Notes saved',
                )
              }
            >
              Save notes
            </button>
          </Section>

          <Section title="Subscription history">
            <ul className="space-y-2.5 text-sm">
              {data.events.map((e) => (
                <li key={e.id}>
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{humanize(e.type)}</span>
                    <span
                      className={`num ${e.mrrDeltaCents > 0 ? 'text-success' : e.mrrDeltaCents < 0 ? 'text-danger' : 'text-muted'}`}
                    >
                      {e.mrrDeltaCents > 0 ? '+' : ''}
                      {formatMoney(e.mrrDeltaCents)}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    {formatDate(e.occurredAt)}
                    {e.toPlan ? ` · ${humanize(e.toPlan)}` : ''}
                    {e.note ? ` · ${e.note}` : ''}
                  </p>
                </li>
              ))}
              {!data.events.length && <li className="text-muted">No changes yet.</li>}
            </ul>
          </Section>
        </aside>
      </div>
    </>
  );
}
