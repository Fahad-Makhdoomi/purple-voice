import Link from 'next/link';
import { ArrowUpRight, Check, Landmark, Lock, ShieldCheck } from 'lucide-react';
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
  maxHighlights,
}: {
  plans: PublicPlan[];
  headingLevel?: 'h2' | 'h3';
  tone?: Tone;
  /** Show only the first few highlights (the home page); /pricing lists them all. */
  maxHighlights?: number;
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
                      'absolute right-6 top-6 rounded-pill px-3 py-1 text-xs font-semibold',
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
                    {plan.code === 'FREE'
                      ? 'Start free trial'
                      : plan.selfServe
                        ? `Choose ${plan.name}`
                        : 'Talk to sales'}
                    {tone === 'dark' && <ArrowUpRight size={16} aria-hidden="true" />}
                  </Link>
                  <ul className="mt-8 space-y-3">
                    {plan.highlights.slice(0, maxHighlights).map((h) => (
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
                  {maxHighlights !== undefined && plan.highlights.length > maxHighlights && (
                    <p className={cn('mt-3 pl-7 text-sm', onDark ? 'text-white/45' : 'text-muted')}>
                      + {plan.highlights.length - maxHighlights} more
                    </p>
                  )}
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
    <p
      className={cn(
        'mx-auto mt-8 max-w-2xl text-center text-sm',
        tone === 'dark' ? 'text-white/45' : 'text-muted',
      )}
    >
      Plan minutes are the time your agents spend on calls each month. Phone numbers and call
      charges are billed by your carrier (Twilio, Plivo, Telnyx and others), and AI usage is billed
      separately.
    </p>
  );
}

/** How a subscriber can pay at Razorpay checkout. Logos live in public/images/payments. */
const METHODS: Array<{ src: string; alt: string; w: number; label?: boolean }> = [
  { src: '/images/payments/upi.svg', alt: 'UPI', w: 52 },
  { src: '/images/payments/google-pay.svg', alt: 'Google Pay', w: 50 },
  { src: '/images/payments/phonepe.svg', alt: 'PhonePe', w: 20, label: true },
  { src: '/images/payments/visa.svg', alt: 'Visa', w: 50 },
  { src: '/images/payments/mastercard.svg', alt: 'Mastercard', w: 38 },
  { src: '/images/payments/rupay.svg', alt: 'RuPay', w: 62 },
];

/** Tells the buyer how they pay and that it is safe, right under the plans. */
export function PaymentTrust({ tone = 'light' }: { tone?: Tone }) {
  const dark = tone === 'dark';
  return (
    <Reveal className="mx-auto mt-10 max-w-4xl">
      <div
        className={cn(
          'grid items-center gap-6 p-6 sm:grid-cols-[auto_1fr] sm:gap-8 sm:p-7',
          dark ? 'glass-dark' : 'rounded-lg border border-line bg-surface shadow',
        )}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0C2451]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/payments/razorpay.svg" alt="" width={22} height={22} />
          </span>
          <span>
            <span
              className={cn(
                'flex items-center gap-1.5 text-sm font-semibold',
                dark ? 'text-white' : 'text-ink',
              )}
            >
              <Lock size={13} aria-hidden="true" /> Secure checkout
            </span>
            <span className={cn('block text-xs', dark ? 'text-white/50' : 'text-muted')}>
              Payments by Razorpay
            </span>
          </span>
        </div>

        <ul className="flex flex-wrap items-center gap-2" aria-label="Accepted payment methods">
          {METHODS.map((m) => (
            <li
              key={m.alt}
              className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 shadow-[0_1px_2px_rgb(0_0_0/0.06)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={m.src}
                alt={m.label ? '' : m.alt}
                width={m.w}
                height={20}
                className="h-5 w-auto"
              />
              {m.label && <span className="text-xs font-semibold text-[#5F259F]">{m.alt}</span>}
            </li>
          ))}
          <li className="flex h-10 items-center gap-1.5 rounded-lg border border-black/[0.08] bg-white px-3 text-xs font-semibold text-[#3C4043] shadow-[0_1px_2px_rgb(0_0_0/0.06)]">
            <Landmark size={15} aria-hidden="true" /> Net banking
          </li>
        </ul>

        <p
          className={cn(
            'flex items-start gap-2 text-sm leading-relaxed sm:col-span-2',
            dark ? 'text-white/55' : 'text-muted',
          )}
        >
          <ShieldCheck
            size={16}
            className={cn('mt-0.5 shrink-0', dark ? 'text-emerald-400' : 'text-success')}
            aria-hidden="true"
          />
          <span>
            Billed monthly; cancel any time from your dashboard. Prices are in US dollars. In India
            you pay the rupee equivalent and can add your GSTIN for a GST invoice. Card and UPI
            details go to Razorpay, never to us.
          </span>
        </p>
      </div>
    </Reveal>
  );
}
