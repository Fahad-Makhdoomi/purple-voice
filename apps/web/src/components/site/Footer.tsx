import Link from 'next/link';
import { Logo } from '@/components/brand/Logo';
import { getFooterPages, getSettings } from '@/lib/server-api';
import { CookieSettingsButton } from '@/components/site/CookieConsent';

export async function Footer() {
  const [pages, { seo, content }] = await Promise.all([getFooterPages(), getSettings()]);
  const social = [
    ['LinkedIn', content.social.linkedin],
    ['X', content.social.x],
    ['YouTube', content.social.youtube],
    ['Instagram', content.social.instagram],
    ['Facebook', content.social.facebook],
  ].filter((s): s is [string, string] => !!s[1]);
  const columns = [
    {
      title: 'Product',
      links: [
        { href: '/#features', label: 'Features' },
        { href: '/pricing', label: 'Pricing' },
        { href: '/faq', label: 'FAQ' },
        { href: '/signup', label: 'Get started' },
      ],
    },
    {
      title: 'Company',
      links: [
        { href: '/blog', label: 'Blog' },
        { href: '/resources', label: 'Resources' },
        { href: '/contact', label: 'Contact' },
        { href: '/contact?plan=ENTERPRISE', label: 'Enterprise' },
      ],
    },
    {
      title: 'Legal',
      links: [
        ...pages.map((p) => ({ href: `/${p.slug}`, label: p.title })),
        // US state privacy laws: a clear link to opt out of sale or sharing.
        { href: '/privacy-choices', label: 'Your privacy choices' },
      ],
    },
  ];

  return (
    <footer className="site-footer relative overflow-hidden bg-night text-white">
      <div
        className="starfield pointer-events-none absolute inset-0 opacity-40"
        aria-hidden="true"
      />
      <div className="container relative grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-xs">
          <Logo tone="light" />
          <p className="mt-4 text-sm leading-relaxed text-white/60">{content.footerTagline}</p>
          <a
            href={`mailto:${seo.contactEmail}`}
            className="mt-4 inline-block text-sm font-semibold text-brand-300 hover:text-white"
          >
            {seo.contactEmail}
          </a>
          {social.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {social.map(([label, href]) => (
                <li key={label}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/60 transition hover:text-white"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-white/45">
              {col.title}
            </h2>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-white/75 transition hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container relative flex flex-col gap-2 border-t border-white/10 py-6 text-xs text-white/45 sm:flex-row sm:justify-between">
        <p>
          © {new Date().getFullYear()} {seo.siteName}. All rights reserved.
        </p>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>Phone number rental and AI usage are billed separately.</span>
          <CookieSettingsButton className="underline underline-offset-2 transition hover:text-white" />
        </p>
      </div>
    </footer>
  );
}
