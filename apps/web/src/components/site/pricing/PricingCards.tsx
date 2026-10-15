import Link from 'next/link';
import { Check } from 'lucide-react';
import { formatMoney, formatNumber } from '@/lib/format';
import type { PublicPlan } from '@/lib/server-api';
import { cn } from '@/lib/cn';

/**
 * Plan cards, shared by the home page and /pricing. Prices come from the
 * admin-editable plan table. `headingLevel` keeps the document outline in
 * order: h3 under a section's h2 on the home page, h2 straight under /pricing's h1.
 */
export function PricingCards({
  plans,
  headingLevel = 'h3',
}: {
  plans: PublicPlan[];
  headingLevel?: 'h2' | 'h3';
}) {
  const Heading = headingLevel;
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      {plans.map((plan) => {
        const featured = plan.featured;
        const href = plan.selfServe ? `/signup?plan=${plan.code}` : `/contact?plan=${plan.code}`;
        return (
          <article
            key={plan.code}
            className={cn(
              'relative flex flex-col rounded-xl p-8',
              featured
                ? 'bg-night text-white shadow-lg ring-1 ring-brand-500/40'
                : 'border border-line bg-surface shadow',
            )}
          >
            {featured && (
              <>
                <div
                  className="light-beam pointer-events-none absolute inset-0 rounded-xl opacity-70"
                  aria-hidden="true"
                />
                <span className="absolute right-6 top-6 rounded-pill bg-brand-500/20 px-3 py-1 text-xs font-semibold text-brand-200">
                  Most popular
                </span>
              </>
            )}
            <div className="relative">
              <Heading className={cn('text-lg font-bold', featured && 'text-white')}>
                {plan.name}
              </Heading>
              <p
                className={cn(
                  'mt-1 min-h-[44px] text-sm',
                  featured ? 'text-white/60' : 'text-muted',
                )}
              >
                {plan.tagline}
              </p>
              <p className="mt-6 flex items-baseline gap-1.5">
                <span
                  className={cn(
                    'num text-5xl font-light tracking-tight',
                    featured ? 'text-white' : 'text-ink',
                  )}
                >
                  {formatMoney(plan.priceMonthlyCents)}
                </span>
                {plan.priceMonthlyCents !== null && (
                  <span className={featured ? 'text-white/55' : 'text-muted'}>/ month</span>
                )}
              </p>
              <p
                className={cn(
                  'mt-2 text-sm font-medium',
                  featured ? 'text-brand-200' : 'text-brand-700',
                )}
              >
                {plan.includedMinutes !== null
                  ? `Up to ${formatNumber(plan.includedMinutes)} call minutes`
                  : 'Volume minute pricing'}
              </p>
              <Link
                href={href}
                className={cn(
                  'btn btn-lg mt-7 w-full',
                  featured ? 'btn-magic' : plan.selfServe ? 'btn-primary' : 'btn-secondary',
                )}
              >
                {plan.selfServe ? `Choose ${plan.name}` : 'Talk to sales'}
              </Link>
              <ul className="mt-8 space-y-3">
                {plan.highlights.map((h) => (
                  <li
                    key={h}
                    className={cn(
                      'flex gap-3 text-sm',
                      featured ? 'text-white/80' : 'text-ink-soft',
                    )}
                  >
                    <Check
                      size={16}
                      className={cn(
                        'mt-0.5 shrink-0',
                        featured ? 'text-brand-300' : 'text-brand-600',
                      )}
                      aria-hidden="true"
                    />
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function PhoneBillingNote() {
  return (
    <p className="mt-8 text-center text-sm text-muted">
      Phone number rental is billed separately by your carrier (Twilio, Plivo or SuperPhone) and is
      not included in any plan. AI model usage is billed by your AI provider on your own key.
    </p>
  );
}
