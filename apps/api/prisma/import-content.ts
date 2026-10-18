/**
 * Imports the Markdown articles in /content (blog + resources) into the Post table.
 *
 *   npm run db:import-content -w @pv/api            import / update everything
 *   npm run db:import-content -w @pv/api -- --check validate only, write nothing
 *
 * Each file is a JSON frontmatter block between two `---` lines followed by the
 * Markdown body (see content/BRIEF.md). Re-running is safe: posts are matched by
 * slug and updated in place. A cover image is only attached once its file exists
 * under apps/web/public, so articles never ship with a broken image.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { POST_SCHEMA_TYPES, RESOURCE_CATEGORIES, postSchema } from '@pv/shared';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const publicDir = path.join(root, 'apps/web/public');
const checkOnly = process.argv.includes('--check');

const BLOG_CATEGORIES = [
  'Guides',
  'Playbooks',
  'Use cases',
  'Compliance',
  'Comparisons',
  'Product',
] as const;

interface Article {
  file: string;
  section: 'blog' | 'resources';
  data: ReturnType<typeof postSchema.parse> & { cover?: string };
}

function parse(file: string, section: 'blog' | 'resources'): Article {
  const raw = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
  if (!m) throw new Error('missing --- frontmatter ---');
  const meta = JSON.parse(m[1]!) as Record<string, unknown>;
  const body = m[2]!.trim();
  const slug = path.basename(file, '.md');
  if (meta.slug !== slug) throw new Error(`slug "${String(meta.slug)}" must equal filename`);
  const allowed: readonly string[] = section === 'blog' ? BLOG_CATEGORIES : RESOURCE_CATEGORIES;
  if (!allowed.includes(String(meta.category)))
    throw new Error(`category "${String(meta.category)}" not valid for ${section}`);
  if (meta.schemaType && !(POST_SCHEMA_TYPES as readonly string[]).includes(String(meta.schemaType)))
    throw new Error(`bad schemaType ${String(meta.schemaType)}`);
  const parsed = postSchema.parse({
    slug,
    title: meta.title,
    excerpt: meta.excerpt,
    body,
    tags: meta.tags,
    seoTitle: meta.seoTitle,
    seoDescription: meta.seoDescription,
    focusKeyword: meta.focusKeyword,
    secondaryKeywords: meta.secondaryKeywords,
    category: meta.category,
    schemaType: meta.schemaType ?? 'BlogPosting',
    faq: meta.faq ?? [],
    howToSteps: meta.howToSteps ?? [],
    publishedAt: meta.publishedAt,
    status: 'PUBLISHED',
  });
  return { file, section, data: { ...parsed, cover: meta.cover as string | undefined } };
}

async function main() {
  const articles: Article[] = [];
  const errors: string[] = [];
  for (const section of ['blog', 'resources'] as const) {
    const dir = path.join(root, 'content', section);
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.md'))) {
      try {
        articles.push(parse(path.join(dir, name), section));
      } catch (e) {
        errors.push(`${section}/${name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  // Internal links must point at articles that exist.
  const slugs = new Set(articles.map((a) => a.data.slug));
  for (const a of articles) {
    for (const [, target] of a.data.body.matchAll(/\]\(\/(?:blog|resources)\/([a-z0-9-]+)\)/g)) {
      if (!slugs.has(target!)) errors.push(`${a.data.slug}: broken internal link /…/${target}`);
    }
  }

  const blog = articles.filter((a) => a.section === 'blog').length;
  console.log(`Parsed ${blog} blog posts and ${articles.length - blog} resources.`);
  if (errors.length) {
    console.error(`\n${errors.length} problem(s):\n- ${errors.join('\n- ')}`);
    process.exit(1);
  }
  if (checkOnly) return;

  const prisma = new PrismaClient();
  try {
    let withCover = 0;
    for (const { data } of articles) {
      const cover =
        data.cover && existsSync(path.join(publicDir, data.cover.replace(/^\//, '')))
          ? data.cover
          : null;
      if (cover) withCover++;
      const fields = {
        title: data.title,
        excerpt: data.excerpt,
        body: data.body,
        tags: data.tags,
        status: 'PUBLISHED' as const,
        publishedAt: data.publishedAt ?? new Date(),
        coverImageUrl: cover,
        seoTitle: data.seoTitle ?? null,
        seoDescription: data.seoDescription ?? null,
        focusKeyword: data.focusKeyword ?? null,
        secondaryKeywords: data.secondaryKeywords,
        category: data.category ?? null,
        schemaType: data.schemaType,
        faq: data.faq,
        howToSteps: data.howToSteps,
        authorName: 'Purple Voice team',
      };
      await prisma.post.upsert({
        where: { slug: data.slug },
        create: { slug: data.slug, ...fields },
        update: fields,
      });
    }
    console.log(`Imported ${articles.length} articles (${withCover} with cover images).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
