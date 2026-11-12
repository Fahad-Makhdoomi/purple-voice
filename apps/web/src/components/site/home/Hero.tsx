import Image from '@/components/ui/Image';
import Link from 'next/link';
import { ArrowUpRight, Check, Play } from 'lucide-react';
import { contentSettingsSchema, type ContentSettings, type SiteTheme } from '@pv/shared';
import { DashboardMock } from '@/components/site/home/DashboardMock';
import { MinimalStage } from '@/components/site/home/MinimalStage';
import { PlaySampleButton } from '@/components/site/home/SampleCall';
import { SAMPLE_CALL } from '@/components/site/home/sample-call';

type HeroText = ContentSettings['hero'];
/** Built-in copy, used until it is edited in Admin → Site settings. */
const DEFAULT_COPY: HeroText = contentSettingsSchema.parse({}).hero;

const ASSURANCES = [
  'Runs on your own phone numbers',
  '7-day free trial, then $5 a month',
  'Cancel any time',
];

/**
 * The home hero. Every theme shows the same copy, voice bar and dashboard;
 * what fills the stage between the copy and the dashboard is the theme's.
 */
export function Hero({
  theme = 'default',
  copy = DEFAULT_COPY,
}: {
  theme?: SiteTheme;
  copy?: HeroText;
}) {
  if (theme === 'kawaii') return <KawaiiHero copy={copy} />;
  if (theme === 'minimal') return <MinimalHero copy={copy} />;
  return <DefaultHero copy={copy} />;
}

function HeroCopy({
  copy,
  vignette = false,
  wordByWord = false,
}: {
  copy: HeroText;
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
        {copy.badge}
      </p>

      <h1 className="mx-auto mt-7 max-w-5xl animate-rise text-white text-[length:clamp(44px,8.4vw,108px)] font-medium leading-[0.98] tracking-[-0.045em] [animation-delay:60ms]">
        {wordByWord
          ? copy.title.split(' ').map((word, i, words) => (
              <span key={i}>
                {i > 0 && ' '}
                <span
                  // The last word carries the accent sweep.
                  className={i === words.length - 1 ? 'hero-word hero-word--accent' : 'hero-word'}
                  style={{ '--i': i } as React.CSSProperties}
                >
                  {word}
                </span>
              </span>
            ))
          : copy.title}
      </h1>
      <p className="mx-auto mt-7 max-w-2xl animate-rise text-lead text-white/70 [animation-delay:120ms]">
        {copy.subtitle}
      </p>

      <div className="mt-10 flex animate-rise flex-col items-center justify-center gap-3 [animation-delay:180ms] sm:flex-row">
        <Link href={copy.primaryHref} className="btn btn-white btn-lg min-w-[220px] gap-2">
          {copy.primaryLabel}
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black text-white">
            <ArrowUpRight size={14} />
          </span>
        </Link>
        {/* The sample call lives on this page: play it rather than just jump to it. */}
        {/#(demo|listen)$/.test(copy.secondaryHref) ? (
          <PlaySampleButton className="btn btn-dark btn-lg min-w-[200px] gap-2">
            <Play size={15} fill="currentColor" aria-hidden="true" />
            {copy.secondaryLabel}
          </PlaySampleButton>
        ) : (
          <Link href={copy.secondaryHref} className="btn btn-dark btn-lg min-w-[200px]">
            {copy.secondaryLabel}
          </Link>
        )}
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

/** Every third slice of the sample call's loudness: a still picture of the real recording. */
const MINI_PEAKS = SAMPLE_CALL.peaks.filter((_, i) => i % 3 === 0);

/** A call-recording chip: press it to hear the sample call further down the page. */
function VoiceBar() {
  return (
    <PlaySampleButton className="glass-dark group flex h-14 w-full max-w-md items-center gap-3 rounded-pill pl-2 pr-6 text-left transition hover:-translate-y-0.5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition group-hover:bg-brand-700">
        <Play size={16} fill="currentColor" className="translate-x-[1px]" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-white">
          Hear Ava book a meeting
        </span>
        <span className="block text-[11px] text-white/50">Sample call · 0:50</span>
      </span>
      <span
        className="ml-auto flex h-6 w-28 items-center gap-[2px] text-white sm:w-36"
        aria-hidden="true"
      >
        {MINI_PEAKS.map((p, i) => (
          <span
            key={i}
            className="block flex-1 rounded-full bg-current opacity-35"
            style={{ height: `${Math.max(10, p * 100)}%` }}
          />
        ))}
      </span>
    </PlaySampleButton>
  );
}

/**
 * Black hero: a huge, tightly set headline over the glowing particle
 * sculpture (drawn once for the whole page), a live voice bar and the
 * product dashboard tilting up out of the page.
 */
function DefaultHero({ copy }: { copy: HeroText }) {
  return (
    <section className="relative pb-10 text-center text-white sm:pb-16">
      <HeroCopy copy={copy} vignette />

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
function KawaiiHero({ copy }: { copy: HeroText }) {
  return (
    <section className="kawaii-hero relative isolate pb-10 text-center text-white sm:pb-16">
      <HeroCopy copy={copy} />

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
function MinimalHero({ copy }: { copy: HeroText }) {
  return (
    <section className="relative pb-10 text-center text-white sm:pb-16">
      <HeroCopy copy={copy} wordByWord />

      <div className="relative mt-4 h-[340px] sm:mt-6 sm:h-[480px]" aria-hidden="true">
        <MinimalStage>
          <div className="container relative flex h-full items-end justify-center pb-4">
            <VoiceBar />
          </div>
        </MinimalStage>
      </div>

      {/* Tilts up into place as it scrolls into view (minimal.css). */}
      <div className="container mt-6 [perspective:1600px]">
        <div className="dash-tilt">
          <DashboardMock />
        </div>
      </div>
    </section>
  );
}
