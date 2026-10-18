'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  Bot,
  CalendarCheck,
  Code2,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  Megaphone,
  Phone,
  PhoneCall,
  PhoneOutgoing,
  Plug,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { TermsPrompt } from '@/components/account/PrivacySection';
import { WorkspaceContext, type WorkspaceContextValue } from '@/lib/workspace';
import { AppShell, type NavGroup } from './AppShell';
import { Loading } from '@/components/ui';
import { formatNumber } from '@/lib/format';

export function DashboardFrame({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { me, acting } = useSession();
  const [ctx, setCtx] = useState<Omit<WorkspaceContextValue, 'reload'> | null>(null);

  const load = useCallback(async () => {
    setCtx(await api<Omit<WorkspaceContextValue, 'reload'>>('/app/context'));
  }, []);

  useEffect(() => {
    if (!me) return;
    if (me.staff && !acting) {
      router.replace('/admin/subscribers');
      return;
    }
    void load().catch(() => undefined);
  }, [me, acting, load, router]);

  if (!me || !ctx) {
    return (
      <div className="min-h-screen bg-app-bg">
        <Loading />
      </div>
    );
  }

  const pro = ctx.entitlements.features;
  const groups: NavGroup[] = [
    {
      items: [
        { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true },
        { href: '/dashboard/agents', label: 'Agents', icon: Bot },
        { href: '/dashboard/campaigns', label: 'Campaigns', icon: Megaphone },
        { href: '/dashboard/calls', label: 'Calls', icon: PhoneCall },
        { href: '/dashboard/dialer', label: 'Dialer', icon: PhoneOutgoing },
        { href: '/dashboard/appointments', label: 'Appointments', icon: CalendarCheck },
      ],
    },
    {
      label: 'Setup',
      items: [
        { href: '/dashboard/numbers', label: 'Phone numbers', icon: Phone },
        { href: '/dashboard/integrations', label: 'Integrations', icon: Plug },
        {
          href: '/dashboard/insights',
          label: 'Insights',
          icon: LineChart,
          badge: pro.detailedInsights ? undefined : 'Pro',
        },
        {
          href: '/dashboard/developers',
          label: 'Developers',
          icon: Code2,
          badge: pro.webhooks ? undefined : 'Pro',
        },
      ],
    },
    {
      label: 'Account',
      items: [
        { href: '/dashboard/support', label: 'Support', icon: LifeBuoy },
        { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
        { href: '/dashboard/settings', label: 'Settings', icon: Settings },
      ],
    },
  ];

  const { entitlements, usage } = ctx;
  const topbar = (
    <>
      {entitlements.active ? (
        <>
          <span className="hidden rounded-pill bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft shadow-sm sm:inline-flex">
            <span className="num">
              {formatNumber(usage.minutesUsed)} /{' '}
              {entitlements.includedMinutes === null
                ? '∞'
                : formatNumber(entitlements.includedMinutes)}{' '}
              min
            </span>
          </span>
          <span className="badge badge-brand">{entitlements.planName}</span>
        </>
      ) : (
        <Link href="/dashboard/billing" className="btn btn-brand btn-sm">
          Choose a plan
        </Link>
      )}
    </>
  );

  const banner =
    ctx.actingAsStaff && acting?.internal ? (
      <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-100 px-4 py-2.5 text-sm sm:px-8 lg:rounded-t-xl">
        <span className="flex items-center gap-2 font-medium text-ink">
          <ShieldAlert size={16} className="text-brand-700" aria-hidden="true" />
          You&apos;re in <b>{ctx.workspace.name}</b>, the platform&apos;s own workspace: agents,
          campaigns and calls here are ours, on the Enterprise plan with no bill.
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => router.push('/admin')}
        >
          Back to admin
        </button>
      </div>
    ) : ctx.actingAsStaff ? (
      <div className="flex flex-wrap items-center justify-between gap-3 bg-warning/15 px-4 py-2.5 text-sm sm:px-8 lg:rounded-t-xl">
        <span className="flex items-center gap-2 font-medium text-ink">
          <ShieldAlert size={16} className="text-warning" aria-hidden="true" />
          You&apos;re managing <b>{ctx.workspace.name}</b> as staff. Changes are recorded in the
          audit log.
        </span>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => router.push(`/admin/subscribers/${ctx.workspace.id}`)}
        >
          Back to admin
        </button>
      </div>
    ) : !entitlements.active && pathname !== '/dashboard/billing' ? (
      <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-100 px-4 py-2.5 text-sm sm:px-8 lg:rounded-t-xl">
        <span className="font-medium text-brand-900">
          Choose a plan to connect a phone number and create your first agent.
        </span>
        <Link href="/dashboard/billing" className="btn btn-primary btn-sm">
          See plans
        </Link>
      </div>
    ) : null;

  return (
    <WorkspaceContext.Provider value={{ ...ctx, reload: load }}>
      <AppShell groups={groups} topbar={topbar} banner={banner}>
        {children}
        {!acting && <TermsPrompt />}
      </AppShell>
    </WorkspaceContext.Provider>
  );
}
