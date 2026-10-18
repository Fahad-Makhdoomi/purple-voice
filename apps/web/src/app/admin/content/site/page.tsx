'use client';

import type { ContentSettings, LegalSettings } from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { Loading, PageHeader, Section, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';

type Entries = Record<string, FormDataEntryValue>;
const text = (f: Entries, k: string) => String(f[k] ?? '').trim();

/**
 * Site settings: the words on the home page, the announcement bar, footer and
 * social links (SiteSetting "content"), and the company details the legal
 * pages and cookie banner state (SiteSetting "legal"). Live within seconds.
 */
export default function SiteSettingsPage() {
  const content = useApi<{ value: ContentSettings }>('/admin/cms/settings/content');
  const legal = useApi<{ value: LegalSettings }>('/admin/cms/settings/legal');
  const { busy, run } = useAction();
  if (!content.data || !legal.data) return <Loading />;
  const c = content.data.value;
  const l = legal.data.value;

  const saveContent = (f: Entries) =>
    run(
      () =>
        api('/admin/cms/settings/content', {
          method: 'PUT',
          body: {
            announcement: {
              enabled: f.annEnabled === 'on',
              text: text(f, 'annText'),
              linkLabel: text(f, 'annLabel'),
              href: text(f, 'annHref'),
            },
            hero: {
              badge: text(f, 'badge'),
              title: text(f, 'title'),
              subtitle: text(f, 'subtitle'),
              primaryLabel: text(f, 'primaryLabel'),
              primaryHref: text(f, 'primaryHref'),
              secondaryLabel: text(f, 'secondaryLabel'),
              secondaryHref: text(f, 'secondaryHref'),
            },
            footerTagline: text(f, 'footerTagline'),
            social: {
              linkedin: text(f, 'linkedin') || null,
              x: text(f, 'x') || null,
              youtube: text(f, 'youtube') || null,
              instagram: text(f, 'instagram') || null,
              facebook: text(f, 'facebook') || null,
            },
          },
        }).then(() => content.reload()),
      'Site content saved — live within seconds',
    );

  const LEGAL_FIELDS: Array<[keyof LegalSettings, string, string?]> = [
    ['companyName', 'Legal company name'],
    ['address', 'Registered address'],
    ['country', 'Country'],
    ['registrationNumber', 'Company number', 'Companies House or your registry.'],
    ['vatNumber', 'VAT / GST number'],
    ['icoNumber', 'ICO registration number', 'UK data protection fee registration.'],
    [
      'privacyEmail',
      'Privacy contact email',
      'Where privacy requests go. Defaults to the site email.',
    ],
    ['dpoName', 'Data protection officer', 'If you have appointed one.'],
    ['dpoEmail', 'DPO email'],
    [
      'euRepresentative',
      'EU representative (GDPR art. 27)',
      'Needed if you are outside the EU and serve EU customers.',
    ],
    [
      'ukRepresentative',
      'UK representative (UK GDPR art. 27)',
      'Needed if you are outside the UK and serve UK customers.',
    ],
    ['hostingProvider', 'Hosting provider', 'Shown on the Sub-processors page.'],
    ['hostingRegion', 'Hosting location', 'e.g. Germany (EU) or Mumbai, India.'],
    ['governingLaw', 'Governing law of the Terms', 'e.g. England and Wales.'],
    ['effectiveDate', 'Legal pages effective date'],
  ];

  return (
    <>
      <PageHeader
        title="Site settings"
        description="The words on the home page and around the site, and the company details your legal pages show."
      />
      <div className="grid max-w-4xl gap-6">
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            void saveContent(Object.fromEntries(new FormData(e.currentTarget)));
          }}
        >
          <Section
            title="Announcement bar"
            description="A slim bar above the header on every page."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  name="annEnabled"
                  className="checkbox"
                  defaultChecked={c.announcement.enabled}
                />
                Show the announcement bar
              </label>
              <Field id="annText" label="Text" className="sm:col-span-2">
                <input
                  id="annText"
                  name="annText"
                  className="input"
                  maxLength={160}
                  defaultValue={c.announcement.text}
                  placeholder="New: 100 free AI call minutes every month"
                />
              </Field>
              <Field id="annLabel" label="Link label" optional>
                <input
                  id="annLabel"
                  name="annLabel"
                  className="input"
                  maxLength={40}
                  defaultValue={c.announcement.linkLabel}
                  placeholder="Start free"
                />
              </Field>
              <Field id="annHref" label="Link" optional>
                <input
                  id="annHref"
                  name="annHref"
                  className="input font-mono"
                  maxLength={500}
                  defaultValue={c.announcement.href}
                  placeholder="/signup?plan=FREE"
                />
              </Field>
            </div>
          </Section>

          <Section
            title="Home page hero"
            description="The headline and buttons at the top of the home page."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="badge" label="Badge above the headline" className="sm:col-span-2">
                <input
                  id="badge"
                  name="badge"
                  className="input"
                  maxLength={80}
                  defaultValue={c.hero.badge}
                />
              </Field>
              <Field id="title" label="Headline" className="sm:col-span-2">
                <input
                  id="title"
                  name="title"
                  className="input"
                  required
                  minLength={4}
                  maxLength={120}
                  defaultValue={c.hero.title}
                />
              </Field>
              <Field id="subtitle" label="Intro" className="sm:col-span-2">
                <textarea
                  id="subtitle"
                  name="subtitle"
                  className="textarea min-h-[90px]"
                  maxLength={400}
                  defaultValue={c.hero.subtitle}
                />
              </Field>
              <Field id="primaryLabel" label="Main button">
                <input
                  id="primaryLabel"
                  name="primaryLabel"
                  className="input"
                  maxLength={40}
                  defaultValue={c.hero.primaryLabel}
                />
              </Field>
              <Field id="primaryHref" label="Main button link">
                <input
                  id="primaryHref"
                  name="primaryHref"
                  className="input font-mono"
                  defaultValue={c.hero.primaryHref}
                />
              </Field>
              <Field id="secondaryLabel" label="Second button">
                <input
                  id="secondaryLabel"
                  name="secondaryLabel"
                  className="input"
                  maxLength={40}
                  defaultValue={c.hero.secondaryLabel}
                />
              </Field>
              <Field id="secondaryHref" label="Second button link">
                <input
                  id="secondaryHref"
                  name="secondaryHref"
                  className="input font-mono"
                  defaultValue={c.hero.secondaryHref}
                />
              </Field>
            </div>
          </Section>

          <Section title="Footer and social">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="footerTagline" label="Footer tagline" className="sm:col-span-2">
                <input
                  id="footerTagline"
                  name="footerTagline"
                  className="input"
                  maxLength={300}
                  defaultValue={c.footerTagline}
                />
              </Field>
              {(['linkedin', 'x', 'youtube', 'instagram', 'facebook'] as const).map((k) => (
                <Field
                  key={k}
                  id={k}
                  label={k === 'x' ? 'X (Twitter)' : k[0]!.toUpperCase() + k.slice(1)}
                  optional
                >
                  <input
                    id={k}
                    name={k}
                    type="url"
                    className="input font-mono text-xs"
                    defaultValue={c.social[k] ?? ''}
                    placeholder="https://"
                  />
                </Field>
              ))}
            </div>
          </Section>
          <button className="btn btn-primary" disabled={busy}>
            Save site content
          </button>
        </form>

        <Section
          title="Legal details"
          description="Filled into the Privacy Policy, Terms, Cookie Policy, DPA and Sub-processors pages. Leave a field empty and the line that uses it is left out. Have the legal pages reviewed by your lawyer."
        >
          <form
            className="grid gap-5 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = Object.fromEntries(new FormData(e.currentTarget));
              void run(
                () =>
                  api('/admin/cms/settings/legal', {
                    method: 'PUT',
                    body: Object.fromEntries(LEGAL_FIELDS.map(([k]) => [k, text(f, k)])),
                  }).then(() => legal.reload()),
                'Legal details saved',
              );
            }}
          >
            {LEGAL_FIELDS.map(([k, label, help]) => (
              <Field
                key={k}
                id={`legal-${k}`}
                label={label}
                help={help}
                optional={k !== 'companyName'}
              >
                <input
                  id={`legal-${k}`}
                  name={k}
                  className="input"
                  defaultValue={l[k]}
                  required={k === 'companyName'}
                />
              </Field>
            ))}
            <div className="sm:col-span-2">
              <button className="btn btn-primary" disabled={busy}>
                Save legal details
              </button>
            </div>
          </form>
        </Section>
      </div>
    </>
  );
}
