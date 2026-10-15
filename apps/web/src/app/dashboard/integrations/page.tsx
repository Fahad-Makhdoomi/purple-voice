'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { INTEGRATION_LABELS, type IntegrationType } from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useWorkspace } from '@/lib/workspace';
import { Loading, Modal, PageHeader, Section, toast, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';

const APP_HELP: Partial<Record<IntegrationType, { label: string; placeholder: string }>> = {
  SLACK: { label: 'Incoming webhook URL', placeholder: 'https://hooks.slack.com/services/…' },
  ZAPIER: { label: 'Catch hook URL', placeholder: 'https://hooks.zapier.com/hooks/catch/…' },
  HUBSPOT: { label: 'Private app access token', placeholder: 'pat-…' },
  CALENDLY: { label: 'Personal access token', placeholder: 'eyJ…' },
};

function IntegrationsInner() {
  const params = useSearchParams();
  const { entitlements, usage, reload: reloadWs } = useWorkspace();
  const apps = useApi<{
    integrations: Array<{
      id: string;
      type: IntegrationType;
      accountLabel: string | null;
      connectedAt: string;
      lastError: string | null;
    }>;
    available: Array<{ type: IntegrationType; connected: boolean; configured: boolean }>;
  }>('/app/integrations');
  const [appFor, setAppFor] = useState<IntegrationType | null>(null);
  const { busy, run } = useAction();

  useEffect(() => {
    if (params.get('connected') === 'google') toast('Google Calendar connected');
    if (params.get('error')) toast('Google Calendar was not connected. Please try again.', 'error');
  }, [params]);

  if (!apps.data) return <Loading />;
  const refreshApps = async () => {
    await Promise.all([apps.reload(), reloadWs()]);
  };
  const limit = entitlements.limits.integrations;

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Your calendar and the apps your calls should talk to."
      />
      <div className="space-y-6">
        <Section
          title="Apps"
          description={
            limit === null
              ? 'Connect as many as you need.'
              : `${usage.integrations} of ${limit} connected on your plan.`
          }
        >
          <ul className="grid gap-3 md:grid-cols-2">
            {apps.data.available.map((a) => {
              const connected = apps.data!.integrations.find((i) => i.type === a.type);
              return (
                <li
                  key={a.type}
                  className="flex items-center gap-4 rounded-lg border border-line p-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                    <CalendarDays size={18} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{INTEGRATION_LABELS[a.type]}</p>
                    <p className="truncate text-xs text-muted">
                      {connected
                        ? connected.lastError
                          ? `Problem: ${connected.lastError}`
                          : `Connected${connected.accountLabel ? ` as ${connected.accountLabel}` : ''}`
                        : !a.configured
                          ? 'Not available on this server yet'
                          : a.type === 'GOOGLE_CALENDAR'
                            ? 'Let agents check availability and book meetings.'
                            : a.type === 'SLACK'
                              ? 'Post call results to a channel (via Automations).'
                              : a.type === 'ZAPIER'
                                ? 'Every call and booking event is sent to your Zap.'
                                : 'Save your token now; contact sync is coming soon.'}
                    </p>
                  </div>
                  {connected ? (
                    <button
                      className="btn btn-ghost btn-sm text-danger"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          if (!window.confirm(`Disconnect ${INTEGRATION_LABELS[a.type]}?`)) return;
                          await api(`/app/integrations/${connected.id}`, { method: 'DELETE' });
                          await refreshApps();
                        }, 'Disconnected')
                      }
                    >
                      Disconnect
                    </button>
                  ) : a.type === 'GOOGLE_CALENDAR' ? (
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy || !a.configured || !entitlements.active}
                      onClick={() =>
                        run(async () => {
                          const { url } = await api<{ url: string }>(
                            '/app/integrations/google/connect',
                          );
                          window.location.href = url;
                        })
                      }
                    >
                      Connect
                    </button>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={!entitlements.active}
                      onClick={() => setAppFor(a.type)}
                    >
                      Connect
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      </div>

      <Modal
        open={!!appFor}
        onClose={() => setAppFor(null)}
        title={appFor ? `Connect ${INTEGRATION_LABELS[appFor]}` : ''}
      >
        {appFor && APP_HELP[appFor] && (
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const secret = String(new FormData(e.currentTarget).get('secret') ?? '');
              const ok = await run(async () => {
                await api('/app/integrations', { body: { type: appFor, secret } });
                return true;
              }, 'Connected');
              if (ok) {
                setAppFor(null);
                await refreshApps();
              }
            }}
          >
            <Field id="secret" label={APP_HELP[appFor]!.label}>
              <input
                id="secret"
                name="secret"
                className="input font-mono"
                required
                placeholder={APP_HELP[appFor]!.placeholder}
                autoComplete="off"
              />
            </Field>
            <button className="btn btn-primary w-full" disabled={busy}>
              Connect
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <IntegrationsInner />
    </Suspense>
  );
}
