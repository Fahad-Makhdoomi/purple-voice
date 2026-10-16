import Link from 'next/link';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { HeroStage } from '@/components/site/home/HeroStage';

const ASSURANCES = [
  'Runs on your own phone numbers',
  'Pay by UPI, card or net banking',
  'Cancel any time',
];

/**
 * Dark hero: night sky, drifting aurora, a violet light beam and a living
 * voice orb ringed by glass cards. Built from CSS gradients and inline SVG,
 * so the largest paint has no image to wait for.
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-night pb-16 text-white sm:pb-24">
      <div className="starfield absolute inset-0 -z-10 opacity-70" aria-hidden="true" />
      <div className="dot-grid absolute inset-0 -z-10" aria-hidden="true" />
      <div
        className="light-beam absolute -left-1/4 top-0 -z-10 h-[140%] w-[110%] opacity-80"
        aria-hidden="true"
      />
      <div
        className="absolute -right-24 top-24 -z-10 h-[420px] w-[420px] animate-aurora rounded-full bg-[radial-gradient(closest-side,rgb(var(--pv-violet-500)/0.35),transparent)] blur-2xl"
        aria-hidden="true"
      />
      <div
        className="absolute -left-32 top-[38%] -z-10 h-[380px] w-[380px] animate-aurora rounded-full bg-[radial-gradient(closest-side,rgb(var(--pv-cyan-300)/0.16),transparent)] blur-2xl [animation-delay:-9s]"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 bottom-0 -z-10 h-64 bg-gradient-to-t from-night to-transparent"
        aria-hidden="true"
      />

      <div className="container pt-[calc(var(--pv-header-h)+48px)] text-center sm:pt-[calc(var(--pv-header-h)+72px)]">
        <Link
          href="/blog/realtime-vs-cascaded-voice"
          className="inline-flex animate-rise items-center gap-2 rounded-pill border border-brand-400/30 bg-brand-500/10 px-4 py-1.5 text-[13px] font-medium text-brand-200 backdrop-blur transition hover:border-brand-300/60"
        >
          <Sparkles size={14} aria-hidden="true" />
          Works with GPT Realtime, Claude and Gemini
          <ArrowRight size={14} aria-hidden="true" />
        </Link>

        <h1 className="mx-auto mt-6 max-w-4xl animate-rise text-display font-semibold text-white [animation-delay:60ms]">
          An AI caller that <span className="text-shimmer">qualifies your leads</span> and books the
          meeting
        </h1>
        <p className="mx-auto mt-6 max-w-2xl animate-rise text-lead text-white/70 [animation-delay:120ms]">
          Purple Voice is a platform for building AI voice agents that phone your leads, answer
          their questions and put appointments straight into your calendar — on your own phone
          numbers, around the clock. Hot prospects are handed to your team live.
        </p>
        <div className="mt-9 flex animate-rise flex-col items-center justify-center gap-3 [animation-delay:180ms] sm:flex-row">
          <Link href="/signup?plan=BASIC" className="btn btn-magic btn-lg min-w-[230px]">
            Start for $19 / month
          </Link>
          <Link href="/#demo" className="btn btn-glass btn-lg min-w-[200px]">
            Hear a sample call
          </Link>
        </div>
        <ul className="mt-6 flex animate-rise flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-white/60 [animation-delay:240ms]">
          {ASSURANCES.map((a) => (
            <li key={a} className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-400" aria-hidden="true" /> {a}
            </li>
          ))}
        </ul>
      </div>

      <HeroStage />
    </section>
  );
}
