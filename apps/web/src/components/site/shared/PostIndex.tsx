import Image from 'next/image';
import Link from 'next/link';
import { PageIntro } from '@/components/site/shared/PageIntro';
import { CtaBand } from '@/components/site/shared/CtaBand';
import { getPosts } from '@/lib/server-api';
import { formatDate } from '@/lib/format';

const PAGE_SIZE = 12;

/** The card grid + pagination shared by /blog and /resources. */
export async function PostIndex({
  base,
  section,
  page,
  eyebrow,
  title,
  lead,
  empty,
}: {
  base: '/blog' | '/resources';
  section: 'blog' | 'resources';
  page: number;
  eyebrow: string;
  title: string;
  lead: string;
  empty: string;
}) {
  const { posts, total } = await getPosts(page, undefined, section, PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (n: number) => (n === 1 ? base : `${base}?page=${n}`);

  return (
    <>
      <PageIntro eyebrow={eyebrow} title={title} lead={lead} />
      <section className="bg-canvas pb-section">
        <div className="container">
          {posts.length === 0 && <p className="text-center text-muted">{empty}</p>}
          <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post, i) => (
              <li key={post.slug}>
                <Link
                  href={`${base}/${post.slug}`}
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
                      {post.category ? `${post.category} · ` : ''}
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
          {pages > 1 && (
            <nav aria-label="Pagination" className="mt-12 flex items-center justify-center gap-2">
              {page > 1 && (
                <Link href={href(page - 1)} rel="prev" className="btn btn-secondary">
                  Previous
                </Link>
              )}
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <Link
                  key={n}
                  href={href(n)}
                  aria-current={n === page ? 'page' : undefined}
                  className={n === page ? 'btn btn-primary' : 'btn btn-secondary'}
                >
                  {n}
                </Link>
              ))}
              {page < pages && (
                <Link href={href(page + 1)} rel="next" className="btn btn-secondary">
                  Next
                </Link>
              )}
            </nav>
          )}
        </div>
      </section>
      <CtaBand />
    </>
  );
}
