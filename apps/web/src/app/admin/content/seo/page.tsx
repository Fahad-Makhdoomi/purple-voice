'use client';

import { useApi } from '@/lib/use-api';
import { api } from '@/lib/api';
import { Loading, PageHeader, Section, useAction } from '@/components/ui';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Field } from '@/components/forms/Field';
import type { AnalyticsSettings, SeoSettings } from '@pv/shared';

export default function SeoSettingsPage() {
  const seo = useApi<{ value: SeoSettings }>('/admin/cms/settings/seo');
  const analytics = useApi<{ value: AnalyticsSettings }>('/admin/cms/settings/analytics');
  const { busy, run } = useAction();
  if (!seo.data || !analytics.data) return <Loading />;
  const s = seo.data.value;
  const a = analytics.data.value;

  return (
    <>
      <PageHeader
        title="SEO & analytics"
        description="Site-wide defaults. Individual pages and posts can override title, description and image."
      />
      <div className="grid max-w-4xl gap-6">
        <Section title="Search defaults">
          <form
            className="grid gap-5 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = Object.fromEntries(new FormData(e.currentTarget));
              void run(
                () =>
                  api('/admin/cms/settings/seo', {
                    method: 'PUT',
                    body: {
                      ...f,
                      ogImageUrl: f.ogImageUrl || null,
                      twitterHandle: f.twitterHandle || null,
                      googleSiteVerification: f.googleSiteVerification || null,
                    },
                  }),
                'SEO settings saved',
              );
            }}
          >
            <Field id="siteName" label="Site name">
              <input
                id="siteName"
                name="siteName"
                className="input"
                defaultValue={s.siteName}
                required
              />
            </Field>
            <Field
              id="titleTemplate"
              label="Title template"
              help="%s is replaced by the page title."
            >
              <input
                id="titleTemplate"
                name="titleTemplate"
                className="input font-mono"
                defaultValue={s.titleTemplate}
              />
            </Field>
            <Field id="defaultTitle" label="Home page title" className="sm:col-span-2">
              <input
                id="defaultTitle"
                name="defaultTitle"
                className="input"
                maxLength={70}
                defaultValue={s.defaultTitle}
              />
            </Field>
            <Field
              id="defaultDescription"
              label="Default meta description"
              className="sm:col-span-2"
            >
              <textarea
                id="defaultDescription"
                name="defaultDescription"
                className="textarea min-h-[80px]"
                maxLength={170}
                defaultValue={s.defaultDescription}
              />
            </Field>
            <Field id="ogImageUrl" label="Default social image URL" optional>
              <input
                id="ogImageUrl"
                name="ogImageUrl"
                className="input font-mono text-xs"
                defaultValue={s.ogImageUrl ?? ''}
              />
            </Field>
            <Field id="twitterHandle" label="X / Twitter handle" optional>
              <input
                id="twitterHandle"
                name="twitterHandle"
                className="input"
                defaultValue={s.twitterHandle ?? ''}
                placeholder="@purplevoice"
              />
            </Field>
            <Field id="contactEmail" label="Public contact email">
              <input
                id="contactEmail"
                name="contactEmail"
                type="email"
                className="input"
                defaultValue={s.contactEmail}
                required
              />
            </Field>
            <Field id="googleSiteVerification" label="Google Search Console verification" optional>
              <input
                id="googleSiteVerification"
                name="googleSiteVerification"
                className="input font-mono text-xs"
                defaultValue={s.googleSiteVerification ?? ''}
              />
            </Field>
            <div className="sm:col-span-2">
              <button className="btn btn-primary" disabled={busy}>
                Save
              </button>
            </div>
          </form>
        </Section>
        <Section
          title="Analytics"
          description="Scripts load after the page is interactive, so they don't affect PageSpeed scores."
        >
          <form
            className="grid gap-5 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = Object.fromEntries(new FormData(e.currentTarget));
              void run(
                () =>
                  api('/admin/cms/settings/analytics', {
                    method: 'PUT',
                    body: {
                      plausibleDomain: f.plausibleDomain || null,
                      ga4MeasurementId: f.ga4MeasurementId || null,
                    },
                  }),
                'Analytics saved',
              );
            }}
          >
            <Field
              id="plausibleDomain"
              label="Plausible domain"
              help="Cookie-free; no consent banner needed."
              optional
            >
              <input
                id="plausibleDomain"
                name="plausibleDomain"
                className="input"
                defaultValue={a.plausibleDomain ?? ''}
                placeholder="purplevoice.ai"
              />
            </Field>
            <Field id="ga4MeasurementId" label="Google Analytics 4 ID" optional>
              <input
                id="ga4MeasurementId"
                name="ga4MeasurementId"
                className="input font-mono"
                defaultValue={a.ga4MeasurementId ?? ''}
                placeholder="G-XXXXXXX"
              />
            </Field>
            <div className="sm:col-span-2">
              <button className="btn btn-primary" disabled={busy}>
                Save
              </button>
            </div>
          </form>
        </Section>
        <RedirectsSection />
      </div>
    </>
  );
}

interface RedirectRow {
  id: string;
  fromPath: string;
  toPath: string;
  permanent: boolean;
  hits: number;
}

/** Moved addresses. Slug changes add one automatically; add your own for old URLs. */
function RedirectsSection() {
  const list = useApi<{ redirects: RedirectRow[] }>('/admin/cms/redirects');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const { busy, run } = useAction();
  return (
    <Section
      title="Redirects"
      description="Old addresses that now live somewhere else, so links and search rankings follow. Changing a page or post's URL adds one automatically (301)."
    >
      <form
        className="mb-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api('/admin/cms/redirects', { body: { fromPath: from, toPath: to } });
            setFrom('');
            setTo('');
            await list.reload();
          }, 'Redirect saved');
        }}
      >
        <input
          className="input font-mono text-sm"
          aria-label="From path"
          placeholder="/old-page"
          value={from}
          onChange={(e) => setFrom(e.target.value.trim())}
          required
        />
        <input
          className="input font-mono text-sm"
          aria-label="To path or URL"
          placeholder="/new-page"
          value={to}
          onChange={(e) => setTo(e.target.value.trim())}
          required
        />
        <button className="btn btn-secondary" disabled={busy}>
          Add redirect
        </button>
      </form>
      {!list.data ? (
        <Loading />
      ) : list.data.redirects.length === 0 ? (
        <p className="text-sm text-muted">No redirects yet.</p>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {list.data.redirects.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {r.fromPath} → {r.toPath}
              </span>
              <span className="num text-xs text-muted">{r.hits} hits</span>
              <button
                type="button"
                className="btn btn-ghost btn-icon h-8 w-8 text-danger"
                aria-label={`Remove redirect from ${r.fromPath}`}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await api(`/admin/cms/redirects/${r.id}`, { method: 'DELETE' });
                    await list.reload();
                  })
                }
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
