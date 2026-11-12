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

/** Carriers a workspace can connect its numbers from (apps/api/src/telephony). */
const CARRIERS = ['Twilio', 'Plivo', 'Telnyx', 'Vonage', 'SignalWire', 'Bandwidth', 'Exotel'];

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

      <section aria-labelledby="carriers-title" className="py-10 text-white">
        <div className="container flex flex-col items-center gap-5 text-center">
          <p
            id="carriers-title"
            className="text-xs font-semibold uppercase tracking-[0.16em] text-white/45"
          >
            Works with the phone numbers you already have
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-9 gap-y-3">
            {CARRIERS.map((c) => (
              <li key={c} className="text-[19px] font-semibold tracking-tight text-white/55">
                {c}
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
              Plans that start at $5 a month.
            </h2>
            <p className="mt-4 text-lead text-white/65">
              Try Starter free for 7 days. Every plan includes call minutes; upgrade, downgrade or
              cancel from your dashboard.
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
            Set up your first agent this afternoon and it can be calling leads by tonight. Free for
            7 days, then $5 a month.
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
