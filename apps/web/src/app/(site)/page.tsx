import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { Hero } from '@/components/site/home/Hero';
import { Explainer } from '@/components/site/home/Explainer';
import { Pillars, FeatureRows } from '@/components/site/home/Showcase';
import { Trust } from '@/components/site/home/Trust';
import { UseCases } from '@/components/site/home/UseCases';
import { Numbers } from '@/components/site/home/Numbers';
import { GetStarted } from '@/components/site/home/GetStarted';
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

const CAPABILITIES = [
  'Inbound & outbound',
  'Appointment booking',
  'Live transfer',
  'Call summaries',
  'Google Calendar',
  'Webhooks & API',
  'Campaigns',
];

export default async function HomePage() {
  const [plans, faqs, { seo, appearance }] = await Promise.all([
    getPlans(),
    getFaqs(),
    getSettings(),
  ]);
  const kawaii = appearance.theme === 'kawaii';
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
      {/* Kawaii paints its own sky; the particle sculpture is the default theme's. */}
      {!kawaii && <ParticleField />}
      <ScrollProgress />
      <Hero theme={appearance.theme} />

      <section aria-label="What every agent can do" className="py-8 text-white">
        <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
          Your numbers, every call handled
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

      <Pillars />
      <Explainer />
      <FeatureRows />
      <Trust />
      <UseCases />
      <Numbers />
      <GetStarted />

      <section id="pricing" className="scroll-mt-24 py-section" aria-labelledby="pricing-title">
        <div className="container">
          <Reveal className="mx-auto mb-14 max-w-2xl text-center">
            <h2
              id="pricing-title"
              className="text-[length:clamp(34px,5vw,64px)] font-medium leading-[1.03] tracking-[-0.04em] text-white"
            >
              Plans that grow with you.
            </h2>
            <p className="mt-5 text-lead text-white/65">
              Pick a plan, create your account and pay on the next screen. Upgrade, downgrade or
              cancel whenever you like.
            </p>
          </Reveal>
          <PricingCards plans={plans} tone="dark" />
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
            <FaqList faqs={faqs.slice(0, 6)} tone="dark" />
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
            Launch with Purple Voice.
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lead text-white/65">
            Start on Basic for $19 a month. Upgrade to Pro when you need more agents, numbers and
            campaigns.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup?plan=BASIC" className="btn btn-white btn-lg gap-2">
              Get started
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
