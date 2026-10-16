'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import {
  LIMIT_LABELS,
  PAYMENT_GATEWAY_LABELS,
  type CheckoutOption,
  type Entitlements,
  type LimitKey,
  type PaymentGateway,
  type UsageSnapshot,
  GSTIN_PATTERN,
} from '@pv/shared';
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
import { Field } from '@/components/forms/Field';

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
    /** What Razorpay charges, in paise; set when Razorpay is offered. */
    priceMonthlyInrPaise: number | null;
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
  checkoutOptions: CheckoutOption[];
  billingDetails: { gstin: string | null; billingName: string | null };
  billingMode: 'live' | 'dev' | 'unavailable';
}

interface CheckoutResult {
  url?: string;
  activated?: boolean;
  gateway?: PaymentGateway;
  subscriptionId?: string;
  newTab?: boolean;
}

/** A Razorpay/PayPal subscription waiting for the customer to finish paying. */
interface Pending {
  gateway: 'RAZORPAY' | 'PAYPAL';
  subscriptionId: string;
  url?: string;
}

const POLL_MS = 5000;
const POLL_FOR_MS = 15 * 60 * 1000;

function formatInr(paise: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

/** Invoices can be in USD (Stripe, PayPal) or INR (Razorpay). */
function formatPaid(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(minor / 100);
  } catch {
    return formatMoney(minor, { decimals: true });
  }
}

const USAGE_ROWS: Array<[LimitKey, keyof UsageSnapshot]> = [
  ['agents', 'agents'],
  ['phoneNumbers', 'phoneNumbers'],
  ['campaigns', 'campaigns'],
  ['integrations', 'integrations'],
];

