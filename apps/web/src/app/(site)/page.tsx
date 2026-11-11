import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Hero } from '@/components/site/home/Hero';
import { Explainer } from '@/components/site/home/Explainer';
import { Features } from '@/components/site/home/Showcase';
import { UseCases } from '@/components/site/home/UseCases';
import {
  PricingCards,
  PhoneBillingNote,
  PaymentTrust,
} from '@/components/site/pricing/PricingCards';
import { FaqList } from '@/components/site/shared/FaqList';
import { JsonLd } from '@/components/site/JsonLd';
import { ParticleField } from '@/components/site/motion/ParticleField';
import { Reveal, ScrollProgress } from '@/components/site/motion';
import { getFaqs, getPlans, getSettings } from '@/lib/server-api';
import { siteUrl } from '@/lib/config';

export const revalidate = 3600;

/** Title and description come from the root layout's site defaults; this pins the canonical address. */
export const metadata: Metadata = { alternates: { canonical: '/' } };

const CAPABILITIES = [
  'Inbound & outbound calls',
  'Appointment booking',
  'Live transfer',
  'Call summaries',
  'Google Calendar',
  'Campaigns',
  '100+ natural voices',
  'Webhooks & API',
];

export default async function HomePage() {
  const [plans, faqs, { seo, appearance, content }] = await Promise.all([
    getPlans(),
    getFaqs(),
    getSettings(),
  ]);
  const { theme } = appearance;
  return (
    // `landing` scopes the theme stylesheets' remaps of this page's black-and-white palette.
    <div className="landing relative isolate overflow-x-clip bg-black">
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
      {/* The particle sculpture is the default theme's; light themes paint their own sky. */}
      {theme === 'default' && <ParticleField />}
      <ScrollProgress />
      <Hero theme={theme} copy={content.hero} />

      <section aria-label="What every agent can do" className="py-8 text-white">
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
          Everything your agent can do
        </p>
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_12%,#000_88%,transparent)]">
          <ul className="flex w-max animate-marquee gap-14 pr-14 hover:[animation-play-state:paused]">
            {[...CAPABILITIES, ...CAPABILITIES].map((p, i) => (
              <li
                key={i}
                aria-hidden={i >= CAPABILITIES.length}
                className="whitespace-nowrap text-xl font-semibold tracking-tight text-white/45 transition hover:text-white"
              >
                {p}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Explainer />
      <Features />
      <UseCases portraits={theme === 'minimal'} />

      <section id="pricing" className="scroll-mt-24 py-section" aria-labelledby="pricing-title">
        <div className="container">
          <Reveal className="mx-auto mb-12 max-w-2xl text-center">
            <p className="eyebrow text-brand-300">Pricing</p>
            <h2
              id="pricing-title"
              className="mt-3 text-[length:clamp(34px,5vw,60px)] font-medium leading-[1.03] tracking-[-0.04em] text-white"
            >
              Start free. Pay when it works.
            </h2>
            <p className="mt-4 text-lead text-white/65">
              Try Starter free for 7 days. Change plans or cancel any time.
            </p>
          </Reveal>
          <PricingCards plans={plans} tone="dark" maxHighlights={5} />
          <p className="mt-8 text-center">
            <Link href="/pricing" className="btn btn-dark">
              Compare every feature
            </Link>
          </p>
          <PaymentTrust tone="dark" />
          <PhoneBillingNote tone="dark" />
        </div>
      </section>

      <section id="faq" className="scroll-mt-24 py-section" aria-labelledby="faq-title">
        <div className="container max-w-3xl">
          <Reveal>
            <h2
              id="faq-title"
              className="text-center text-[length:clamp(34px,5vw,60px)] font-medium leading-[1.03] tracking-[-0.04em] text-white"
            >
              Questions, answered.
            </h2>
          </Reveal>
          <div className="mt-10">
            <FaqList faqs={faqs.slice(0, 4)} tone="dark" />
          </div>
          <p className="mt-6 text-center">
            <Link href="/faq" className="btn btn-dark">
              All questions
            </Link>
          </p>
        </div>
      </section>

      <section
        className="px-gutter pb-section pt-10 text-center text-white"
        aria-label="Get started"
      >
        <Reveal>
          <h2 className="mx-auto max-w-4xl text-white text-[length:clamp(44px,8vw,104px)] font-medium leading-[0.98] tracking-[-0.045em]">
            Never miss a lead again.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lead text-white/65">
            Your first agent can be calling today. Free for 7 days, then from $5 a month.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup?plan=FREE" className="btn btn-white btn-lg gap-2">
              Start free trial
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-white">
                <ArrowUpRight size={14} />
              </span>
            </Link>
            <Link href="/contact" className="btn btn-dark btn-lg">
              Talk to us
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
