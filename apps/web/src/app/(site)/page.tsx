import Link from 'next/link';
import { Hero } from '@/components/site/home/Hero';
import { Statement } from '@/components/site/home/Statement';
import { Features } from '@/components/site/home/Features';
import { HowItWorks } from '@/components/site/home/HowItWorks';
import { PricingCards, PhoneBillingNote } from '@/components/site/pricing/PricingCards';
import { FaqList } from '@/components/site/shared/FaqList';
import { CtaBand } from '@/components/site/shared/CtaBand';
import { JsonLd } from '@/components/site/JsonLd';
import { getFaqs, getPlans, getSettings } from '@/lib/server-api';
import { siteUrl } from '@/lib/config';

export const revalidate = 3600;

const PROVIDERS = [
  'Twilio',
  'Plivo',
  'SuperPhone',
  'OpenAI',
  'Claude',
  'Gemini',
  'Google Calendar',
];

export default async function HomePage() {
  const [plans, faqs, { seo }] = await Promise.all([getPlans(), getFaqs(), getSettings()]);
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: seo.siteName,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          url: siteUrl,
          description: seo.defaultDescription,
          offers: plans
            .filter((p) => p.priceMonthlyCents !== null)
            .map((p) => ({
              '@type': 'Offer',
              name: p.name,
              price: (p.priceMonthlyCents! / 100).toFixed(2),
              priceCurrency: 'USD',
            })),
        }}
      />
      <Hero />

      <section aria-label="Supported providers" className="border-b border-line bg-surface py-10">
        <div className="container flex flex-col items-center gap-5 md:flex-row md:justify-between">
          <p className="text-sm font-semibold text-muted">Bring your own carrier and model</p>
          <ul className="flex flex-wrap justify-center gap-x-8 gap-y-3">
            {PROVIDERS.map((p) => (
              <li key={p} className="text-[15px] font-bold tracking-tight text-muted">
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Statement />
      <Features />
      <HowItWorks />

      <section className="bg-canvas py-section" aria-labelledby="pricing-title">
        <div className="container">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="eyebrow">Pricing</p>
            <h2 id="pricing-title" className="mt-3 text-h1">
              Simple plans, generous minutes
            </h2>
          </div>
          <PricingCards plans={plans} />
          <PhoneBillingNote />
        </div>
      </section>

      <section className="bg-surface py-section" aria-labelledby="faq-title">
        <div className="container max-w-3xl">
          <h2 id="faq-title" className="text-center text-h1">
            Questions, answered
          </h2>
          <div className="mt-10">
            <FaqList faqs={faqs.slice(0, 6)} />
          </div>
          <p className="mt-6 text-center">
            <Link href="/faq" className="btn btn-secondary">
              All questions
            </Link>
          </p>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
