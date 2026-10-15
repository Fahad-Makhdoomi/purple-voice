'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { ErrorNote, Loading, PageHeader, Section, toast, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';
import {
  MarkdownEditor,
  SeoPanel,
  slugify,
  type SeoFields,
} from '@/components/admin/ContentEditor';

interface PageDraft extends SeoFields {
  slug: string;
  title: string;
  body: string;
  status: 'DRAFT' | 'PUBLISHED';
  showInFooter: boolean;
}

const EMPTY: PageDraft = {
  slug: '',
  title: '',
  body: '',
  status: 'DRAFT',
  showInFooter: false,
  seoTitle: null,
  seoDescription: null,
  ogImageUrl: null,
  noindex: false,
};

export default function PageEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';
  const [draft, setDraft] = useState<PageDraft | null>(isNew ? EMPTY : null);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useAction();

  useEffect(() => {
    if (isNew) return;
    api<{ page: PageDraft }>(`/admin/cms/pages/${id}`).then(({ page }) =>
      setDraft({
        ...EMPTY,
        ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, page[k as keyof PageDraft]])),
      } as PageDraft),
    );
  }, [id, isNew]);

  if (!draft) return <Loading />;
  const set = (patch: Partial<PageDraft>) => setDraft({ ...draft, ...patch });

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
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <Section>
            <div className="grid gap-5 sm:grid-cols-2">
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
              <Field id="slug" label="URL slug" help={`/${draft.slug || 'your-page'}`}>
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
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="checkbox"
                checked={draft.showInFooter}
                onChange={(e) => set({ showInFooter: e.target.checked })}
              />
              Link from the site footer
            </label>
          </Section>
          <Section>
            <MarkdownEditor
              value={draft.body}
              onChange={(body) => set({ body })}
              folder={`pages/${draft.slug || 'general'}`}
            />
          </Section>
        </div>
        <Section title="Search & social">
          <SeoPanel
            value={draft}
            onChange={(seo) => set(seo)}
            title={draft.title}
            body={draft.body}
            path={`/${draft.slug}`}
            folder={`pages/${draft.slug || 'general'}`}
          />
        </Section>
      </div>
    </>
  );
}
