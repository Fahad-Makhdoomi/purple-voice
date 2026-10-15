import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Markdown } from '@/components/site/Markdown';
import { JsonLd } from '@/components/site/JsonLd';
import { CtaBand } from '@/components/site/shared/CtaBand';
import { getPost, getPosts, getSettings } from '@/lib/server-api';
import { formatDate } from '@/lib/format';
import { siteUrl } from '@/lib/config';

export const revalidate = 3600;

export async function generateStaticParams() {
  const { posts } = await getPosts(1);
  return posts.map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPost(slug);
  if (!data) return {};
  const { post } = data;
  const image = post.ogImageUrl || post.coverImageUrl;
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    alternates: { canonical: `/blog/${post.slug}` },
    robots: post.noindex ? { index: false } : undefined,
    openGraph: {
      type: 'article',
      title: post.seoTitle || post.title,
      description: post.seoDescription || post.excerpt,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const [data, { seo }] = await Promise.all([getPost(slug), getSettings()]);
  if (!data) notFound();
  const { post, related } = data;

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.excerpt,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          author: { '@type': 'Organization', name: post.author?.name ?? seo.siteName },
          publisher: { '@type': 'Organization', name: seo.siteName },
          mainEntityOfPage: `${siteUrl}/blog/${post.slug}`,
          ...(post.coverImageUrl ? { image: post.coverImageUrl } : {}),
        }}
      />
      <article className="bg-surface pb-section pt-[calc(var(--pv-header-h)+56px)]">
        <div className="container max-w-narrow">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-900"
          >
            <ArrowLeft size={16} aria-hidden="true" /> All posts
          </Link>
          <p className="mt-8 text-sm font-semibold text-muted">
            {formatDate(post.publishedAt, { dateStyle: 'long' })}
            {post.author ? ` · ${post.author.name}` : ''}
          </p>
          <h1 className="mt-3 text-h1">{post.title}</h1>
          {post.excerpt && <p className="mt-5 text-lead text-ink-soft">{post.excerpt}</p>}
        </div>
        {post.coverImageUrl && (
          <div className="container mt-10 max-w-4xl">
            <div className="relative aspect-[16/9] overflow-hidden rounded-xl">
              <Image
                src={post.coverImageUrl}
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 896px, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        )}
        <div className="container mt-12 max-w-narrow">
          <Markdown>{post.body}</Markdown>
          {post.tags.length > 0 && (
            <ul className="mt-12 flex flex-wrap gap-2">
              {post.tags.map((t) => (
                <li key={t} className="badge badge-brand">
                  {t}
                </li>
              ))}
            </ul>
          )}
        </div>
      </article>

      {related.length > 0 && (
        <section className="bg-canvas py-16" aria-labelledby="related-title">
          <div className="container max-w-4xl">
            <h2 id="related-title" className="text-h3">
              Keep reading
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-3">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/blog/${r.slug}`}
                    className="card card-pad block h-full transition hover:shadow-lg"
                  >
                    <p className="font-semibold leading-snug">{r.title}</p>
                    <p className="mt-2 line-clamp-2 text-sm text-muted">{r.excerpt}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
      <CtaBand />
    </>
  );
}
