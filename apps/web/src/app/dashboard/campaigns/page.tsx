'use client';

import Link from 'next/link';
import { Megaphone, Plus } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { useWorkspace } from '@/lib/workspace';
import type { CampaignProgress } from '@pv/shared';
import { EmptyState, Loading, PageHeader, StatusBadge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';

interface CampaignRow {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  contactCount: number;
  completedCount: number;
  agent: { name: string };
  phoneNumber: { e164: string };
  callWindowStart: string;
  callWindowEnd: string;
  timezone: string;
  progress: CampaignProgress;
}

export default function CampaignsPage() {
  const { entitlements, usage } = useWorkspace();
  const { data } = useApi<{ campaigns: CampaignRow[] }>('/app/campaigns');
  const limit = entitlements.limits.campaigns;
  const atLimit = limit !== null && usage.campaigns >= limit;
  const action = !entitlements.active ? (
    <Link href="/dashboard/billing" className="btn btn-primary">
      Choose a plan to run campaigns
    </Link>
  ) : atLimit ? (
    <Link href="/dashboard/billing?plan=PRO" className="btn btn-brand">
      Upgrade for more campaigns
    </Link>
  ) : (
    <Link href="/dashboard/campaigns/new" className="btn btn-primary">
      <Plus size={16} aria-hidden="true" /> New campaign
    </Link>
  );

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="An agent calling a list of contacts toward one goal."
        actions={
          <>
            <Link href="/dashboard/campaigns/do-not-call" className="btn btn-ghost">
              Do-not-call list
            </Link>
            {action}
          </>
        }
      />
      {!data ? (
        <Loading />
      ) : data.campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No campaigns yet"
          body="Pick an agent and a number, upload contacts and launch."
          action={action}
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Campaign</th>
                <th scope="col">Status</th>
                <th scope="col" className="w-56">
                  Progress
                </th>
                <th scope="col">Calling hours</th>
                <th scope="col">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.campaigns.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link
                      href={`/dashboard/campaigns/${c.id}`}
                      className="font-semibold hover:text-brand-700"
                    >
                      {c.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {c.agent.name} · from {c.phoneNumber.e164}
                    </p>
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-black/10"
                      role="progressbar"
                      aria-valuenow={c.progress.percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${c.name} progress`}
                    >
                      <div
                        className={cn(
                          'h-full rounded-full',
                          !c.progress.finished
                            ? 'bg-brand-500'
                            : c.progress.incomplete
                              ? 'bg-warning'
                              : 'bg-success',
                        )}
                        style={{ width: `${c.progress.percent}%` }}
                      />
                    </div>
                    <p className="num mt-1 text-xs text-muted">
                      {c.progress.percent}% · {c.progress.dialled} / {c.contactCount} dialled
                      {c.progress.waitingRetry > 0 && ` · ${c.progress.waitingRetry} to retry`}
                      {c.progress.finished && c.progress.incomplete && (
                        <span className="text-warning">
                          {' '}
                          · {c.progress.unreached +
                            c.progress.waitingRetry +
                            c.progress.notCalled}{' '}
                          not reached
                        </span>
                      )}
                    </p>
                  </td>
                  <td className="text-sm text-ink-soft">
                    {c.callWindowStart}–{c.callWindowEnd}
                    <p className="text-xs text-muted">{c.timezone}</p>
                  </td>
                  <td className="text-muted">{formatDate(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
