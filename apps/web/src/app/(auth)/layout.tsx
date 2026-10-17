import Image from 'next/image';
import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { getAppearance } from '@/lib/server-api';
import { SunScene } from '@/components/site/SunScene';
import { cn } from '@/lib/cn';

/** Split screen: form on the left, the theme's brand panel on the right. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { theme } = await getAppearance();
  return (
    <main
      id="main"
      data-theme={theme}
      className="site-theme grid min-h-screen lg:grid-cols-[1fr_1.05fr]"
    >
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" aria-label="Purple Voice home" className="w-fit">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          {children}
        </div>
        <p className="text-xs text-muted">© {new Date().getFullYear()} Purple Voice</p>
      </div>
      <aside
        className={cn(
          'relative isolate hidden overflow-hidden text-white lg:flex lg:flex-col lg:p-14',
          // Minimal is light: `landing` lets light-landing.css invert the quote card.
          theme === 'minimal'
            ? 'landing bg-gradient-wash lg:justify-start'
            : 'bg-night lg:justify-end',
        )}
        aria-hidden="true"
      >
        {theme === 'minimal' ? (
          <div className="absolute inset-x-0 bottom-0 -z-10 h-[70%]">
            <SunScene variant="compact" />
          </div>
        ) : theme === 'kawaii' ? (
          <Image
            src="/images/themes/kawaii/twilight.webp"
            alt=""
            fill
            sizes="50vw"
            className="-z-10 object-cover"
          />
        ) : (
          <>
            <div className="starfield absolute inset-0 -z-10 opacity-70" />
            <div className="light-beam absolute -left-1/3 top-0 -z-10 h-full w-[120%] opacity-80" />
            <div className="absolute left-1/2 top-[38%] -z-10 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(var(--pv-violet-500)/0.6),transparent_62%)]" />
            <div className="absolute left-1/2 top-[38%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_38%_30%,rgb(var(--pv-violet-200)),rgb(var(--pv-violet-600))_45%,rgb(var(--pv-violet-950))_100%)] shadow-glow" />
          </>
        )}
        <div className="glass max-w-md p-6">
          <p className="text-lg font-medium leading-relaxed text-white/90">
            “Our agent calls every new lead within five minutes. Booked demos doubled in the first
            month.”
          </p>
          <p className="mt-4 text-sm text-white/55">Head of Sales, home services company</p>
        </div>
      </aside>
    </main>
  );
}
