'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, MailCheck, Send, ShieldBan, UserX } from 'lucide-react';
import { isSuperAdmin } from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { useSession } from '@/lib/session';
import { Loading, Modal, PageHeader, Section, StatTile, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';
import { formatNumber } from '@/lib/format';

interface Settings {
  enabled: boolean;
  offerCode: string;
  offerText: string;
  steps: Record<string, { enabled: boolean }>;
  blockedDomains: string[];
}

interface Step {
  key: string;
  name: string;
  delayDays: number;
  upgrade: boolean;
  sent: number;
  sent30d: number;
  skipped: number;
}

interface Data {
  settings: Settings;
  steps: Step[];
  unsubscribed: number;
  pendingVerification: number;
}

const when = (d: number) => (d === 0 ? 'When they confirm their email' : `Day ${d}`);

export default function EmailAutomationsPage() {
  const { me } = useSession();
  const canEdit = !!me && isSuperAdmin(me.user.role);
  const { data, setData } = useApi<Data>('/admin/email-automations');
  const [form, setForm] = useState<Settings | null>(null);
  const [domains, setDomains] = useState('');
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const { busy, run } = useAction();

  useEffect(() => {
    if (data) {
      setForm(data.settings);
      setDomains(data.settings.blockedDomains.join('\n'));
    }
  }, [data]);

  if (!data || !form) return <Loading />;
  const stepOn = (key: string) => form.steps[key]?.enabled ?? true;
  const totalSent = data.steps.reduce((n, s) => n + s.sent, 0);
  const sent30 = data.steps.reduce((n, s) => n + s.sent30d, 0);

  const save = () =>
    run(async () => {
      const r = await api<{ settings: Settings }>('/admin/email-automations', {
        method: 'PUT',
        body: {
          ...form,
          blockedDomains: domains
            .split(/[\s,]+/)
            .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
            .filter(Boolean),
        },
      });
      setData({ ...data, settings: r.settings });
    }, 'Email automations saved');

  const showPreview = (key: string) =>
    run(async () => {
      setPreview(await api<{ subject: string; html: string }>(`/admin/email-automations/preview/${key}`));
    });

  const sendTest = (key: string) =>
    run(async () => {
      const r = await api<{ to: string }>(`/admin/email-automations/test/${key}`, { method: 'POST' });
      return r;
    }, 'Test email sent to your address');

  return (
    <>
      <PageHeader
        title="Email automations"
        description={
          <>
            New sign-ups confirm their email, get a welcome, then a short onboarding and
            upgrade-to-Pro sequence. Emails go out from your mail server in{' '}
            <Link href="/admin/email" className="font-semibold text-brand-700 hover:text-brand-900">
              Email (SMTP)
            </Link>
            ; upgrade emails skip anyone already on Pro.
          </>
        }
        actions={
          canEdit && (
            <button className="btn btn-primary" onClick={save} disabled={busy}>
              Save changes
            </button>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Emails sent (30 days)" value={formatNumber(sent30)} icon={Send} />
        <StatTile label="Emails sent (all time)" value={formatNumber(totalSent)} icon={MailCheck} tone="plain" />
        <StatTile
          label="Waiting to confirm email"
          value={formatNumber(data.pendingVerification)}
          hint="Removed after 14 days unconfirmed"
          icon={ShieldBan}
          tone="plain"
        />
        <StatTile label="Unsubscribed" value={formatNumber(data.unsubscribed)} icon={UserX} tone="plain" />
      </div>

      <Section
        className="mt-6"
        title="Sequence"
        description="Timed from when each person confirms their email address."
        actions={
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              className="checkbox"
              checked={form.enabled}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            />
            Automations on
          </label>
        }
      >
        <ul className="divide-y divide-line">
          {data.steps.map((s) => (
            <li key={s.key} className="flex flex-wrap items-center gap-3 py-3">
              <input
                type="checkbox"
                className="checkbox"
                aria-label={`Send “${s.name}”`}
                checked={stepOn(s.key)}
                disabled={!canEdit || !form.enabled}
                onChange={(e) =>
                  setForm({
                    ...form,
                    steps: { ...form.steps, [s.key]: { enabled: e.target.checked } },
                  })
                }
              />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{s.name}</span>
                {s.upgrade && <span className="badge badge-brand ml-2">Upgrade</span>}
                <span className="block text-xs text-muted">{when(s.delayDays)}</span>
              </span>
              <span className="w-40 text-right text-xs text-muted">
                {formatNumber(s.sent)} sent
                {s.skipped > 0 && ` · ${formatNumber(s.skipped)} skipped`}
              </span>
              <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => showPreview(s.key)} disabled={busy}>
                <Eye size={15} /> Preview
              </button>
              <button className="btn btn-secondary btn-sm gap-1.5" onClick={() => sendTest(s.key)} disabled={busy}>
                <Send size={15} /> Send me a test
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Section
          title="Upgrade offer"
          description="Optional. Create the promotion code in Stripe first; it is shown in the offer, free-month-ending and last-call emails."
        >
          <div className="grid gap-4">
            <Field id="offerCode" label="Promotion code" optional>
              <input
                id="offerCode"
                className="input"
                value={form.offerCode}
                disabled={!canEdit}
                placeholder="PRO20"
                onChange={(e) => setForm({ ...form, offerCode: e.target.value })}
              />
            </Field>
            <Field id="offerText" label="What it gives" optional>
              <input
                id="offerText"
                className="input"
                value={form.offerText}
                disabled={!canEdit}
                placeholder="20% off your first 3 months of Pro"
                onChange={(e) => setForm({ ...form, offerText: e.target.value })}
              />
            </Field>
          </div>
        </Section>
        <Section
          title="Blocked sign-up domains"
          description="Over 10,000 known temporary-email domains are already blocked, as are domains that can't receive email. Add any others here, one per line."
        >
          <textarea
            className="input min-h-36 font-mono text-sm"
            value={domains}
            disabled={!canEdit}
            placeholder={'example-temp.com\nanother-throwaway.net'}
            onChange={(e) => setDomains(e.target.value)}
            aria-label="Blocked domains"
          />
        </Section>
      </div>

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.subject ?? ''} size="lg">
        {preview && (
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={preview.html}
            className="h-[70vh] w-full rounded-lg border border-line bg-white"
          />
        )}
      </Modal>
    </>
  );
}
