import type { Metadata } from 'next';
import { PostArticle, postMetadata } from '@/components/site/shared/PostArticle';
import { getPosts } from '@/lib/server-api';

export const revalidate = 3600;

export async function generateStaticParams() {
  const { posts } = await getPosts(1, undefined, 'news', 100);
  return posts.map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return postMetadata('/news', (await params).slug);
}

export default async function NewsArticlePage({ params }: Props) {
  return <PostArticle base="/news" slug={(await params).slug} />;
}
