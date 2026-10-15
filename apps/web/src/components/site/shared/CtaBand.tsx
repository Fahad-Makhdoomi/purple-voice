import Link from 'next/link';

export function CtaBand({
  title = 'Put your first agent on the phone today',
  body = 'Start on Basic for $19 a month. Upgrade to Pro when you need more agents, numbers and campaigns.',
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="bg-canvas px-gutter pb-section">
      <div className="relative isolate mx-auto max-w-container overflow-hidden rounded-xl bg-night px-6 py-16 text-center text-white sm:px-12 sm:py-20">
        <div className="starfield absolute inset-0 -z-10 opacity-60" aria-hidden="true" />
        <div
          className="absolute left-1/2 top-full -z-10 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(var(--pv-violet-500)/0.6),transparent)]"
          aria-hidden="true"
        />
        <h2 className="mx-auto max-w-2xl text-h1 text-white">{title}</h2>
        <p className="mx-auto mt-4 max-w-xl text-lead text-white/65">{body}</p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/signup" className="btn btn-magic btn-lg">
            Get started
          </Link>
          <Link href="/contact" className="btn btn-glass btn-lg">
            Talk to us
          </Link>
        </div>
      </div>
    </section>
  );
}
