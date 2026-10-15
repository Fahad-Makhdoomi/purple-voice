'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LogOut, Menu, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Toaster } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useSession } from '@/lib/session';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
  /** Match only the exact path (for section roots like /dashboard). */
  exact?: boolean;
}
export interface NavGroup {
  label?: string;
  items: NavItem[];
}

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Sections" className="space-y-5">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.label && (
            <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-brand-900/45">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map(({ href, label, icon: Icon, badge, exact }) => {
              const active = exact
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group flex items-center gap-3 rounded-pill px-1.5 py-1 text-sm font-medium transition',
                      active
                        ? 'bg-ink text-white'
                        : 'text-ink-soft hover:bg-white/70 hover:text-ink',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-full transition',
                        active ? 'bg-white/15' : 'bg-white/70 group-hover:bg-white',
                      )}
                    >
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <span className="flex-1">{label}</span>
                    {badge && (
                      <span
                        className={cn(
                          'mr-1 rounded-pill px-2 py-0.5 text-[10px] font-bold',
                          active ? 'bg-white/15' : 'bg-brand-100 text-brand-700',
                        )}
                      >
                        {badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * The app frame for both the subscriber dashboard and the admin panel:
 * lavender canvas, rounded panel, a sidebar of pill links with the active
 * one in ink — the look of the dashboard reference.
 */
export function AppShell({
  groups,
  topbar,
  banner,
  children,
}: {
  groups: NavGroup[];
  topbar?: React.ReactNode;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { me, logout } = useSession();
  const [drawer, setDrawer] = useState(false);
  const initials = (me?.user.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/" className="mb-6 px-2" aria-label="Purple Voice website">
        <Logo />
      </Link>
      <div className="flex-1 overflow-y-auto pr-1">
        <NavLinks groups={groups} onNavigate={() => setDrawer(false)} />
      </div>
      <div className="mt-4 flex items-center gap-3 rounded-lg bg-white/70 p-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{me?.user.name ?? '…'}</p>
          <p className="truncate text-xs text-muted">{me?.user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => void logout()}
          className="btn btn-ghost btn-icon h-9 w-9"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-app-bg p-0 lg:p-3">
      <div className="flex min-h-screen bg-app-panel lg:min-h-[calc(100vh-24px)] lg:rounded-xl">
        <aside className="sticky top-3 hidden h-[calc(100vh-24px)] w-[260px] shrink-0 border-r border-white/60 p-5 lg:block">
          {sidebar}
        </aside>

        {drawer && (
          <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <button
              className="absolute inset-0 bg-night/40"
              aria-label="Close menu"
              onClick={() => setDrawer(false)}
            />
            <aside className="absolute inset-y-0 left-0 w-[280px] bg-app-panel p-5 shadow-lg">
              {sidebar}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {banner}
          <header className="flex items-center gap-3 px-4 pt-4 sm:px-8 sm:pt-6">
            <button
              type="button"
              className="btn btn-secondary btn-icon lg:hidden"
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
            >
              {drawer ? <X size={18} /> : <Menu size={18} />}
            </button>
            <div className="flex flex-1 items-center justify-end gap-2">{topbar}</div>
          </header>
          <main id="main" className="flex-1 px-4 pb-12 pt-6 sm:px-8">
            {children}
          </main>
        </div>
      </div>
      <Toaster />
    </div>
  );
}
