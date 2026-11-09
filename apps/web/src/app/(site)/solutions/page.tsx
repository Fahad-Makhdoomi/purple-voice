import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { SOLUTION_CATEGORIES } from '@pv/shared';
import { PageIntro } from '@/components/site/shared/PageIntro';
import { CtaBand } from '@/components/site/shared/CtaBand';
import { getPosts, type PostSummary } from '@/lib/server-api';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'AI voice agent solutions by use case and industry',
  description:
    'AI voice agents for sales, recruitment, insurance, customer care, call qualification, pre-screening, AI IVR and outbound calling. Pick your use case and see how it works.',
  alternates: { canonical: '/solutions' },
};

async function allSolutions(): Promise<PostSummary[]> {
  const out: PostSummary[] = [];
  for (let page = 1; page <= 5; page++) {
    const { posts, total } = await getPosts(page, undefined, 'solutions', 100);
    out.push(...posts);
    if (out.length >= total || posts.length === 0) break;
  }
  return out;
}

export default async function SolutionsPage() {
  const posts = await allSolutions();
  // The pillar (hub) page was published first, so oldest-first puts it at the top of each group.
  const groups = SOLUTION_CATEGORIES.map((category) => ({
    category,
    items: posts
      .filter((p) => p.category === category)
      .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt)),
  })).filter((g) => g.items.length > 0);

  return (
    <>
      <PageIntro
        eyebrow="Solutions"
        title="AI voice agents for the calls your team can't keep up with"
        lead="Pick your use case or industry. Each page shows what the agent does, a sample call, what to set up first, and where it still needs a person."
      />
      <section className="bg-canvas pb-section">
        <div className="container space-y-16">
          <nav aria-label="Solution categories" className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <a key={g.category} href={`#${g.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} className="badge badge-brand">
                {g.category}
              </a>
            ))}
          </nav>
          {groups.map((g) => {
            const [hub, ...rest] = g.items;
            return (
              <div key={g.category} id={g.category.toLowerCase().replace(/[^a-z0-9]+/g, '-')} className="scroll-mt-28">
                <h2 className="text-h2">{g.category}</h2>
                {hub && (
                  <Link
                    href={`/solutions/${hub.slug}`}
                    className="group mt-6 grid overflow-hidden rounded-lg border border-line bg-surface shadow transition hover:shadow-lg md:grid-cols-2"
                  >
                    <div className="grid-pattern relative aspect-[16/9] bg-gradient-pastel md:aspect-auto md:min-h-[220px]">
                      {hub.coverImageUrl && (
                        <Image
                          src={hub.coverImageUrl}
                          alt=""
                          fill
                          sizes="(min-width: 768px) 50vw, 100vw"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <div className="p-6 md:p-8">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-600">
                        Start here
                      </p>
                      <h3 className="mt-2 text-h3 group-hover:text-brand-700">{hub.title}</h3>
                      <p className="mt-3 leading-relaxed text-muted">{hub.excerpt}</p>
                    </div>
                  </Link>
                )}
                <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((p) => (
                    <li key={p.slug}>
                      <Link
                        href={`/solutions/${p.slug}`}
                        className="card card-pad block h-full transition hover:-translate-y-0.5 hover:shadow-lg"
                      >
                        <p className="font-semibold leading-snug">{p.title}</p>
                        <p className="mt-2 line-clamp-2 text-sm text-muted">{p.excerpt}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
      <CtaBand />
    </>
  );
}
