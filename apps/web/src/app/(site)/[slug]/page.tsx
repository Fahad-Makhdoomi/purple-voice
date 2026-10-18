import type { Metadata } from 'next';
import { pageBlocksSchema } from '@pv/shared';
import { Markdown } from '@/components/site/Markdown';
import { PageIntro } from '@/components/site/shared/PageIntro';
import { PageBlocks } from '@/components/site/blocks/PageBlocks';
import { getFaqs, getPage, getPlans, getSettings } from '@/lib/server-api';
import { fillLegal } from '@/lib/legal';
import { notFoundOrMoved } from '@/lib/moved';
import { formatDate } from '@/lib/format';

/**
 * Pages managed in Admin → Content → Pages: written in Markdown (privacy,
 * terms, about) or built from blocks in the page builder (landing pages).
 */
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
    alternates: { canonical: page.canonicalUrl || `/${page.slug}` },
    robots: page.noindex ? { index: false } : undefined,
    openGraph: page.ogImageUrl ? { images: [{ url: page.ogImageUrl }] } : undefined,
  };
}

export default async function CmsPage({ params }: Props) {
  const { slug } = await params;
  const [page, settings] = await Promise.all([getPage(slug), getSettings()]);
  if (!page) return notFoundOrMoved(`/${slug}`);

  if (page.layout === 'builder') {
    // Blocks were validated when saved; parsing again fills defaults added since.
    const parsed = pageBlocksSchema.safeParse(page.blocks ?? []);
    const blocks = parsed.success ? parsed.data : [];
    const needs = new Set(blocks.map((b) => b.type));
    const [plans, faqs] = await Promise.all([
      needs.has('pricing') ? getPlans() : Promise.resolve([]),
      needs.has('faq') ? getFaqs() : Promise.resolve([]),
    ]);
    return (
      <div className="bg-surface">
        <PageBlocks
          blocks={blocks}
          data={{
            plans,
            faqs,
            captcha: {
              provider: settings.captcha.provider,
              enabled: !!settings.captcha.forms.contact,
            },
          }}
        />
      </div>
    );
  }

  return (
    <>
      <PageIntro
        title={page.title}
        lead={`Last updated ${formatDate(page.updatedAt, { dateStyle: 'long' })}`}
      />
      <section className="bg-surface py-16 sm:py-20">
        <div className="container max-w-narrow">
          <Markdown>{fillLegal(page.body, settings.legal, settings.seo)}</Markdown>
        </div>
      </section>
    </>
  );
}
