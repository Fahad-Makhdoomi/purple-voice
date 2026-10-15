import type { Metadata } from 'next';
import { SessionProvider } from '@/lib/session';
import { DashboardFrame } from '@/components/dashboard/DashboardFrame';

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false, follow: false } };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <DashboardFrame>{children}</DashboardFrame>
    </SessionProvider>
  );
}
