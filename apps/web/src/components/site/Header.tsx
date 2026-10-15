'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/#features', label: 'Product' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
];

/** Pages whose first section is dark: the header starts transparent with light text. */
const DARK_TOP = new Set(['/']);

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const darkTop = DARK_TOP.has(pathname);
  const light = darkTop && !scrolled && !open;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition duration-200',
        light ? 'bg-transparent' : 'border-b border-line/70 bg-white/80 backdrop-blur-xl',
      )}
    >
      <div className="container flex h-header items-center justify-between gap-6">
        <Link href="/" aria-label="Purple Voice home">
          <Logo tone={light ? 'light' : 'dark'} />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-pill px-3.5 py-2 text-sm font-medium transition',
                light
                  ? 'text-white/75 hover:text-white'
                  : 'text-ink-soft hover:bg-brand-50 hover:text-ink',
                pathname === item.href && (light ? 'text-white' : 'text-ink'),
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href="/login"
            className={cn('btn btn-sm', light ? 'text-white/80 hover:text-white' : 'btn-ghost')}
          >
            Sign in
          </Link>
          <Link href="/signup" className={cn('btn btn-sm', light ? 'btn-brand' : 'btn-primary')}>
            Get started
          </Link>
        </div>

        <button
          type="button"
          className={cn('btn btn-icon md:hidden', light ? 'text-white' : 'btn-ghost')}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="container border-t border-line pb-6 pt-3 md:hidden"
        >
          <ul className="flex flex-col">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-sm px-2 py-3 text-base font-medium text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link href="/login" className="btn btn-secondary">
              Sign in
            </Link>
            <Link href="/signup" className="btn btn-primary">
              Get started
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
