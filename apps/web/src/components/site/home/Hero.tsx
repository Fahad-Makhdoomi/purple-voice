import Link from 'next/link';
import { ArrowRight, CalendarCheck, PhoneIncoming, Sparkles } from 'lucide-react';

/**
 * Dark hero: night sky, a violet light beam and a glowing voice orb ringed
 * by glass cards that show what the product does. Built entirely from CSS
 * gradients and inline SVG, so the largest paint has no image to wait for.
 */
export function Hero() {
  return (
    <section className="relative isolate overflow-hidden bg-night pb-20 text-white sm:pb-28">
      <div className="starfield absolute inset-0 -z-10 opacity-70" aria-hidden="true" />
      <div
        className="light-beam absolute -left-1/4 top-0 -z-10 h-[140%] w-[110%] opacity-80"
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 bottom-0 -z-10 h-64 bg-gradient-to-t from-night to-transparent"
        aria-hidden="true"
      />

      <div className="container pt-[calc(var(--pv-header-h)+56px)] text-center sm:pt-[calc(var(--pv-header-h)+80px)]">
        <Link
          href="/blog/realtime-vs-cascaded-voice"
          className="inline-flex animate-rise items-center gap-2 rounded-pill border border-brand-400/30 bg-brand-500/10 px-4 py-1.5 text-[13px] font-medium text-brand-200 transition hover:border-brand-300/60"
        >
          <Sparkles size={14} aria-hidden="true" />
          Works with GPT Realtime, Claude and Gemini
          <ArrowRight size={14} aria-hidden="true" />
        </Link>

        <h1 className="mx-auto mt-6 max-w-4xl animate-rise text-display font-semibold text-white [animation-delay:60ms]">
          AI voice agents that call, qualify and book for you
        </h1>
        <p className="mx-auto mt-6 max-w-2xl animate-rise text-lead text-white/65 [animation-delay:120ms]">
          Purple Voice runs your sales calls around the clock — on your own phone numbers, with the
          AI model you choose. Every call ends with a summary, an outcome and, more often, a booked
          meeting.
        </p>
        <div className="mt-10 flex animate-rise flex-col items-center justify-center gap-3 [animation-delay:180ms] sm:flex-row">
          <Link href="/signup" className="btn btn-magic btn-lg min-w-[220px]">
            Start for $19 / month
          </Link>
          <Link href="/#how-it-works" className="btn btn-glass btn-lg min-w-[200px]">
            See how it works
          </Link>
        </div>
      </div>

      <HeroOrb />
    </section>
  );
}

