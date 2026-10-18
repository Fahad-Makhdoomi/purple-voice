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
import { MediaPickerModal } from '@/components/admin/MediaLibrary';
import { RESOURCE_CATEGORIES } from '@pv/shared';
import {
  AdvancedSeo,
  EMPTY_ADVANCED_SEO,
  FaqEditor,
  HowToEditor,
  SeoScore,
  useSeoReport,
  type AdvancedSeoFields,
} from '@/components/admin/PostSeo';

/** A Date as the value of a datetime-local input, in the browser's time zone. */
const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

interface PostDraft extends SeoFields, AdvancedSeoFields {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string | null;
  tags: string[];
  status: 'DRAFT' | 'PUBLISHED';
  publishedAt: string | null;
}

const EMPTY: PostDraft = {
  slug: '',
  title: '',
  excerpt: '',
  body: '',
  coverImageUrl: null,
  tags: [],
  status: 'DRAFT',
  publishedAt: null,
  seoTitle: null,
  seoDescription: null,
  ogImageUrl: null,
  noindex: false,
  ...EMPTY_ADVANCED_SEO,
};

export default function PostEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';
  const [draft, setDraft] = useState<PostDraft | null>(isNew ? EMPTY : null);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [cover, setCover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useAction();

  useEffect(() => {
    if (isNew) return;
    api<{ post: PostDraft }>(`/admin/cms/posts/${id}`).then(({ post }) =>
      setDraft(
        Object.fromEntries(
          Object.keys(EMPTY).map((k) => [
            k,
            post[k as keyof PostDraft] ?? EMPTY[k as keyof PostDraft],
          ]),
        ) as unknown as PostDraft,
      ),
    );
  }, [id, isNew]);

  // Hooks run on every render, so the report is computed from an empty draft while loading.
  const report = useSeoReport(draft ?? EMPTY);
  if (!draft) return <Loading />;
  const set = (patch: Partial<PostDraft>) => setDraft({ ...draft, ...patch });
  const folder = `blog/${draft.slug || 'drafts'}`;
  const base =
    draft.category && (RESOURCE_CATEGORIES as readonly string[]).includes(draft.category)
      ? '/resources'
      : '/blog';
  const scheduled = !!draft.publishedAt && new Date(draft.publishedAt).getTime() > Date.now();

  async function save(status?: 'DRAFT' | 'PUBLISHED') {
    setError(null);
    const body = {
      ...draft!,
      status: status ?? draft!.status,
      // Half-filled questions and steps are dropped rather than refused.
      faq: draft!.faq.filter((f) => f.question.trim().length >= 3 && f.answer.trim()),
      howToSteps: draft!.howToSteps.filter(
        (s) => s.name.trim().length >= 2 && s.text.trim().length >= 2,
      ),
    };
    try {
      if (isNew) {
        const { post } = await api<{ post: { id: string } }>('/admin/cms/posts', { body });
        toast('Post created');
        router.replace(`/admin/content/blog/${post.id}`);
      } else {
        const { post } = await api<{ post: PostDraft }>(`/admin/cms/posts/${id}`, {
          method: 'PATCH',
          body,
        });
        setDraft({ ...body, publishedAt: post.publishedAt });
        toast(body.status === 'PUBLISHED' ? 'Saved — live on the site within seconds' : 'Saved');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save');
    }
  }

  return (
    <>
      <PageHeader
        title={isNew ? 'New post' : draft.title || 'Untitled'}
        back={{ href: '/admin/content/blog', label: 'Blog' }}
        actions={
          <>
            {!isNew && (
              <button
                className="btn btn-ghost text-danger"
                disabled={busy}
                onClick={() =>
                  window.confirm('Delete this post?') &&
                  run(async () => {
                    await api(`/admin/cms/posts/${id}`, { method: 'DELETE' });
                    router.push('/admin/content/blog');
                  }, 'Post deleted')
                }
              >
                Delete
              </button>
            )}
            {draft.status === 'PUBLISHED' && !isNew && (
              <a
                href={`${base}/${draft.slug}`}
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
              {scheduled ? 'Schedule' : 'Publish'}
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
              <Field id="title" label="Title" className="sm:col-span-2">
                <input
                  id="title"
                  className="input text-base font-semibold"
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
                label="URL slug"
                help={`${base}/${draft.slug || 'your-post'}. Changing it later redirects the old address.`}
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
              <Field id="tags" label="Tags" help="Comma separated">
                <input
                  id="tags"
                  className="input"
                  value={draft.tags.join(', ')}
                  onChange={(e) =>
                    set({
                      tags: e.target.value
                        .split(',')
                        .map((t) => t.trim())
                        .filter(Boolean)
                        .slice(0, 12),
                    })
                  }
                />
              </Field>
              <Field
                id="excerpt"
                label="Excerpt"
                className="sm:col-span-2"
                help="Shown on the blog index and in link previews."
              >
                <textarea
                  id="excerpt"
                  className="textarea min-h-[70px]"
                  maxLength={400}
                  value={draft.excerpt}
                  onChange={(e) => set({ excerpt: e.target.value })}
                />
              </Field>
            </div>
          </Section>
          <Section>
            <MarkdownEditor value={draft.body} onChange={(body) => set({ body })} folder={folder} />
          </Section>
          <Section
            title="Advanced SEO"
            description="Keywords, the social card, canonical address and how search engines classify the post."
          >
            <AdvancedSeo
              value={draft}
              onChange={set}
              title={draft.seoTitle || draft.title}
              description={draft.seoDescription || draft.excerpt}
              image={draft.ogImageUrl || draft.coverImageUrl}
              path={`${base}/${draft.slug}`}
            />
          </Section>
          <Section
            title="FAQs"
            description="Shown under the post and marked up as FAQPage, which can earn rich results."
          >
            <FaqEditor items={draft.faq} onChange={(faq) => set({ faq })} />
          </Section>
          {draft.schemaType === 'HowTo' && (
            <Section title="How-to steps" description="Marked up as HowTo structured data.">
              <HowToEditor
                items={draft.howToSteps}
                onChange={(howToSteps) => set({ howToSteps })}
              />
            </Section>
          )}
        </div>
        <div className="space-y-5">
          <Section title="SEO score">
            <SeoScore report={report} />
          </Section>
          <Section title="Publishing">
            <Field
              id="publishedAt"
              label="Publish date"
              help={
                scheduled
                  ? 'Scheduled: it goes live by itself at this time.'
                  : 'Pick a future time and press Schedule to publish it later.'
              }
            >
              <input
                id="publishedAt"
                type="datetime-local"
                className="input"
                value={toLocalInput(draft.publishedAt)}
                onChange={(e) =>
                  set({
                    publishedAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                  })
                }
              />
            </Field>
          </Section>
          <Section title="Cover image">
            {draft.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draft.coverImageUrl}
                alt=""
                className="aspect-[16/9] w-full rounded-sm object-cover"
              />
            ) : (
              <div className="grid-pattern aspect-[16/9] rounded-sm bg-gradient-pastel" />
            )}
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setCover(true)}
              >
                Choose image
              </button>
              {draft.coverImageUrl && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => set({ coverImageUrl: null })}
                >
                  Remove
                </button>
              )}
            </div>
          </Section>
          <Section title="Search & social">
            <SeoPanel
              value={draft}
              onChange={(seo) => set(seo)}
              title={draft.title}
              body={draft.body}
              path={`/blog/${draft.slug}`}
              folder={folder}
            />
          </Section>
        </div>
      </div>
      <MediaPickerModal
        open={cover}
        folder={folder}
        onClose={() => setCover(false)}
        onPick={(a) => set({ coverImageUrl: a.url })}
      />
    </>
  );
}
