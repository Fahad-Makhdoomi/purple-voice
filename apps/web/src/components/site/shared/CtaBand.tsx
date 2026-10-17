import Image from 'next/image';
import Link from 'next/link';
import { getAppearance } from '@/lib/server-api';
import { SunScene } from '@/components/site/SunScene';
import { cn } from '@/lib/cn';

/** The closing call to action. Same words in every theme; the backdrop follows the theme. */
export async function CtaBand({
  title = 'Put your first agent on the phone today',
  body = 'Start on Basic for $19 a month. Upgrade to Pro when you need more agents, numbers and campaigns.',
}: {
  title?: string;
  body?: string;
}) {
  const { theme } = await getAppearance();
  const kawaii = theme === 'kawaii';
  // Minimal is a light band: `landing` lets light-landing.css invert its colours.
  const minimal = theme === 'minimal';

  return (
    <section className="bg-canvas px-gutter pb-section">
      <div
        className={cn(
          'relative isolate mx-auto max-w-container overflow-hidden rounded-xl px-6 py-16 text-center text-white sm:px-12 sm:py-20',
          minimal ? 'landing border border-line bg-gradient-wash sm:pb-56' : 'bg-night',
        )}
      >
        {minimal ? (
          <div className="absolute inset-x-0 bottom-0 -z-10 h-[62%]">
            <SunScene variant="compact" />
          </div>
        ) : kawaii ? (
          <Image
            src="/images/themes/kawaii/twilight.webp"
            alt=""
            fill
            sizes="(min-width: 1200px) 1200px, 100vw"
            className="-z-10 object-cover"
          />
        ) : (
          <>
            <div className="starfield absolute inset-0 -z-10 opacity-60" aria-hidden="true" />
            <div
              className="absolute left-1/2 top-full -z-10 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--pv-violet-500)/0.6),transparent)]"
              aria-hidden="true"
            />
          </>
        )}
        <div
          className={
            kawaii
              ? 'mx-auto max-w-2xl rounded-xl border border-white/30 bg-white/15 px-6 py-10 shadow-lg backdrop-blur-md sm:px-10'
              : undefined
          }
        >
          <h2 className="mx-auto max-w-2xl text-h1 text-white">{title}</h2>
          <p
            className={`mx-auto mt-4 max-w-xl text-lead ${kawaii ? 'text-white/90' : 'text-white/65'}`}
          >
            {body}
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/signup" className="btn btn-magic btn-lg">
              Get started
            </Link>
            <Link href="/contact" className="btn btn-glass btn-lg">
              Talk to us
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