function HeroOrb() {
  return (
    <div className="container relative mt-16 sm:mt-20" aria-hidden="true">
      <div className="relative mx-auto h-[340px] max-w-[980px] sm:h-[460px]">
        {/* Glow */}
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2">
          <div className="h-full w-full animate-pulse rounded-full bg-[radial-gradient(circle,rgb(var(--pv-violet-500)/0.55),transparent_62%)]" />
        </div>
        {/* Orb */}
        <svg
          viewBox="0 0 300 300"
          className="absolute left-1/2 top-1/2 h-[230px] w-[230px] -translate-x-1/2 -translate-y-1/2 sm:h-[300px] sm:w-[300px]"
        >
          <defs>
            <radialGradient id="hero-orb" cx="40%" cy="32%" r="70%">
              <stop offset="0%" stopColor="rgb(var(--pv-violet-200))" />
              <stop offset="35%" stopColor="rgb(var(--pv-violet-500))" />
              <stop offset="80%" stopColor="rgb(var(--pv-violet-800))" />
              <stop offset="100%" stopColor="rgb(var(--pv-violet-950))" />
            </radialGradient>
          </defs>
          <circle cx="150" cy="150" r="120" fill="url(#hero-orb)" />
          <g fill="none" stroke="white" strokeOpacity="0.28" strokeWidth="1">
            <ellipse cx="150" cy="150" rx="40" ry="120" />
            <ellipse cx="150" cy="150" rx="80" ry="120" />
            <ellipse cx="150" cy="150" rx="120" ry="40" />
            <ellipse cx="150" cy="150" rx="120" ry="80" />
            <line x1="150" y1="30" x2="150" y2="270" />
          </g>
          <g className="origin-center animate-orbit [transform-box:fill-box]">
            <ellipse
              cx="150"
              cy="150"
              rx="148"
              ry="46"
              fill="none"
              stroke="rgb(var(--pv-violet-300))"
              strokeOpacity="0.6"
              transform="rotate(-18 150 150)"
            />
          </g>
          <circle cx="112" cy="104" r="34" fill="white" opacity="0.12" />
        </svg>

        {/* Floating glass cards */}
        <div className="glass absolute left-0 top-2 hidden w-56 animate-float p-4 text-left sm:block">
          <p className="text-xs text-white/55">Calls today</p>
          <p className="num mt-1 text-2xl font-semibold">1,284</p>
          <div className="mt-3 flex h-12 items-end gap-1.5">
            {[30, 45, 38, 60, 52, 78, 95].map((h, i) => (
              <span
                key={i}
                className="flex-1 rounded-t bg-gradient-to-t from-brand-700 to-brand-300"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>

        <div className="glass absolute right-0 top-6 hidden w-60 animate-float p-4 text-left [animation-delay:1.5s] sm:block">
          <div className="flex items-center gap-2 text-xs text-white/55">
            <CalendarCheck size={14} /> Appointment booked
          </div>
          <p className="mt-2 text-sm font-semibold">Tue, 10:30 — Solar consult</p>
          <p className="mt-1 text-xs text-white/50">Dana R. · invite sent</p>
        </div>

        <div className="glass absolute bottom-0 left-[6%] hidden w-64 animate-float p-4 text-left [animation-delay:3s] sm:block">
          <div className="flex items-center gap-2 text-xs text-white/55">
            <PhoneIncoming size={14} /> Live transcript
          </div>
          <p className="mt-2 rounded-sm bg-white/[0.07] px-3 py-2 text-xs text-white/80">
            “Can we do Tuesday morning?”
          </p>
          <p className="mt-1.5 rounded-sm bg-brand-500/30 px-3 py-2 text-xs text-white">
            “Tuesday at 10:30 is open. Shall I book it?”
          </p>
        </div>

        <div className="glass absolute bottom-4 right-[4%] hidden w-56 animate-float p-4 text-left [animation-delay:2.2s] sm:block">
          <span className="rounded-pill border border-white/15 bg-white/10 px-2.5 py-1 text-[11px]">
            Pipeline: $16,900
          </span>
          <svg viewBox="0 0 200 70" className="mt-3 h-14 w-full">
            <defs>
              <linearGradient id="hero-area" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--pv-violet-300))" stopOpacity="0.8" />
                <stop offset="100%" stopColor="rgb(var(--pv-violet-700))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 62 L30 55 L60 58 L90 40 L120 44 L150 24 L180 18 L200 4 L200 70 L0 70Z"
              fill="url(#hero-area)"
            />
            <path
              d="M0 62 L30 55 L60 58 L90 40 L120 44 L150 24 L180 18 L200 4"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
            />
          </svg>
        </div>
      </div>

      {/* On phones the floating cards collapse into a simple stat row. */}
      <dl className="mx-auto grid max-w-sm grid-cols-3 gap-3 text-center sm:hidden">
        {[
          ['1,284', 'calls today'],
          ['0.4s', 'to answer'],
          ['31%', 'booked'],
        ].map(([value, label]) => (
          <div key={label} className="glass px-2 py-3">
            <dt className="sr-only">{label}</dt>
            <dd className="num text-lg font-semibold text-white">{value}</dd>
            <dd className="text-[11px] text-white/55">{label}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
