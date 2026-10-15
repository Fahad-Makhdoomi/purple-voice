'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { LIMIT_LABELS, type Entitlements, type LimitKey, type UsageSnapshot } from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useWorkspace } from '@/lib/workspace';
import {
  Loading,
  Meter,
  PageHeader,
  Section,
  StatusBadge,
  toast,
  useAction,
} from '@/components/ui';
import { formatDate, formatMoney, formatNumber } from '@/lib/format';
import { cn } from '@/lib/cn';

interface BillingData {
  entitlements: Entitlements;
  usage: UsageSnapshot;
  subscription: {
    planCode: string;
    status: string;
    provider: string;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    hasStripeCustomer: boolean;
  } | null;
  plans: Array<{
    code: string;
    name: string;
    tagline: string;
    priceMonthlyCents: number | null;
    includedMinutes: number | null;
    highlights: string[];
    featured: boolean;
    selfServe: boolean;
  }>;
  payments: Array<{
    id: string;
    amountCents: number;
    currency: string;
    status: string;
    paidAt: string | null;
    description: string | null;
  }>;
  billingMode: 'stripe' | 'dev' | 'unavailable';
}

const USAGE_ROWS: Array<[LimitKey, keyof UsageSnapshot]> = [
  ['agents', 'agents'],
  ['phoneNumbers', 'phoneNumbers'],
  ['campaigns', 'campaigns'],
  ['integrations', 'integrations'],
];

function BillingInner() {
  const params = useSearchParams();
  const { reload: reloadWs } = useWorkspace();
  const { data, reload } = useApi<BillingData>('/billing');
  const { busy, run } = useAction();
  const suggested = params.get('plan');

  useEffect(() => {
    if (params.get('checkout') === 'success') toast('Payment received — your plan is active');
    if (params.get('checkout') === 'canceled') toast('Checkout canceled', 'error');
  }, [params]);

  if (!data) return <Loading />;
  const { entitlements, usage, subscription } = data;

  const choose = (planCode: string) =>
    run(async () => {
      const r = await api<{ url?: string; activated?: boolean }>('/billing/checkout', {
        body: { planCode },
      });
      if (r.url) window.location.href = r.url;
      else {
        await Promise.all([reload(), reloadWs()]);
        toast('Plan updated');
      }
    });

  return (
    <>
      <PageHeader
        title="Billing"
        description="Your plan, usage this period and invoices. Phone numbers and AI usage are billed by those providers."
        actions={
          subscription?.hasStripeCustomer && (
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const { url } = await api<{ url: string }>('/billing/portal', { method: 'POST' });
                  window.location.href = url;
                })
              }
            >
              Payment methods & invoices
            </button>
          )
        }
      />

      {data.billingMode === 'dev' && (
        <p className="mb-6 rounded-sm bg-warning/10 px-4 py-3 text-sm text-warning">
          Development mode: Stripe isn&apos;t configured, so choosing a plan activates it instantly
          without payment.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Section title="Current plan">
          {entitlements.active ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-2xl font-semibold">{entitlements.planName}</p>
                <StatusBadge status={entitlements.status} />
              </div>
              <p className="mt-1 text-sm text-muted">
                {entitlements.cancelAtPeriodEnd ? 'Ends' : 'Renews'}{' '}
                {formatDate(entitlements.currentPeriodEnd)}
              </p>
              <div className="mt-6 space-y-4">
                <Meter
                  label="Call minutes"
                  value={usage.minutesUsed}
                  max={entitlements.includedMinutes}
                />
                {USAGE_ROWS.map(([limit, key]) => (
                  <Meter
                    key={limit}
                    label={LIMIT_LABELS[limit]}
                    value={usage[key] as number}
                    max={entitlements.limits[limit]}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="text-ink-soft">
              No active plan. Choose one below to connect numbers and create agents.
            </p>
          )}
        </Section>

        <Section title="Invoices">
          {data.payments.length === 0 ? (
            <p className="text-sm text-muted">No payments yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {data.payments.map((p) => (
                <li key={p.id} className="flex justify-between py-2.5 text-sm">
                  <span className="text-ink-soft">{formatDate(p.paidAt)}</span>
                  <span className="num font-semibold">
                    {formatMoney(p.amountCents, { decimals: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <h2 className="mb-4 mt-10 text-lg font-semibold">Plans</h2>
      <div className="grid gap-5 lg:grid-cols-3">
        {data.plans.map((plan) => {
          const current = entitlements.active && entitlements.planCode === plan.code;
          return (
            <article
              key={plan.code}
              className={cn(
                'flex flex-col rounded-xl border p-6',
                current
                  ? 'border-ink bg-surface'
                  : plan.code === suggested
                    ? 'border-brand-400 bg-surface shadow-glow'
                    : 'border-line bg-surface',
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{plan.name}</h3>
                {current && <span className="badge badge-success">Current</span>}
              </div>
              <p className="num mt-3 text-4xl font-light">
                {formatMoney(plan.priceMonthlyCents)}
                {plan.priceMonthlyCents !== null && (
                  <span className="text-base text-muted"> / mo</span>
                )}
              </p>
              <p className="mt-1 text-sm text-brand-700">
                {plan.includedMinutes !== null
                  ? `${formatNumber(plan.includedMinutes)} minutes included`
                  : 'Custom minutes'}
              </p>
              <ul className="mt-5 flex-1 space-y-2">
                {plan.highlights.slice(0, 6).map((h) => (
                  <li key={h} className="flex gap-2 text-sm text-ink-soft">
                    <Check
                      size={15}
                      className="mt-0.5 shrink-0 text-brand-600"
                      aria-hidden="true"
                    />{' '}
                    {h}
                  </li>
                ))}
              </ul>
              {plan.selfServe ? (
                <button
                  className={cn('btn mt-6 w-full', current ? 'btn-secondary' : 'btn-primary')}
                  disabled={busy || current || data.billingMode === 'unavailable'}
                  onClick={() => choose(plan.code)}
                >
                  {current
                    ? 'Your plan'
                    : entitlements.active
                      ? `Switch to ${plan.name}`
                      : `Choose ${plan.name}`}
                </button>
              ) : (
                <Link href="/contact?plan=ENTERPRISE" className="btn btn-secondary mt-6 w-full">
                  Talk to sales
                </Link>
              )}
            </article>
          );
        })}
      </div>
      {subscription?.provider === 'MANUAL' &&
        entitlements.active &&
        !entitlements.cancelAtPeriodEnd && (
          <p className="mt-6 text-sm text-muted">
            Want to stop at the end of this period?{' '}
            <button
              className="font-semibold text-danger underline"
              onClick={() =>
                window.confirm('Cancel at the end of the current period?') &&
                run(async () => {
                  await api('/billing/cancel', { method: 'POST' });
                  await reload();
                }, 'Your plan will end at the close of this period')
              }
            >
              Cancel plan
            </button>
          </p>
        )}
    </>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BillingInner />
    </Suspense>
  );
}
