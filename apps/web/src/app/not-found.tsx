import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';

export default function NotFound() {
  return (
    <main
      id="main"
      className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-night px-6 text-center text-white"
    >
      <div className="starfield absolute inset-0 -z-10 opacity-60" aria-hidden="true" />
      <Logo tone="light" />
      <p className="num mt-12 text-7xl font-light text-brand-300">404</p>
      <h1 className="mt-4 text-h2 text-white">This line went quiet</h1>
      <p className="mt-3 max-w-md text-white/60">
        The page you were looking for doesn&apos;t exist or has moved.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/" className="btn btn-magic">
          Back home
        </Link>
        <Link href="/contact" className="btn btn-glass">
          Contact us
        </Link>
      </div>
    </main>
  );
}
