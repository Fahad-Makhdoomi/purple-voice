import Link from 'next/link';
import { ArrowUpRight, Check, Lock, ShieldCheck } from 'lucide-react';
import { Reveal, Spotlight } from '@/components/site/motion';
import { formatMoney, formatNumber } from '@/lib/format';
import type { PublicPlan } from '@/lib/server-api';
import { cn } from '@/lib/cn';

type Tone = 'light' | 'dark';

/**
 * Plan cards, shared by the home page (`tone="dark"`, on black) and /pricing
 * (light). Prices come from the admin-editable plan table. `headingLevel`
 * keeps the document outline in order: h3 under a section's h2 on the home
 * page, h2 straight under /pricing's h1.
 */
export function PricingCards({
  plans,
  headingLevel = 'h3',
  tone = 'light',
}: {
  plans: PublicPlan[];
  headingLevel?: 'h2' | 'h3';
  tone?: Tone;
}) {
  const Heading = headingLevel;
  return (
    <div
      className={cn(
        'grid gap-5',
        plans.length > 3 ? 'md:grid-cols-2 xl:grid-cols-4' : 'lg:grid-cols-3',
      )}
    >
      {plans.map((plan, idx) => {
        const featured = plan.featured;
        const href = plan.selfServe ? `/signup?plan=${plan.code}` : `/contact?plan=${plan.code}`;
        // True when the card's own background is dark, so its text must be light.
        const onDark = tone === 'dark' ? !featured : featured;
        return (
          <Reveal key={plan.code} delay={idx * 110} variant="zoom" className="h-full">
            <Spotlight className="h-full rounded-xl hover:shadow-lg">
              <article
                className={cn(
                  'relative flex h-full flex-col rounded-xl p-8',
                  tone === 'dark'
                    ? featured
                      ? 'bg-white text-ink shadow-[0_0_80px_-10px_rgb(var(--pv-violet-500)/0.6)]'
                      : 'glass-dark rounded-xl'
                    : featured
                      ? 'bg-night text-white shadow-lg ring-1 ring-brand-500/40'
                      : 'border border-line bg-surface shadow',
                )}
              >
                {featured && tone === 'light' && (
                  <div
                    className="light-beam pointer-events-none absolute inset-0 rounded-xl opacity-70"
                    aria-hidden="true"
                  />
                )}
                {featured && (
                  <span
                    className={cn(
                      'absolute right-6 top-6 animate-tick rounded-pill px-3 py-1 text-xs font-semibold',
                      tone === 'dark' ? 'bg-ink text-white' : 'bg-brand-500/20 text-brand-200',
                    )}
                  >
                    Most popular
                  </span>
                )}
                <div className="relative">
                  <Heading className={cn('text-lg font-bold', onDark && 'text-white')}>
                    {plan.name}
                  </Heading>
                  <p
                    className={cn(
                      'mt-1 min-h-[44px] text-sm',
                      onDark ? 'text-white/60' : 'text-muted',
                    )}
                  >
                    {plan.tagline}
                  </p>
                  <p className="mt-6 flex items-baseline gap-1.5">
                    <span
                      className={cn(
                        'num text-5xl font-light tracking-tight',
                        onDark ? 'text-white' : 'text-ink',
                      )}
                    >
                      {formatMoney(plan.priceMonthlyCents)}
                    </span>
                    {plan.priceMonthlyCents !== null && (
                      <span className={onDark ? 'text-white/55' : 'text-muted'}>/ month</span>
                    )}
                  </p>
                  <p
                    className={cn(
                      'mt-2 text-sm font-medium',
                      onDark ? 'text-brand-200' : 'text-brand-700',
                    )}
                  >
                    {plan.includedMinutes !== null
                      ? `Up to ${formatNumber(plan.includedMinutes)} call minutes`
                      : 'Volume minute pricing'}
                  </p>
                  <Link
                    href={href}
                    className={cn(
                      'btn btn-lg mt-7 w-full gap-2',
                      tone === 'dark'
                        ? featured
                          ? 'btn-primary'
                          : 'btn-white'
                        : featured
                          ? 'btn-magic'
                          : plan.selfServe
                            ? 'btn-primary'
                            : 'btn-secondary',
                    )}
                  >
                    {plan.priceMonthlyCents === 0
                      ? 'Start free'
                      : plan.selfServe
                        ? `Choose ${plan.name}`
                        : 'Talk to sales'}
                    {tone === 'dark' && <ArrowUpRight size={16} aria-hidden="true" />}
                  </Link>
                  <ul className="mt-8 space-y-3">
                    {plan.highlights.map((h) => (
                      <li
                        key={h}
                        className={cn(
                          'flex gap-3 text-sm',
                          onDark ? 'text-white/80' : 'text-ink-soft',
                        )}
                      >
                        <Check
                          size={16}
                          className={cn(
                            'mt-0.5 shrink-0',
                            onDark ? 'text-brand-300' : 'text-brand-600',
                          )}
                          aria-hidden="true"
                        />
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </Spotlight>
          </Reveal>
        );
      })}
    </div>
  );
}

export function PhoneBillingNote({ tone = 'light' }: { tone?: Tone }) {
  return (
    <p className={cn('mt-8 text-center text-sm', tone === 'dark' ? 'text-white/45' : 'text-muted')}>
      Phone number rental and AI usage are billed separately and are not included in any plan.
    </p>
  );
}

const METHODS = ['UPI', 'RuPay', 'Visa', 'Mastercard', 'Net banking', 'Cards'];

/** Tells the buyer how they pay and that it is safe, right under the plans. */
export function PaymentTrust({ tone = 'light' }: { tone?: Tone }) {
  const dark = tone === 'dark';
  return (
    <Reveal className="mx-auto mt-10 max-w-3xl">
      <div
        className={cn(
          'p-6 text-center',
          dark ? 'glass-dark' : 'rounded-lg border border-line bg-surface shadow',
        )}
      >
        <p
          className={cn(
            'flex items-center justify-center gap-2 text-sm font-semibold',
            dark ? 'text-white' : 'text-ink',
          )}
        >
          <Lock
            size={15}
            className={dark ? 'text-brand-300' : 'text-brand-600'}
            aria-hidden="true"
          />
          Secure checkout by Razorpay
        </p>
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {METHODS.map((m) => (
            <li
              key={m}
              className={cn(
                'rounded-pill px-3.5 py-1.5 text-xs font-semibold',
                dark ? 'bg-white/10 text-white/80' : 'bg-brand-50 text-brand-800',
              )}
            >
              {m}
            </li>
          ))}
        </ul>
        <p
          className={cn(
            'mt-4 flex items-start justify-center gap-2 text-sm leading-relaxed',
            dark ? 'text-white/55' : 'text-muted',
          )}
        >
          <ShieldCheck
            size={16}
            className={cn('mt-0.5 shrink-0', dark ? 'text-emerald-400' : 'text-success')}
            aria-hidden="true"
          />
          <span>
            Billed monthly, cancel any time from your dashboard. Plans are priced in US dollars; in
            India you are charged the rupee equivalent, and you can add your GSTIN at checkout for a
            GST invoice. Your card or UPI details go to Razorpay, never to us.
          </span>
        </p>
      </div>
    </Reveal>
  );
}
