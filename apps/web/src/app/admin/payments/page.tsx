'use client';

import { Check, CreditCard, Lock, ServerCog, Trash2 } from 'lucide-react';
import {
  PAYMENT_GATEWAY_LABELS,
  PAYMENT_GATEWAY_METHODS,
  isSuperAdmin,
  type PaymentGatewayInput,
  type PaymentGatewayView,
} from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useSession } from '@/lib/session';
import { EmptyState, ErrorNote, Loading, PageHeader, Section, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';

const TITLE = 'Payment gateways';
const DESCRIPTION =
  'How subscribers pay. Each enabled gateway with plan ids set (Plans & pricing) is offered on the billing page.';

/** Where each gateway's keys and plan ids are found, in the gateway's own dashboard. */
const SETUP: Record<PaymentGatewayView['gateway'], string> = {
  STRIPE:
    'Developers → API keys for the secret key. Create monthly prices per plan and paste their ids in Plans & pricing. Turn on the Customer portal so subscribers can manage cards and cancel.',
  RAZORPAY:
    'Account & Settings → API keys for the key id and secret. Subscriptions → Plans: create a monthly INR plan per plan and paste its plan_ id in Plans & pricing. UPI Autopay and RuPay need Subscriptions enabled on your account.',
  PAYPAL:
    'developer.paypal.com → Apps & Credentials for the client id and secret (Sandbox or Live). Create a product and monthly billing plan per plan (Subscriptions) and paste the P- id in Plans & pricing.',
};

type View = { gateways: PaymentGatewayView[] };

/** Super admin → Payment gateways: Stripe, Razorpay (UPI/RuPay) and PayPal credentials. */
export default function PaymentGatewaysPage() {
  const { me } = useSession();
  // The API enforces this; the check only spares admins a page that can't load.
  const allowed = !!me && isSuperAdmin(me.user.role);
  const { data, error, setData } = useApi<View>(allowed ? '/admin/super/payments' : null);
  const { busy, run } = useAction();

  if (me && !allowed) {
    return (
      <>
        <PageHeader title={TITLE} description={DESCRIPTION} />
        <EmptyState
          icon={Lock}
          title="Super admins only"
          body="Payment gateway keys are managed by super admins."
        />
      </>
    );
  }
  if (!data) {
    return (
      <>
        <PageHeader title={TITLE} description={DESCRIPTION} />
        {error ? <ErrorNote message={error.message} /> : <Loading />}
      </>
    );
  }

  const save = (input: PaymentGatewayInput) =>
    run(async () => {
      setData(await api<View>('/admin/super/payments/gateways', { method: 'PUT', body: input }));
    }, `${PAYMENT_GATEWAY_LABELS[input.gateway]} verified and saved`);

  const remove = (g: PaymentGatewayView) => {
    const note = g.gateway === 'STRIPE' ? ' Stripe falls back to STRIPE_* in api.env, if set.' : '';
    if (
      !window.confirm(
        `Remove the ${PAYMENT_GATEWAY_LABELS[g.gateway]} keys? Subscribers already paying through it keep their plan until it ends, but renewals won't sync.${note}`,
      )
    )
      return;
    void run(async () => {
      setData(await api<View>(`/admin/super/payments/gateways/${g.gateway}`, { method: 'DELETE' }));
    }, 'Gateway removed');
  };

  return (
    <>
      <PageHeader title={TITLE} description={DESCRIPTION} />
      <div className="grid max-w-4xl gap-6">
        {data.gateways.map((g) => (
          <GatewayCard
            key={g.gateway}
            view={g}
            busy={busy}
            onSave={save}
            onRemove={() => remove(g)}
          />
        ))}
      </div>
    </>
  );
}

function GatewayCard({
  view: g,
  busy,
  onSave,
  onRemove,
}: {
  view: PaymentGatewayView;
  busy: boolean;
  onSave: (input: PaymentGatewayInput) => Promise<unknown>;
  onRemove: () => void;
}) {
  const label = PAYMENT_GATEWAY_LABELS[g.gateway];
  const saved = g.configured && !g.fromEnv;
  const keep = g.configured ? 'Saved — leave blank to keep' : undefined;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) ?? '').trim();
    const enabled = f.get('enabled') === 'on';
    const input: PaymentGatewayInput =
      g.gateway === 'STRIPE'
        ? { gateway: 'STRIPE', enabled, secretKey: s('secret'), webhookSecret: s('webhookSecret') }
        : g.gateway === 'RAZORPAY'
          ? {
              gateway: 'RAZORPAY',
              enabled,
              keyId: s('publicId'),
              keySecret: s('secret'),
              webhookSecret: s('webhookSecret'),
            }
          : {
              gateway: 'PAYPAL',
              enabled,
              mode: s('mode') === 'live' ? 'live' : 'test',
              clientId: s('publicId'),
              clientSecret: s('secret'),
              webhookId: s('webhookId'),
            };
    void onSave(input);
  }

  const id = (k: string) => `${g.gateway.toLowerCase()}-${k}`;

  return (
    <Section
      title={label}
      description={`${PAYMENT_GATEWAY_METHODS[g.gateway]}. ${SETUP[g.gateway]}`}
    >
      <div className="mb-5 flex items-start gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            g.enabled ? 'bg-success/10 text-success' : 'bg-brand-50 text-brand-700',
          )}
        >
          {g.fromEnv ? (
            <ServerCog size={18} aria-hidden="true" />
          ) : g.enabled ? (
            <Check size={18} aria-hidden="true" />
          ) : (
            <CreditCard size={18} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">
              {!g.configured ? 'Not set up' : g.enabled ? 'On' : 'Off (saved, not offered)'}
            </p>
            {g.mode && (
              <span className={g.mode === 'live' ? 'badge badge-success' : 'badge badge-brand'}>
                {g.mode === 'live' ? 'Live' : 'Test / sandbox'}
              </span>
            )}
          </div>
          {g.configured && (
            <p className="mt-1 text-ink-soft">
              {g.publicId ? `${g.publicId} · ` : ''}secret ending {g.last4}
              {g.fromEnv
                ? ' · from STRIPE_* in api.env (saving here overrides it)'
                : ` · verified ${formatDate(g.verifiedAt)}`}
            </p>
          )}
          <p className="mt-1 text-xs text-muted">
            Plans offered:{' '}
            {g.plansReady.length
              ? g.plansReady.join(', ')
              : 'none yet — add plan ids in Plans & pricing'}
          </p>
        </div>
      </div>

      <form className="space-y-5" onSubmit={submit} autoComplete="off">
        <div className="grid gap-5 sm:grid-cols-2">
          {g.gateway === 'PAYPAL' && (
            <Field id={id('mode')} label="Environment">
              <select
                id={id('mode')}
                name="mode"
                className="select"
                defaultValue={g.mode ?? 'test'}
              >
                <option value="test">Sandbox (testing)</option>
                <option value="live">Live</option>
              </select>
            </Field>
          )}
          {g.gateway !== 'STRIPE' && (
            <Field id={id('publicId')} label={g.gateway === 'RAZORPAY' ? 'Key id' : 'Client id'}>
              <input
                id={id('publicId')}
                name="publicId"
                className="input font-mono text-xs"
                required
                defaultValue={g.publicId ?? ''}
                placeholder={g.gateway === 'RAZORPAY' ? 'rzp_live_…' : undefined}
                spellCheck={false}
              />
            </Field>
          )}
          <Field
            id={id('secret')}
            label={
              g.gateway === 'STRIPE'
                ? 'Secret key'
                : g.gateway === 'RAZORPAY'
                  ? 'Key secret'
                  : 'Client secret'
            }
          >
            <input
              id={id('secret')}
              name="secret"
              type="password"
              className="input font-mono"
              required={!g.configured}
              placeholder={keep ?? (g.gateway === 'STRIPE' ? 'sk_live_…' : undefined)}
              maxLength={500}
              spellCheck={false}
            />
          </Field>
          {g.gateway === 'PAYPAL' ? (
            <Field
              id={id('webhookId')}
              label="Webhook id"
              help="Shown next to the webhook in your PayPal app."
            >
              <input
                id={id('webhookId')}
                name="webhookId"
                className="input font-mono text-xs"
                required
                defaultValue={g.webhookId ?? ''}
                spellCheck={false}
              />
            </Field>
          ) : (
            <Field id={id('webhookSecret')} label="Webhook signing secret">
              <input
                id={id('webhookSecret')}
                name="webhookSecret"
                type="password"
                className="input font-mono"
                required={!g.hasWebhookSecret}
                placeholder={
                  g.hasWebhookSecret
                    ? 'Saved — leave blank to keep'
                    : g.gateway === 'STRIPE'
                      ? 'whsec_…'
                      : 'The secret you typed when adding the webhook'
                }
                maxLength={500}
                spellCheck={false}
              />
            </Field>
          )}
        </div>

        <div className="rounded-lg border border-line p-4 text-sm">
          <p className="font-semibold">Webhook</p>
          <p className="mt-1 text-ink-soft">
            Add this URL in {PAYMENT_GATEWAY_LABELS[g.gateway]} and subscribe it to the events
            below. Without it, plans don&apos;t renew or cancel here.
          </p>
          <p className="mt-2 break-all font-mono text-xs">{g.webhookUrl}</p>
          <p className="mt-2 text-xs text-muted">{g.webhookEvents.join(' · ')}</p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="enabled" defaultChecked={g.configured ? g.enabled : true} />
          Offer {PAYMENT_GATEWAY_LABELS[g.gateway]} on the billing page
        </label>

        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy}>
            {saved ? 'Verify and save' : `Connect ${PAYMENT_GATEWAY_LABELS[g.gateway]}`}
          </button>
          {saved && (
            <button
              type="button"
              className="btn btn-ghost text-danger"
              disabled={busy}
              onClick={onRemove}
            >
              <Trash2 size={14} aria-hidden="true" /> Remove
            </button>
          )}
        </div>
      </form>
    </Section>
  );
}
