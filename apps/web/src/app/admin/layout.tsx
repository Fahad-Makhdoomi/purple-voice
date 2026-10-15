import type { Metadata } from 'next';
import { SessionProvider } from '@/lib/session';
import { AdminFrame } from '@/components/admin/AdminFrame';

export const metadata: Metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AdminFrame>{children}</AdminFrame>
    </SessionProvider>
  );
}
