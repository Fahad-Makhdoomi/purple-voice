'use client';

import { useEffect, useState } from 'react';
import { Check, ExternalLink } from 'lucide-react';
import {
  SITE_THEME_INFO,
  SITE_THEMES,
  type AppearanceSettings,
  type SiteTheme,
} from '@pv/shared';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { cn } from '@/lib/cn';
import { Loading, PageHeader, Section, useAction } from '@/components/ui';

/** A tiny picture of each theme's hero, drawn in CSS so the picker needs no screenshots. */
const PREVIEWS: Record<SiteTheme, React.ReactNode> = {
  default: (
    <div className="relative h-full overflow-hidden bg-[#07060c]">
      <div className="light-beam absolute -left-1/4 top-0 h-[140%] w-[110%] opacity-80" />
      <div className="absolute left-1/2 top-[22%] h-2 w-1/2 -translate-x-1/2 rounded-pill bg-white/80" />
      <div className="absolute left-1/2 top-[34%] h-1.5 w-1/3 -translate-x-1/2 rounded-pill bg-white/40" />
      <div className="absolute left-1/2 top-[60%] h-14 w-14 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_38%_30%,#ddd3fe,#6236f0_45%,#150840)] shadow-[0_0_40px_#7c58f8]" />
    </div>
  ),
  kawaii: (
    <div
      className="relative h-full overflow-hidden bg-cover bg-bottom"
      style={{ backgroundImage: 'url(/images/themes/kawaii/hero.webp)', backgroundColor: '#f6dff0' }}
    >
      <div className="absolute left-1/2 top-[18%] h-2 w-1/2 -translate-x-1/2 rounded-pill bg-[#3b2257]/80" />
      <div className="absolute left-1/2 top-[30%] h-1.5 w-1/3 -translate-x-1/2 rounded-pill bg-[#3b2257]/40" />
      <div className="absolute left-1/2 top-[44%] h-3 w-16 -translate-x-1/2 rounded-pill bg-gradient-to-r from-[#ff9ccf] to-[#b79cff]" />
    </div>
  ),
};

export default function AppearancePage() {
  const { data, setData } = useApi<{ value: AppearanceSettings }>(
    '/admin/super/settings/appearance',
  );
  const [value, setValue] = useState<AppearanceSettings | null>(null);
  const { busy, run } = useAction();
  useEffect(() => setValue(data?.value ?? null), [data]);
  if (!value) return <Loading />;

  const saved = data?.value;
  const dirty = !saved || saved.theme !== value.theme || saved.music !== value.music;

  return (
    <>
      <PageHeader
        title="Website theme"
        description="Choose how the public website and sign-in pages look. Every theme shows the same pages, copy, plans and FAQs — only the design changes."
        actions={
          <a href="/" target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
            <ExternalLink size={14} aria-hidden="true" /> View website
          </a>
        }
      />
      <div className="grid max-w-4xl gap-6">
        <Section title="Theme" description="The change is live for visitors within a few seconds.">
          <fieldset>
            <legend className="sr-only">Website theme</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {SITE_THEMES.map((theme) => {
                const selected = value.theme === theme;
                const live = saved?.theme === theme;
                return (
                  <label
                    key={theme}
                    className={cn(
                      'group relative block cursor-pointer rounded-lg border bg-surface p-2 transition',
                      selected
                        ? 'border-ink ring-2 ring-ink'
                        : 'border-line hover:border-brand-300',
                    )}
                  >
                    <input
                      type="radio"
                      name="theme"
                      value={theme}
                      checked={selected}
                      onChange={() => setValue({ ...value, theme })}
                      className="sr-only"
                    />
                    <div className="aspect-[16/9] overflow-hidden rounded-[calc(var(--pv-radius-lg)-6px)]">
                      {PREVIEWS[theme]}
                    </div>
                    <div className="flex items-start justify-between gap-3 px-3 pb-3 pt-4">
                      <div>
                        <p className="flex items-center gap-2 font-semibold">
                          {SITE_THEME_INFO[theme].name}
                          {live && <span className="badge badge-success">Live</span>}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {SITE_THEME_INFO[theme].description}
                        </p>
                      </div>
                      <span
                        className={cn(
                          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                          selected ? 'border-ink bg-ink text-white' : 'border-line',
                        )}
                        aria-hidden="true"
                      >
                        {selected && <Check size={14} />}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Section>

        <Section
          title="Background music"
          description="Themes that come with music show visitors a small play button. Music never starts on its own."
        >
          <label className="flex items-center justify-between gap-4 rounded-lg border border-line p-4">
            <span>
              <span className="font-medium">Offer background music</span>
              <span className="mt-0.5 block text-sm text-muted">
                {value.theme === 'default'
                  ? 'The Purple Voice theme has no music; this applies to themes that do.'
                  : 'Visitors can play or pause it from the corner of the page.'}
              </span>
            </span>
            <input
              type="checkbox"
              className="checkbox h-5 w-5"
              checked={value.music}
              onChange={(e) => setValue({ ...value, music: e.target.checked })}
            />
          </label>
        </Section>

        <div>
          <button
            className="btn btn-primary"
            disabled={busy || !dirty}
            onClick={async () => {
              const result = await run(
                () =>
                  api<{ value: AppearanceSettings }>('/admin/super/settings/appearance', {
                    method: 'PUT',
                    body: value,
                  }),
                'Website theme saved',
              );
              if (result) setData(result);
            }}
          >
            Save theme
          </button>
        </div>
      </div>
    </>
  );
}
