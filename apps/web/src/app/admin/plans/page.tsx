'use client';

import { LIMIT_LABELS, type LimitKey } from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { Loading, PageHeader, Section, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';

interface Plan {
  id: string;
  code: string;
  name: string;
  tagline: string;
  priceMonthlyCents: number | null;
  includedMinutes: number | null;
  stripePriceId: string | null;
  razorpayPlanId: string | null;
  paypalPlanId: string | null;
  limits: Record<LimitKey, number | null>;
  highlights: string[];
  active: boolean;
  _count: { subscriptions: number };
}

const LIMITS: LimitKey[] = [
  'agents',
  'phoneNumbers',
  'campaigns',
  'contactsPerCampaign',
  'integrations',
  'concurrentCalls',
  'webhooks',
  'apiKeys',
  'automations',
];

export default function PlansAdmin() {
  const { data, reload } = useApi<{ plans: Plan[] }>('/admin/super/plans');
  const { busy, run } = useAction();
  if (!data) return <Loading />;
  return (
    <>
      <PageHeader
        title="Plans & pricing"
        description="Changes apply to the website and to every subscriber on the plan immediately. Prices charged are set in each gateway (Stripe price, Razorpay plan, PayPal plan); paste their ids here. A plan without a gateway's id isn't offered through that gateway."
      />
      <div className="space-y-6">
        {data.plans.map((p) => (
          <Section key={p.id} title={`${p.name} · ${p._count.subscriptions} subscriptions`}>
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const n = (k: string) => {
                  const v = String(f.get(k) ?? '').trim();
                  return v === '' || v === 'unlimited' ? null : Number(v);
                };
                void run(async () => {
                  await api(`/admin/super/plans/${p.code}`, {
                    method: 'PATCH',
                    body: {
                      name: f.get('name'),
                      tagline: f.get('tagline'),
                      priceMonthlyCents:
                        f.get('price') === '' ? null : Math.round(Number(f.get('price')) * 100),
                      includedMinutes: n('minutes'),
                      stripePriceId: String(f.get('stripePriceId') ?? '').trim() || null,
                      razorpayPlanId: String(f.get('razorpayPlanId') ?? '').trim() || null,
                      paypalPlanId: String(f.get('paypalPlanId') ?? '').trim() || null,
                      highlights: String(f.get('highlights') ?? '')
                        .split('\n')
                        .map((h) => h.trim())
                        .filter(Boolean),
                      limits: Object.fromEntries(
                        LIMITS.map((k) => [
                          k,
                          k === 'concurrentCalls' ? (n(`l_${k}`) ?? 1) : n(`l_${k}`),
                        ]),
                      ),
                    },
                  });
                  await reload();
                }, `${p.name} saved`);
              }}
            >
              <div className="grid gap-5 sm:grid-cols-4">
                <Field id={`${p.code}-name`} label="Name">
                  <input
                    id={`${p.code}-name`}
                    name="name"
                    className="input"
                    defaultValue={p.name}
                  />
                </Field>
                <Field id={`${p.code}-price`} label="Price ($/month)" help="Blank = custom">
                  <input
                    id={`${p.code}-price`}
                    name="price"
                    type="number"
                    step="0.01"
                    className="input"
                    defaultValue={p.priceMonthlyCents == null ? '' : p.priceMonthlyCents / 100}
                  />
                </Field>
                <Field id={`${p.code}-min`} label="Minutes / month" help="Blank = custom">
                  <input
                    id={`${p.code}-min`}
                    name="minutes"
                    type="number"
                    className="input"
                    defaultValue={p.includedMinutes ?? ''}
                  />
                </Field>
                <Field id={`${p.code}-stripe`} label="Stripe price id" optional>
                  <input
                    id={`${p.code}-stripe`}
                    name="stripePriceId"
                    className="input font-mono text-xs"
                    defaultValue={p.stripePriceId ?? ''}
                  />
                </Field>
                <Field
                  id={`${p.code}-razorpay`}
                  label="Razorpay plan id"
                  help="plan_… · billed in INR"
                  optional
                >
                  <input
                    id={`${p.code}-razorpay`}
                    name="razorpayPlanId"
                    className="input font-mono text-xs"
                    defaultValue={p.razorpayPlanId ?? ''}
                  />
                </Field>
                <Field id={`${p.code}-paypal`} label="PayPal plan id" help="P-…" optional>
                  <input
                    id={`${p.code}-paypal`}
                    name="paypalPlanId"
                    className="input font-mono text-xs"
                    defaultValue={p.paypalPlanId ?? ''}
                  />
                </Field>
                <Field id={`${p.code}-tagline`} label="Tagline" className="sm:col-span-2">
                  <input
                    id={`${p.code}-tagline`}
                    name="tagline"
                    className="input"
                    defaultValue={p.tagline}
                  />
                </Field>
              </div>
              <fieldset>
                <legend className="label">
                  Limits (blank or &quot;unlimited&quot; = no limit, 0 = feature off)
                </legend>
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {LIMITS.map((k) => (
                    <Field key={k} id={`${p.code}-${k}`} label={LIMIT_LABELS[k]}>
                      <input
                        id={`${p.code}-${k}`}
                        name={`l_${k}`}
                        className="input"
                        defaultValue={p.limits[k] === null ? 'unlimited' : p.limits[k]}
                      />
                    </Field>
                  ))}
                </div>
              </fieldset>
              <Field id={`${p.code}-hl`} label="Pricing page bullets" help="One per line.">
                <textarea
                  id={`${p.code}-hl`}
                  name="highlights"
                  className="textarea min-h-[150px]"
                  defaultValue={p.highlights.join('\n')}
                />
              </Field>
              <button className="btn btn-primary" disabled={busy}>
                Save {p.name}
              </button>
            </form>
          </Section>
        ))}
      </div>
    </>
  );
}
