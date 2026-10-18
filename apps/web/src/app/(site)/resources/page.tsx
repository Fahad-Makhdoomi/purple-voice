import type { Metadata } from 'next';
import { PostIndex } from '@/components/site/shared/PostIndex';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Resources',
  description:
    'Free call scripts, checklists, templates, glossaries and calculators for teams using AI voice agents for outbound and inbound calling.',
  alternates: { canonical: '/resources' },
};

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  return (
    <PostIndex
      base="/resources"
      section="resources"
      page={page}
      eyebrow="Resources"
      title="Templates, checklists and scripts"
      lead="Practical, copy-ready material for running better sales calls, with or without an AI agent."
      empty="Resources are on the way."
    />
  );
}
