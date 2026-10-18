import type { Metadata } from 'next';
import { PostIndex } from '@/components/site/shared/PostIndex';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Blog',
  description:
    'Playbooks and product notes on AI voice agents, outbound calling and booking more meetings.',
  alternates: { canonical: '/blog' },
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  return (
    <PostIndex
      base="/blog"
      section="blog"
      page={page}
      eyebrow="Blog"
      title="Notes on AI-powered selling"
      lead="Playbooks, product updates and what we learn from millions of minutes of calls."
      empty="The first posts are being written."
    />
  );
}
