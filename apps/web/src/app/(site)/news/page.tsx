import type { Metadata } from 'next';
import { PostIndex } from '@/components/site/shared/PostIndex';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'AI voice news',
  description:
    'The latest AI voice agent news: launches, funding, acquisitions and regulation, and what each story means for sales and support teams.',
  alternates: { canonical: '/news' },
};

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  return (
    <PostIndex
      base="/news"
      section="news"
      page={page}
      eyebrow="News"
      title="AI voice news"
      lead="Launches, funding, deals and rules shaping AI voice agents, with what each one means for teams that sell and support by phone."
      empty="The first stories are on their way."
    />
  );
}
