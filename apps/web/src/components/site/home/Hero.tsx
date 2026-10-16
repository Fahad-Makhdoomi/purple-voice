import Link from 'next/link';
import { ArrowUpRight, Check } from 'lucide-react';
import { DashboardMock } from '@/components/site/home/DashboardMock';
import { Waveform } from '@/components/site/motion';

const ASSURANCES = [
  'Runs on your own phone numbers',
  'Pay by UPI, card or net banking',
  'Cancel any time',
];

/**
 * Black hero: a huge, tightly set headline over the glowing particle
 * sculpture (drawn once for the whole page), a live voice bar and the
 * product dashboard tilting up out of the page.
 */
export function Hero() {
  return (
    <section className="relative pb-10 text-center text-white sm:pb-16">
      <div className="container relative pt-[calc(var(--pv-header-h)+64px)] sm:pt-[calc(var(--pv-header-h)+96px)]">
        <div
          className="pointer-events-none absolute inset-x-0 top-24 -z-10 mx-auto h-[420px] max-w-4xl bg-[radial-gradient(closest-side,rgb(0_0_0/0.62),transparent)]"
          aria-hidden="true"
        />
        <p className="mx-auto w-fit animate-rise rounded-pill border border-white/15 bg-white/[0.06] px-4 py-1.5 text-[13px] font-medium text-white/75 backdrop-blur">
          Now with GPT Realtime, Claude and Gemini
        </p>

        <h1 className="mx-auto mt-7 max-w-5xl animate-rise text-white text-[length:clamp(44px,8.4vw,108px)] font-medium leading-[0.98] tracking-[-0.045em] [animation-delay:60ms]">
          Turn every lead into a booked meeting.
        </h1>
        <p className="mx-auto mt-7 max-w-2xl animate-rise text-lead text-white/70 [animation-delay:120ms]">
          Purple Voice builds AI agents that phone your leads, answer their questions and put
          appointments straight into your calendar — on your own phone numbers, around the clock.
        </p>

        <div className="mt-10 flex animate-rise flex-col items-center justify-center gap-3 [animation-delay:180ms] sm:flex-row">
          <Link href="/signup?plan=BASIC" className="btn btn-white btn-lg min-w-[220px] gap-2">
            Start for $19 / month
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-white">
              <ArrowUpRight size={14} />
            </span>
          </Link>
          <Link href="/#demo" className="btn btn-dark btn-lg min-w-[200px]">
            Hear a sample call
          </Link>
        </div>
        <ul className="mt-7 flex animate-rise flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-white/55 [animation-delay:240ms]">
          {ASSURANCES.map((a) => (
            <li key={a} className="flex items-center gap-1.5">
              <Check size={14} className="text-emerald-400" aria-hidden="true" /> {a}
            </li>
          ))}
        </ul>
      </div>

      {/* Breathing room for the sculpture, with a live voice bar in front of it. */}
      <div
        className="container relative mt-10 flex h-[260px] items-end justify-center sm:h-[340px]"
        aria-hidden="true"
      >
        <div className="glass-dark flex h-14 w-full max-w-md items-center gap-4 rounded-pill px-6">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
          </span>
          <span className="text-xs font-semibold text-white/80">Ava is on a call</span>
          <span className="ml-auto h-6 w-32 sm:w-40">
            <Waveform bars={28} />
          </span>
        </div>
      </div>

      <div className="container mt-6">
        <DashboardMock />
      </div>
    </section>
  );
}
