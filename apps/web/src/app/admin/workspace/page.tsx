'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { isSuperAdmin } from '@pv/shared';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { EmptyState, ErrorNote, Loading, PageHeader } from '@/components/ui';

const TITLE = 'Our workspace';

/**
 * Super admin → Our workspace: opens the platform's own workspace in the
 * regular dashboard, where super admins build agents, run campaigns and call.
 */
export default function OurWorkspacePage() {
  const { me, actAs } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const allowed = !!me && isSuperAdmin(me.user.role);

  useEffect(() => {
    if (!allowed) return;
    api<{ workspace: { id: string; name: string } }>('/admin/super/workspace')
      .then(({ workspace }) => {
        actAs({ ...workspace, internal: true });
        router.replace('/dashboard');
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Could not open the workspace'),
      );
  }, [allowed, actAs, router]);

  if (me && !allowed) {
    return (
      <>
        <PageHeader title={TITLE} />
        <EmptyState
          icon={Lock}
          title="Super admins only"
          body="The platform's own workspace is for super admins. You can still open a customer's dashboard from Subscribers."
        />
      </>
    );
  }
  return (
    <>
      <PageHeader
        title={TITLE}
        description="Opening the platform's own workspace, where you can build agents, run campaigns and make calls."
      />
      {error ? <ErrorNote message={error} /> : <Loading />}
    </>
  );
}
