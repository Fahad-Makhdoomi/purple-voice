import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PageIntro } from '@/components/site/shared/PageIntro';
import { CtaBand } from '@/components/site/shared/CtaBand';
import { getPosts } from '@/lib/server-api';
import { formatDate } from '@/lib/format';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Playbooks and product notes on AI voice agents, outbound calling and booking more meetings.',
  alternates: { canonical: '/blog' },
};

export default async function BlogPage() {
  const { posts } = await getPosts(1);
  return (
    <>
      <PageIntro
        eyebrow="Blog"
        title="Notes on AI-powered selling"
        lead="Playbooks, product updates and what we learn from millions of minutes of calls."
      />
      <section className="bg-canvas pb-section">
        <div className="container">
          {posts.length === 0 && (
            <p className="text-center text-muted">The first posts are being written.</p>
          )}
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, i) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block h-full rounded-lg border border-line bg-surface p-2 shadow transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="grid-pattern relative aspect-[16/9] overflow-hidden rounded-[calc(var(--pv-radius-lg)-6px)] bg-gradient-pastel">
                    {post.coverImageUrl && (
                      <Image
                        src={post.coverImageUrl}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 380px, (min-width: 768px) 50vw, 100vw"
                        className="object-cover"
                        priority={i < 3}
                      />
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-xs font-semibold text-brand-600">
                      {formatDate(post.publishedAt)}
                    </p>
                    <h2 className="mt-2 text-lg font-semibold leading-snug group-hover:text-brand-700">
                      {post.title}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
                      {post.excerpt}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <CtaBand />
    </>
  );
}
