import type { Metadata } from 'next';
import { Check, Minus } from 'lucide-react';
import { FEATURE_LABELS, LIMIT_LABELS, type FeatureKey, type LimitKey } from '@pv/shared';
import { PageIntro } from '@/components/site/shared/PageIntro';
import { PricingCards, PhoneBillingNote } from '@/components/site/pricing/PricingCards';
import { FaqList, faqJsonLd } from '@/components/site/shared/FaqList';
import { CtaBand } from '@/components/site/shared/CtaBand';
import { JsonLd } from '@/components/site/JsonLd';
import { getFaqs, getPlans } from '@/lib/server-api';
import { formatNumber } from '@/lib/format';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Free with 100 AI call minutes a month, Basic at $19/month with 1,000 call minutes, Pro at $299/month with 20,000 minutes, or a custom Enterprise build.',
  alternates: { canonical: '/pricing' },
};

const LIMIT_ROWS: LimitKey[] = [
  'agents',
  'phoneNumbers',
  'campaigns',
  'contactsPerCampaign',
  'integrations',
  'concurrentCalls',
];
const FEATURE_ROWS: FeatureKey[] = [
  'personalizedPrompts',
  'appointmentBooking',
  'callSummary',
  'callTransfer',
  'googleCalendar',
  'multipleIntegrations',
  'webhooks',
  'developerApi',
  'detailedInsights',
  'aiSupportAssistant',
  'prioritySupport',
  'advancedAutomations',
];

export default async function PricingPage() {
  const [plans, faqs] = await Promise.all([getPlans(), getFaqs()]);
  const pricingFaqs = faqs.filter((f) => f.category === 'Pricing');

  return (
    <>
      {pricingFaqs.length > 0 && <JsonLd data={faqJsonLd(pricingFaqs)} />}
      <PageIntro
        eyebrow="Pricing"
        title="Pay for the minutes you talk, not the seats you fill"
        lead="Start free with one agent and 100 AI call minutes. Grow on Basic. Move to Pro for a full AI sales floor. Need it built for you? Enterprise."
      />

      <section className="-mt-4 bg-canvas pb-section">
        <div className="container">
          <PricingCards plans={plans} headingLevel="h2" />
          <PhoneBillingNote />

          <div className="mt-20 overflow-x-auto rounded-lg border border-line bg-surface">
            <table className="table min-w-[640px]">
              <caption className="sr-only">Plan comparison</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-2/5">
                    Compare plans
                  </th>
                  {plans.map((p) => (
                    <th key={p.code} scope="col" className="text-center">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row" className="px-4 py-3.5 text-sm font-medium">
                    Call minutes / month
                  </th>
                  {plans.map((p) => (
                    <td key={p.code} className="num text-center">
                      {p.includedMinutes === null ? 'Custom' : formatNumber(p.includedMinutes)}
                    </td>
                  ))}
                </tr>
                {LIMIT_ROWS.map((key) => (
                  <tr key={key}>
                    <th scope="row" className="px-4 py-3.5 text-sm font-medium">
                      {LIMIT_LABELS[key]}
                    </th>
                    {plans.map((p) => {
                      const v = p.limits[key];
                      return (
                        <td key={p.code} className="num text-center">
                          {v === null || v === undefined ? 'Unlimited' : formatNumber(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {FEATURE_ROWS.map((key) => (
                  <tr key={key}>
                    <th scope="row" className="px-4 py-3.5 text-sm font-medium">
                      {FEATURE_LABELS[key]}
                    </th>
                    {plans.map((p) => (
                      <td key={p.code} className="text-center">
                        {p.features[key] ? (
                          <Check
                            size={18}
                            className="mx-auto text-brand-600"
                            aria-label="Included"
                          />
                        ) : (
                          <Minus
                            size={18}
                            className="mx-auto text-subtle"
                            aria-label="Not included"
                          />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pricingFaqs.length > 0 && (
            <div className="mx-auto mt-20 max-w-3xl">
              <h2 className="text-center text-h2">Billing questions</h2>
              <div className="mt-8">
                <FaqList faqs={pricingFaqs} />
              </div>
            </div>
          )}
        </div>
      </section>
      <CtaBand />
    </>
  );
}
