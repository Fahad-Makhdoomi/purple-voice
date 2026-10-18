import type { Metadata } from 'next';
import { PostArticle, postMetadata } from '@/components/site/shared/PostArticle';
import { getPosts } from '@/lib/server-api';

export const revalidate = 3600;

export async function generateStaticParams() {
  const { posts } = await getPosts(1, undefined, 'resources', 100);
  return posts.map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return postMetadata('/resources', (await params).slug);
}

export default async function ResourcePage({ params }: Props) {
  return <PostArticle base="/resources" slug={(await params).slug} />;
}
