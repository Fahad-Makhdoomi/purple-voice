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

interface PostDraft extends SeoFields {
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
          Object.keys(EMPTY).map((k) => [k, post[k as keyof PostDraft]]),
        ) as unknown as PostDraft,
      ),
    );
  }, [id, isNew]);

  if (!draft) return <Loading />;
  const set = (patch: Partial<PostDraft>) => setDraft({ ...draft, ...patch });
  const folder = `blog/${draft.slug || 'drafts'}`;

  async function save(status?: 'DRAFT' | 'PUBLISHED') {
    setError(null);
    const body = { ...draft!, status: status ?? draft!.status };
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
                href={`/blog/${draft.slug}`}
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
              <Field id="slug" label="URL slug" help={`/blog/${draft.slug || 'your-post'}`}>
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
        </div>
        <div className="space-y-5">
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
