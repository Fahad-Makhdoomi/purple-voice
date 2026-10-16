import Link from 'next/link';
import { Hero } from '@/components/site/home/Hero';
import { Statement } from '@/components/site/home/Statement';
import { Features } from '@/components/site/home/Features';
import { HowItWorks } from '@/components/site/home/HowItWorks';
import { Explainer } from '@/components/site/home/Explainer';
import { Numbers } from '@/components/site/home/Numbers';
import { GetStarted } from '@/components/site/home/GetStarted';
import { UseCases } from '@/components/site/home/UseCases';
import { ScrollProgress } from '@/components/site/motion';
import { PricingCards, PhoneBillingNote, PaymentTrust } from '@/components/site/pricing/PricingCards';
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
      <ScrollProgress />
      <Hero />

      <section
        aria-label="Supported providers"
        className="border-y border-white/10 bg-night py-7 text-white"
      >
        <div className="container mb-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
            Your numbers, leading AI
          </p>
        </div>
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
          <ul className="flex w-max animate-marquee gap-14 pr-14 hover:[animation-play-state:paused]">
            {[...PROVIDERS, ...PROVIDERS].map((p, i) => (
              <li
                key={i}
                aria-hidden={i >= PROVIDERS.length}
                className="whitespace-nowrap text-xl font-bold tracking-tight text-white/45 transition hover:text-white"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Explainer />
      <Statement />
      <Features />
      <UseCases />
      <Numbers />
      <HowItWorks />
      <GetStarted />

      <section id="pricing" className="scroll-mt-20 bg-canvas py-section" aria-labelledby="pricing-title">
        <div className="container">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="eyebrow">Pricing</p>
            <h2 id="pricing-title" className="mt-3 text-h1">
              Simple plans, generous minutes
            </h2>
            <p className="mt-4 text-lead text-muted">
              Pick a plan, create your account and pay in the next screen. Upgrade, downgrade or
              cancel whenever you like.
            </p>
          </div>
          <PricingCards plans={plans} />
          <PaymentTrust />
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