function BillingInner() {
  const params = useSearchParams();
  const router = useRouter();
  const { reload: reloadWs } = useWorkspace();
  const { data, reload } = useApi<BillingData>('/billing');
  const { busy, run } = useAction();
  const suggested = params.get('plan');
  const [picked, setPicked] = useState<PaymentGateway | null>(null);
  const [gstin, setGstin] = useState('');
  const [billingName, setBillingName] = useState('');
  const savedDetails = useRef(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const pollStarted = useRef(0);

  /** Asks the gateway whether the subscription is paid; true once the plan is live. */
  const confirm = useCallback(
    async (p: Pending, quiet = true) => {
      try {
        const r = await api<{ active: boolean }>('/billing/confirm', {
          body: { gateway: p.gateway, subscriptionId: p.subscriptionId },
        });
        if (r.active) {
          setPending(null);
          await Promise.all([reload(), reloadWs()]);
          toast('Payment received — your plan is active');
          return true;
        }
        if (!quiet) toast('Not confirmed yet. Finish paying, then check again.', 'error');
      } catch (err) {
        if (!quiet) toast(err instanceof Error ? err.message : 'Could not check payment', 'error');
      }
      return false;
    },
    [reload, reloadWs],
  );

  useEffect(() => {
    const status = params.get('checkout');
    if (!status) return;
    // PayPal sends the customer back with ?subscription_id=I-…
    const paypalId = params.get('subscription_id');
    if (status === 'success' && params.get('gateway') === 'PAYPAL' && paypalId) {
      const p: Pending = { gateway: 'PAYPAL', subscriptionId: paypalId };
      setPending(p);
      void confirm(p);
    } else if (status === 'success') {
      toast('Payment received — your plan is active');
    } else if (status === 'canceled') {
      toast('Checkout canceled', 'error');
    }
    router.replace('/dashboard/billing');
  }, [params, confirm, router]);

  // While a Razorpay/PayPal payment is open, check for it every few seconds.
  useEffect(() => {
    if (!pending) return;
    pollStarted.current = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - pollStarted.current > POLL_FOR_MS) window.clearInterval(timer);
      else void confirm(pending);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [pending, confirm]);

  // Prefill the GST details saved with the last checkout, once.
  useEffect(() => {
    if (!data || savedDetails.current) return;
    savedDetails.current = true;
    setGstin(data.billingDetails.gstin ?? '');
    setBillingName(data.billingDetails.billingName ?? '');
  }, [data]);

  if (!data) return <Loading />;
  const { entitlements, usage, subscription } = data;
  const options = data.checkoutOptions;
  const current = subscription?.provider as PaymentGateway | 'MANUAL' | undefined;
  const gateway =
    (picked && options.find((o) => o.gateway === picked)) ??
    options.find((o) => o.gateway === current) ??
    options[0];

  const rupees = gateway?.gateway === 'RAZORPAY';
  const gstinOk = !gstin.trim() || GSTIN_PATTERN.test(gstin.trim().toUpperCase());

  const choose = (planCode: string) => {
    if (rupees && !gstinOk) {
      toast('Check the GST number: 15 characters, e.g. 29ABCDE1234F1Z5', 'error');
      return;
    }
    // Razorpay's page opens in a new tab; open it now, while the click still
    // counts as the user's, or the browser blocks it.
    const tab = gateway?.gateway === 'RAZORPAY' ? window.open('', '_blank') : null;
    if (tab) tab.opener = null;
    return run(async () => {
      try {
        const r = await api<CheckoutResult>('/billing/checkout', {
          body: {
            planCode,
            gateway: gateway?.gateway,
            ...(gateway?.gateway === 'RAZORPAY'
              ? { gstin: gstin.trim(), billingName: billingName.trim() }
              : {}),
          },
        });
        if (r.url && r.newTab && r.subscriptionId) {
          if (tab) tab.location.href = r.url;
          setPending({ gateway: 'RAZORPAY', subscriptionId: r.subscriptionId, url: r.url });
        } else if (r.url) {
          tab?.close();
          window.location.href = r.url;
        } else {
          tab?.close();
          await Promise.all([reload(), reloadWs()]);
          toast('Plan updated');
        }
      } catch (err) {
        tab?.close();
        throw err;
      }
    });
  };

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
          Development mode: no payment gateway is set up, so choosing a plan activates it instantly
          without payment.
        </p>
      )}

      {pending && (
        <div className="mb-6 rounded-sm bg-brand-50 px-4 py-3 text-sm text-ink-soft">
          <p className="font-semibold text-ink">
            Waiting for your {PAYMENT_GATEWAY_LABELS[pending.gateway]} payment…
          </p>
          <p className="mt-1">
            {pending.gateway === 'RAZORPAY'
              ? 'Finish paying in the Razorpay tab (UPI, RuPay or card). This page activates your plan as soon as Razorpay confirms it.'
              : 'Confirming your PayPal subscription. This usually takes a few seconds.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pending.url && (
              <a
                href={pending.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
              >
                Open the payment page
              </a>
            )}
            <button
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={() => run(() => confirm(pending, false))}
            >
              I&apos;ve paid — check now
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setPending(null)}>
              Dismiss
            </button>
          </div>
        </div>
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
                  <span className="num font-semibold">{formatPaid(p.amountCents, p.currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <div className="mb-4 mt-10 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-lg font-semibold">Plans</h2>
        {options.length > 1 && gateway && (
          <fieldset className="flex flex-wrap items-center gap-2 text-sm">
            <legend className="sr-only">Pay with</legend>
            <span className="text-muted">Pay with</span>
            {options.map((o) => (
              <label
                key={o.gateway}
                title={o.methods}
                className={cn(
                  'cursor-pointer rounded-full border px-3 py-1.5',
                  o.gateway === gateway.gateway
                    ? 'border-ink bg-surface font-semibold'
                    : 'border-line text-ink-soft',
                )}
              >
                <input
                  type="radio"
                  name="gateway"
                  className="sr-only"
                  checked={o.gateway === gateway.gateway}
                  onChange={() => setPicked(o.gateway)}
                />
                {o.label}
              </label>
            ))}
          </fieldset>
        )}
      </div>
      {gateway && (
        <p className="-mt-2 mb-4 text-sm text-muted">
          {gateway.label}: {gateway.methods}
          {gateway.gateway === 'RAZORPAY' &&
            '. Prices are shown and charged in Indian rupees (incl. any GST).'}
          {entitlements.active &&
            current &&
            current !== 'MANUAL' &&
            current !== gateway.gateway &&
            `. Switching moves you from ${PAYMENT_GATEWAY_LABELS[current]}; that subscription is cancelled once the new one is paid.`}
        </p>
      )}
      {rupees && (
        <div className="card card-pad mb-5 grid gap-4 sm:grid-cols-2">
          <Field
            id="billingName"
            label="Business name for the invoice"
            help="Leave empty to use your workspace name."
            optional
          >
            <input
              id="billingName"
              className="input"
              maxLength={120}
              value={billingName}
              onChange={(e) => setBillingName(e.target.value)}
              placeholder="Northwind Solar Pvt Ltd"
            />
          </Field>
          <Field
            id="gstin"
            label="GST number (GSTIN)"
            help="Add it to claim input tax credit; it appears on your Razorpay invoices."
            error={gstinOk ? null : 'A GSTIN has 15 characters, e.g. 29ABCDE1234F1Z5'}
            optional
          >
            <input
              id="gstin"
              className="input font-mono uppercase"
              maxLength={15}
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="29ABCDE1234F1Z5"
              autoComplete="off"
              spellCheck={false}
            />
          </Field>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {data.plans.map((plan) => {
          const onPlan = entitlements.active && entitlements.planCode === plan.code;
          // Same plan through another gateway is a move, not "your plan".
          const isCurrent =
            onPlan && (!gateway || current === gateway.gateway || current === 'MANUAL');
          return (
            <article
              key={plan.code}
              className={cn(
                'flex flex-col rounded-xl border p-6',
                onPlan
                  ? 'border-ink bg-surface'
                  : plan.code === suggested
                    ? 'border-brand-400 bg-surface shadow-glow'
                    : 'border-line bg-surface',
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{plan.name}</h3>
                {onPlan && <span className="badge badge-success">Current</span>}
              </div>
              <p className="num mt-3 text-4xl font-light">
                {rupees && plan.priceMonthlyInrPaise != null
                  ? formatInr(plan.priceMonthlyInrPaise)
                  : formatMoney(plan.priceMonthlyCents)}
                {plan.priceMonthlyCents !== null && (
                  <span className="text-base text-muted"> / mo</span>
                )}
              </p>
              {rupees && plan.priceMonthlyInrPaise != null && (
                <p className="text-xs text-muted">
                  {formatMoney(plan.priceMonthlyCents)} in US dollars
                </p>
              )}
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
                  className={cn('btn mt-6 w-full', isCurrent ? 'btn-secondary' : 'btn-primary')}
                  disabled={
                    busy ||
                    isCurrent ||
                    data.billingMode === 'unavailable' ||
                    (!!gateway && !gateway.planCodes.includes(plan.code))
                  }
                  onClick={() => choose(plan.code)}
                >
                  {isCurrent
                    ? 'Your plan'
                    : onPlan && gateway
                      ? `Pay with ${gateway.label} instead`
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
      {(subscription?.provider === 'MANUAL' ||
        subscription?.provider === 'RAZORPAY' ||
        subscription?.provider === 'PAYPAL') &&
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
