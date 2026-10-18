import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { RESOURCE_CATEGORIES } from '@pv/shared';
import { Markdown } from '@/components/site/Markdown';
import { JsonLd } from '@/components/site/JsonLd';
import { CtaBand } from '@/components/site/shared/CtaBand';
import { getPost, getSettings } from '@/lib/server-api';
import { formatDate } from '@/lib/format';
import { siteUrl } from '@/lib/config';

type Base = '/blog' | '/resources';

const isResource = (category: string | null) =>
  !!category && (RESOURCE_CATEGORIES as readonly string[]).includes(category);

/** A post belongs to exactly one section; the other section's URL is a 404. */
const inSection = (base: Base, category: string | null) =>
  base === '/resources' ? isResource(category) : !isResource(category);

export async function postMetadata(base: Base, slug: string): Promise<Metadata> {
  const data = await getPost(slug);
  if (!data || !inSection(base, data.post.category)) return {};
  const { post } = data;
  const image = post.ogImageUrl || post.coverImageUrl;
  return {
    title: post.seoTitle || post.title,
    description: post.seoDescription || post.excerpt,
    alternates: { canonical: `${base}/${post.slug}` },
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

export async function PostArticle({ base, slug }: { base: Base; slug: string }) {
  const [data, { seo }] = await Promise.all([getPost(slug), getSettings()]);
  if (!data || !inSection(base, data.post.category)) notFound();
  const { post, related } = data;
  const label = base === '/blog' ? 'All posts' : 'All resources';
  const url = `${siteUrl}${base}/${post.slug}`;
  const faq = post.faq ?? [];
  const steps = post.howToSteps ?? [];
  const absolute = (src: string) => (src.startsWith('/') ? `${siteUrl}${src}` : src);

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': post.schemaType === 'HowTo' ? 'Article' : post.schemaType || 'BlogPosting',
          headline: post.title,
          description: post.excerpt,
          datePublished: post.publishedAt,
          dateModified: post.updatedAt,
          author: { '@type': 'Organization', name: post.author?.name ?? seo.siteName },
          publisher: { '@type': 'Organization', name: seo.siteName },
          mainEntityOfPage: url,
          ...(post.coverImageUrl ? { image: absolute(post.coverImageUrl) } : {}),
        }}
      />
      {post.schemaType === 'HowTo' && steps.length > 0 && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'HowTo',
            name: post.title,
            description: post.excerpt,
            step: steps.map((s) => ({ '@type': 'HowToStep', name: s.name, text: s.text })),
          }}
        />
      )}
      {faq.length > 0 && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faq.map((f) => ({
              '@type': 'Question',
              name: f.question,
              acceptedAnswer: { '@type': 'Answer', text: f.answer },
            })),
          }}
        />
      )}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
            {
              '@type': 'ListItem',
              position: 2,
              name: base === '/blog' ? 'Blog' : 'Resources',
              item: `${siteUrl}${base}`,
            },
            { '@type': 'ListItem', position: 3, name: post.title, item: url },
          ],
        }}
      />
      <article className="bg-surface pb-section pt-[calc(var(--pv-header-h)+56px)]">
        <div className="container max-w-narrow">
          <Link
            href={base}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-900"
          >
            <ArrowLeft size={16} aria-hidden="true" /> {label}
          </Link>
          <p className="mt-8 text-sm font-semibold text-muted">
            {post.category ? `${post.category} · ` : ''}
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
                alt={post.title}
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
          {faq.length > 0 && (
            <section className="mt-14" aria-labelledby="post-faq">
              <h2 id="post-faq" className="text-h3">
                Frequently asked questions
              </h2>
              <div className="mt-6 divide-y divide-line rounded-lg border border-line">
                {faq.map((f) => (
                  <details key={f.question} className="group p-5">
                    <summary className="cursor-pointer font-semibold">{f.question}</summary>
                    <p className="mt-3 leading-relaxed text-ink-soft">{f.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
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
                    href={`${isResource(r.category) ? '/resources' : '/blog'}/${r.slug}`}
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
