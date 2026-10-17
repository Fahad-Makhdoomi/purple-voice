import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Check } from 'lucide-react';
import type { SiteTheme } from '@pv/shared';
import { DashboardMock } from '@/components/site/home/DashboardMock';
import { Waveform } from '@/components/site/motion';
import { SunScene } from '@/components/site/SunScene';

const TITLE = 'Turn every lead into a booked meeting.';

const ASSURANCES = [
  'Runs on your own phone numbers',
  'Pay by UPI, card or net banking',
  'Cancel any time',
];

/**
 * The home hero. Every theme shows the same copy, voice bar and dashboard;
 * what fills the stage between the copy and the dashboard is the theme's.
 */
export function Hero({ theme = 'default' }: { theme?: SiteTheme }) {
  if (theme === 'kawaii') return <KawaiiHero />;
  if (theme === 'minimal') return <MinimalHero />;
  return <DefaultHero />;
}

function HeroCopy({
  vignette = false,
  wordByWord = false,
}: {
  vignette?: boolean;
  /** Wrap each word so a theme can stagger them in (Minimal does). */
  wordByWord?: boolean;
}) {
  return (
    <div className="container relative pt-[calc(var(--pv-header-h)+64px)] sm:pt-[calc(var(--pv-header-h)+96px)]">
      {vignette && (
        <div
          className="pointer-events-none absolute inset-x-0 top-24 -z-10 mx-auto h-[420px] max-w-4xl bg-[radial-gradient(closest-side,rgb(0_0_0/0.62),transparent)]"
          aria-hidden="true"
        />
      )}
      <p className="mx-auto w-fit animate-rise rounded-pill border border-white/15 bg-white/[0.06] px-4 py-1.5 text-[13px] font-medium text-white/75 backdrop-blur">
        Now with natural, human-sounding voices
      </p>

      <h1 className="mx-auto mt-7 max-w-5xl animate-rise text-white text-[length:clamp(44px,8.4vw,108px)] font-medium leading-[0.98] tracking-[-0.045em] [animation-delay:60ms]">
        {wordByWord
          ? TITLE.split(' ').map((word, i) => (
              <span key={i}>
                {i > 0 && ' '}
                <span className="hero-word" style={{ '--i': i } as React.CSSProperties}>
                  {word}
                </span>
              </span>
            ))
          : TITLE}
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
  );
}

function VoiceBar() {
  return (
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
  );
}

/**
 * Black hero: a huge, tightly set headline over the glowing particle
 * sculpture (drawn once for the whole page), a live voice bar and the
 * product dashboard tilting up out of the page.
 */
function DefaultHero() {
  return (
    <section className="relative pb-10 text-center text-white sm:pb-16">
      <HeroCopy vignette />

      {/* Breathing room for the sculpture, with a live voice bar in front of it. */}
      <div
        className="container relative mt-10 flex h-[260px] items-end justify-center sm:h-[340px]"
        aria-hidden="true"
      >
        <VoiceBar />
      </div>

      <div className="container mt-6">
        <DashboardMock />
      </div>
    </section>
  );
}

/**
 * Kawaii: the stage is a lone tree in a pastel sea — a seamless 16 s loop
 * (1.3 MB) that feathers into the page above and below. The poster paints
 * first and is all that shows under reduced motion.
 */
function KawaiiHero() {
  return (
    <section className="kawaii-hero relative isolate pb-10 text-center text-white sm:pb-16">
      <HeroCopy />

      <div className="relative -mt-6 h-[400px] sm:-mt-10 sm:h-[560px]" aria-hidden="true">
        <div className="absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,transparent,black_26%,black_74%,transparent)]">
          <Image
            src="/images/themes/kawaii/hero.webp"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <video
            className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
            src="/video/themes/kawaii/hero.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
          />
        </div>
        <div className="container flex h-full items-end justify-center pb-4">
          <VoiceBar />
        </div>
      </div>

      <div className="container mt-6">
        <DashboardMock />
      </div>
    </section>
  );
}

/**
 * Minimal: the stage is a coral sun rising through pastel clouds with a
 * vapour trail climbing into it (SunScene, pure CSS). The headline's words
 * rise in one by one.
 */
function MinimalHero() {
  return (
    <section className="relative pb-10 text-center text-white sm:pb-16">
      <HeroCopy wordByWord />

      <div className="relative mt-4 h-[340px] sm:mt-6 sm:h-[480px]" aria-hidden="true">
        <SunScene />
        <div className="container relative flex h-full items-end justify-center pb-4">
          <VoiceBar />
        </div>
      </div>

      <div className="container mt-6">
        <DashboardMock />
      </div>
    </section>
  );
}
