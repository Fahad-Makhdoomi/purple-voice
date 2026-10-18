'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { FileText, LayoutTemplate } from 'lucide-react';
import {
  PAGE_TEMPLATES,
  pageBlocksSchema,
  templateBlocks,
  type PageBlock,
  type PageTemplate,
} from '@pv/shared';
import { api, ApiError } from '@/lib/api';
import { ErrorNote, Loading, PageHeader, Section, toast, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';
import {
  MarkdownEditor,
  SeoPanel,
  slugify,
  type SeoFields,
} from '@/components/admin/ContentEditor';
import { PageBuilder } from '@/components/admin/builder/PageBuilder';
import { cn } from '@/lib/cn';

interface PageDraft extends SeoFields {
  slug: string;
  title: string;
  body: string;
  layout: 'markdown' | 'builder';
  blocks: PageBlock[];
  status: 'DRAFT' | 'PUBLISHED';
  showInFooter: boolean;
  showInHeader: boolean;
  navLabel: string | null;
  navOrder: number;
  canonicalUrl: string | null;
}

const EMPTY: PageDraft = {
  slug: '',
  title: '',
  body: '',
  layout: 'markdown',
  blocks: [],
  status: 'DRAFT',
  showInFooter: false,
  showInHeader: false,
  navLabel: null,
  navOrder: 0,
  canonicalUrl: null,
  seoTitle: null,
  seoDescription: null,
  ogImageUrl: null,
  noindex: false,
};

/** A new builder page from ?template=landing|feature|about|pricing|blank. */
function initialDraft(template: string | null): PageDraft {
  if (!template || !(template in PAGE_TEMPLATES)) return EMPTY;
  return { ...EMPTY, layout: 'builder', blocks: templateBlocks(template as PageTemplate) };
}

/** Plain text of a builder page, for the AI SEO draft. */
function blocksText(blocks: PageBlock[]): string {
  return blocks
    .flatMap((b) =>
      Object.values(b).filter((v): v is string => typeof v === 'string' && v.length > 3),
    )
    .join('\n\n');
}

function PageEditorInner() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const isNew = id === 'new';
  const [draft, setDraft] = useState<PageDraft | null>(
    isNew ? initialDraft(params.get('template')) : null,
  );
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useAction();

  useEffect(() => {
    if (isNew) return;
    api<{ page: PageDraft }>(`/admin/cms/pages/${id}`).then(({ page }) => {
      const parsed = pageBlocksSchema.safeParse(page.blocks ?? []);
      setDraft({
        ...EMPTY,
        ...Object.fromEntries(
          Object.keys(EMPTY).map((k) => [
            k,
            page[k as keyof PageDraft] ?? EMPTY[k as keyof PageDraft],
          ]),
        ),
        blocks: parsed.success ? parsed.data : [],
      } as PageDraft);
    });
  }, [id, isNew]);

  if (!draft) return <Loading />;
  const set = (patch: Partial<PageDraft>) => setDraft({ ...draft, ...patch });
  const folder = `pages/${draft.slug || 'general'}`;

  async function save(status?: 'DRAFT' | 'PUBLISHED') {
    setError(null);
    const body = { ...draft!, status: status ?? draft!.status };
    try {
      if (isNew) {
        const { page } = await api<{ page: { id: string } }>('/admin/cms/pages', { body });
        toast('Page created');
        router.replace(`/admin/content/pages/${page.id}`);
      } else {
        await api(`/admin/cms/pages/${id}`, { method: 'PATCH', body });
        setDraft(body);
        toast(body.status === 'PUBLISHED' ? 'Saved — live on the site within seconds' : 'Saved');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save');
    }
  }

  return (
    <>
      <PageHeader
        title={isNew ? 'New page' : draft.title || 'Untitled'}
        back={{ href: '/admin/content/pages', label: 'Pages' }}
        actions={
          <>
            {!isNew && (
              <button
                className="btn btn-ghost text-danger"
                disabled={busy}
                onClick={() =>
                  window.confirm('Delete this page?') &&
                  run(async () => {
                    await api(`/admin/cms/pages/${id}`, { method: 'DELETE' });
                    router.push('/admin/content/pages');
                  }, 'Page deleted')
                }
              >
                Delete
              </button>
            )}
            {draft.status === 'PUBLISHED' && !isNew && (
              <a
                href={`/${draft.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                View
              </a>
            )}
            <button className="btn btn-secondary" onClick={() => save('DRAFT')}>
              Save draft
            </button>
            <button className="btn btn-primary" onClick={() => save('PUBLISHED')}>
              Publish
            </button>
          </>
        }
      />
      {error && (
        <div className="mb-4">
          <ErrorNote message={error} />
        </div>
      )}

      <div className="space-y-5">
        <Section>
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr_auto]">
            <Field id="title" label="Title">
              <input
                id="title"
                className="input"
                value={draft.title}
                onChange={(e) =>
                  set({
                    title: e.target.value,
                    ...(slugTouched ? {} : { slug: slugify(e.target.value) }),
                  })
                }
              />
            </Field>
            <Field
              id="slug"
              label="URL"
              help={`/${draft.slug || 'your-page'}. Changing it later redirects the old address.`}
            >
              <input
                id="slug"
                className="input font-mono"
                value={draft.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set({ slug: slugify(e.target.value) });
                }}
              />
            </Field>
            <fieldset>
              <legend className="label">Build with</legend>
              <div className="flex gap-1 rounded-sm bg-canvas p-1">
                {(
                  [
                    ['builder', 'Page builder', LayoutTemplate],
                    ['markdown', 'Text', FileText],
                  ] as const
                ).map(([value, label, Icon]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={draft.layout === value}
                    className={cn(
                      'flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium',
                      draft.layout === value ? 'bg-surface shadow-sm' : 'text-muted',
                    )}
                    onClick={() => set({ layout: value })}
                  >
                    <Icon size={15} aria-hidden="true" /> {label}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="checkbox"
                checked={draft.showInHeader}
                onChange={(e) => set({ showInHeader: e.target.checked })}
              />
              Show in the header menu
            </label>
            {draft.showInHeader && (
              <>
                <input
                  className="input h-9 w-44 text-sm"
                  aria-label="Menu label"
                  placeholder="Menu label (optional)"
                  maxLength={40}
                  value={draft.navLabel ?? ''}
                  onChange={(e) => set({ navLabel: e.target.value || null })}
                />
                <label className="flex items-center gap-2">
                  Position
                  <input
                    type="number"
                    className="input h-9 w-20 text-sm"
                    min={0}
                    max={1000}
                    value={draft.navOrder}
                    onChange={(e) => set({ navOrder: Number(e.target.value) || 0 })}
                  />
                </label>
              </>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="checkbox"
                checked={draft.showInFooter}
                onChange={(e) => set({ showInFooter: e.target.checked })}
              />
              Link from the footer
            </label>
          </div>
        </Section>

        {draft.layout === 'builder' ? (
          <PageBuilder
            blocks={draft.blocks}
            onChange={(blocks) => set({ blocks })}
            folder={folder}
          />
        ) : (
          <Section>
            <MarkdownEditor value={draft.body} onChange={(body) => set({ body })} folder={folder} />
          </Section>
        )}

        <Section title="Search & social">
          <div className="max-w-2xl">
            <SeoPanel
              value={draft}
              onChange={(seo) => set(seo)}
              title={draft.title}
              body={draft.layout === 'builder' ? blocksText(draft.blocks) : draft.body}
              path={`/${draft.slug}`}
              folder={folder}
            />
            <div className="mt-4">
              <Field
                id="canonicalUrl"
                label="Canonical URL"
                optional
                help="Only if this page is a copy of one elsewhere."
              >
                <input
                  id="canonicalUrl"
                  type="url"
                  className="input font-mono text-xs"
                  value={draft.canonicalUrl ?? ''}
                  onChange={(e) => set({ canonicalUrl: e.target.value || null })}
                  placeholder="https://"
                />
              </Field>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}

export default function PageEditor() {
  return (
    <Suspense fallback={<Loading />}>
      <PageEditorInner />
    </Suspense>
  );
}
