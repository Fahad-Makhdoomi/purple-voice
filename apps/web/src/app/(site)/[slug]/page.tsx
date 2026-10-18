import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Markdown } from '@/components/site/Markdown';
import { PageIntro } from '@/components/site/shared/PageIntro';
import { getPage, getSettings } from '@/lib/server-api';
import { fillLegal } from '@/lib/legal';
import { formatDate } from '@/lib/format';

/** Pages managed in Admin → Content → Pages (privacy, terms, about, landing pages…). */
export const revalidate = 3600;
export const dynamicParams = true;

export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return {};
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription ?? undefined,
    alternates: { canonical: `/${page.slug}` },
    robots: page.noindex ? { index: false } : undefined,
    openGraph: page.ogImageUrl ? { images: [{ url: page.ogImageUrl }] } : undefined,
  };
}

export default async function CmsPage({ params }: Props) {
  const { slug } = await params;
  const [page, { legal, seo }] = await Promise.all([getPage(slug), getSettings()]);
  if (!page) notFound();
  return (
    <>
      <PageIntro
        title={page.title}
        lead={`Last updated ${formatDate(page.updatedAt, { dateStyle: 'long' })}`}
      />
      <section className="bg-surface py-16 sm:py-20">
        <div className="container max-w-narrow">
          <Markdown>{fillLegal(page.body, legal, seo)}</Markdown>
        </div>
      </section>
    </>
  );
}
