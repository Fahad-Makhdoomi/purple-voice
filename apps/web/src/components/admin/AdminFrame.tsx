'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  BrainCircuit,
  CreditCard,
  FileText,
  Globe,
  Settings2,
  HelpCircle,
  Image as ImageIcon,
  Inbox,
  Layers,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  Newspaper,
  Palette,
  PhoneCall,
  ScrollText,
  ShieldCheck,
  TrendingUp,
  UserRound,
  Users,
} from 'lucide-react';
import { isSuperAdmin } from '@pv/shared';
import { useSession } from '@/lib/session';
import { setActingWorkspace } from '@/lib/api';
import { AppShell, type NavGroup } from '@/components/dashboard/AppShell';
import { Loading } from '@/components/ui';

export function AdminFrame({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { me } = useSession();

  useEffect(() => {
    if (me && !me.staff) router.replace('/dashboard');
  }, [me, router]);

  // Arriving in the admin panel ends "acting as customer" mode. Runs once on
  // mount (before the session provider reads storage), so "Open their
  // dashboard" can still set it on the way out.
  useEffect(() => {
    setActingWorkspace(null);
  }, []);

  if (!me?.staff) {
    return (
      <div className="min-h-screen bg-app-bg">
        <Loading />
      </div>
    );
  }

  const groups: NavGroup[] = [
    {
      items: [
        { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
        { href: '/admin/subscribers', label: 'Subscribers', icon: Users },
        { href: '/admin/leads', label: 'Leads', icon: Inbox },
        { href: '/admin/support', label: 'Support', icon: LifeBuoy },
      ],
    },
    {
      label: 'Website',
      items: [
        { href: '/admin/content/pages', label: 'Pages', icon: FileText },
        { href: '/admin/content/blog', label: 'Blog', icon: Newspaper },
        { href: '/admin/content/faqs', label: 'FAQs', icon: HelpCircle },
        { href: '/admin/content/media', label: 'Media', icon: ImageIcon },
        { href: '/admin/content/site', label: 'Site settings', icon: Settings2 },
        { href: '/admin/content/seo', label: 'SEO & analytics', icon: Globe },
      ],
    },
    ...(isSuperAdmin(me.user.role)
      ? [
          {
            label: 'Super admin',
            items: [
              { href: '/admin/workspace', label: 'Our workspace', icon: PhoneCall },
              { href: '/admin/insights', label: 'Revenue insights', icon: TrendingUp },
              { href: '/admin/plans', label: 'Plans & pricing', icon: Layers },
              { href: '/admin/ai', label: 'AI providers', icon: BrainCircuit },
              { href: '/admin/payments', label: 'Payment gateways', icon: CreditCard },
              { href: '/admin/appearance', label: 'Website theme', icon: Palette },
              { href: '/admin/staff', label: 'Staff', icon: ShieldCheck },
              { href: '/admin/security', label: 'Security', icon: Lock },
              { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
            ],
          },
        ]
      : []),
    { items: [{ href: '/admin/account', label: 'Your account', icon: UserRound }] },
  ];

  return (
    <AppShell
      groups={groups}
      topbar={
        <span className="badge badge-brand">
          {me.user.role === 'SUPER_ADMIN' ? 'Super admin' : 'Admin'}
        </span>
      }
    >
      {children}
    </AppShell>
  );
}
