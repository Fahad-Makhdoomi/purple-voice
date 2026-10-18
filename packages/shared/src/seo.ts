/**
 * On-page SEO and readability analysis for blog posts, in the spirit of
 * Yoast / Rank Math: a focus keyword checked against the title, slug, meta
 * description, introduction, headings, body and images, plus length, links
 * and a Flesch reading-ease score. Pure, so the editor runs it live on every
 * keystroke and the same rules can be tested.
 */

export type SeoCheckStatus = 'good' | 'ok' | 'bad';

export interface SeoCheck {
  id: string;
  group: 'keyword' | 'meta' | 'content' | 'links' | 'media' | 'schema';
  status: SeoCheckStatus;
  message: string;
}

export interface SeoInput {
  title: string;
  slug: string;
  body: string;
  excerpt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  focusKeyword?: string | null;
  secondaryKeywords?: string[];
  coverImageUrl?: string | null;
  ogImageUrl?: string | null;
  faqCount?: number;
}

export interface Readability {
  words: number;
  sentences: number;
  paragraphs: number;
  /** Flesch reading ease, 0 (hard) – 100 (easy). */
  fleschScore: number;
  fleschLabel: string;
  avgWordsPerSentence: number;
  /** Share of sentences over 20 words, in percent. */
  longSentencePct: number;
  /** Share of sentences that look passive, in percent. */
  passivePct: number;
  readingTimeMin: number;
  headings: number;
}

export interface SeoReport {
  /** 0–100. */
  score: number;
  checks: SeoCheck[];
  readability: Readability;
  /** Focus keyword uses per 100 words. */
  keywordDensity: number;
  keywordCount: number;
}

/** Markdown → plain text: drops code, images, link targets, emphasis and heading marks. */
export function markdownToText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~|]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function countWords(text: string): number {
  return (text.match(/[\p{L}\p{N}'’-]+/gu) ?? []).length;
}

/** Minutes to read at 225 words a minute, at least 1. */
export function readingTime(markdown: string): number {
  return Math.max(1, Math.round(countWords(markdownToText(markdown)) / 225));
}

function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

const PASSIVE = /\b(am|is|are|was|were|be|been|being)\s+(\w+ly\s+)?\w+(ed|en)\b/i;

export function analyzeReadability(markdown: string): Readability {
  const textOnly = markdownToText(markdown);
  const sentences = textOnly
    .split(/(?<=[.!?])\s+|\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => countWords(s) > 0);
  const wordsList = textOnly.match(/[\p{L}\p{N}'’-]+/gu) ?? [];
  const words = wordsList.length;
  const syl = wordsList.reduce((n, w) => n + syllables(w), 0);
  const sentenceCount = Math.max(1, sentences.length);
  const wps = words / sentenceCount;
  const flesch = words ? 206.835 - 1.015 * wps - 84.6 * (syl / Math.max(1, words)) : 0;
  const score = Math.round(Math.max(0, Math.min(100, flesch)));
  const label =
    score >= 70
      ? 'Easy'
      : score >= 60
        ? 'Plain English'
        : score >= 50
          ? 'Fairly difficult'
          : score >= 30
            ? 'Difficult'
            : 'Very difficult';
  const long = sentences.filter((s) => countWords(s) > 20).length;
  const passive = sentences.filter((s) => PASSIVE.test(s)).length;
  return {
    words,
    sentences: sentences.length,
    paragraphs: markdown.split(/\n{2,}/).filter((p) => p.trim() && !/^#{1,6}\s/.test(p.trim()))
      .length,
    fleschScore: score,
    fleschLabel: label,
    avgWordsPerSentence: Math.round(wps * 10) / 10,
    longSentencePct: sentences.length ? Math.round((long / sentences.length) * 100) : 0,
    passivePct: sentences.length ? Math.round((passive / sentences.length) * 100) : 0,
    readingTimeMin: Math.max(1, Math.round(words / 225)),
    headings: (markdown.match(/^#{2,6}\s+/gm) ?? []).length,
  };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function keywordRegex(keyword: string): RegExp {
  // Whole words, any case, flexible spacing and hyphens between the words.
  const parts = keyword
    .trim()
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean)
    .map(escapeRe);
  return new RegExp(`(?<![\\p{L}\\p{N}])${parts.join('[\\s-]+')}(?![\\p{L}\\p{N}])`, 'giu');
}

const has = (text: string | null | undefined, kw: string) =>
  !!text && keywordRegex(kw).test(text.toLowerCase());

export function analyzeSeo(input: SeoInput): SeoReport {
  const checks: SeoCheck[] = [];
  const add = (c: SeoCheck) => checks.push(c);
  const body = input.body ?? '';
  const text = markdownToText(body);
  const readability = analyzeReadability(body);
  const kw = (input.focusKeyword ?? '').trim();
  const metaTitle = (input.seoTitle || input.title || '').trim();
  const metaDesc = (input.seoDescription || input.excerpt || '').trim();
  const firstParagraph =
    body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .find((p) => p && !/^#{1,6}\s/.test(p) && !/^!\[/.test(p)) ?? '';
  const headings = body.match(/^#{2,3}\s+.+$/gm) ?? [];
  const images = [...body.matchAll(/!\[([^\]]*)]\(([^)]+)\)/g)];
  const links = [...body.matchAll(/(?<!!)\[[^\]]*]\(([^)\s]+)[^)]*\)/g)].map((m) => m[1] ?? '');
  const internal = links.filter((l) => l.startsWith('/') || l.startsWith('#'));
  const external = links.filter((l) => /^https?:\/\//.test(l));

  let keywordCount = 0;
  let density = 0;
  if (!kw) {
    add({
      id: 'kw-set',
      group: 'keyword',
      status: 'bad',
      message: 'Set a focus keyword: the search phrase this post should rank for.',
    });
  } else {
    keywordCount = (text.toLowerCase().match(keywordRegex(kw)) ?? []).length;
    density = readability.words ? Math.round((keywordCount / readability.words) * 1000) / 10 : 0;
    add(
      has(metaTitle, kw)
        ? metaTitle.toLowerCase().startsWith(kw.toLowerCase())
          ? {
              id: 'kw-title',
              group: 'keyword',
              status: 'good',
              message: 'The SEO title starts with the focus keyword.',
            }
          : {
              id: 'kw-title',
              group: 'keyword',
              status: 'ok',
              message: 'The focus keyword is in the SEO title; near the start is even better.',
            }
        : {
            id: 'kw-title',
            group: 'keyword',
            status: 'bad',
            message: 'Use the focus keyword in the SEO title.',
          },
    );
    add(
      has(metaDesc, kw)
        ? {
            id: 'kw-desc',
            group: 'keyword',
            status: 'good',
            message: 'The meta description contains the focus keyword.',
          }
        : {
            id: 'kw-desc',
            group: 'keyword',
            status: 'bad',
            message: 'Use the focus keyword in the meta description.',
          },
    );
    const slugWords = kw
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2);
    const slugHits = slugWords.filter((w) =>
      input.slug.includes(w.replace(/[^a-z0-9]/g, '')),
    ).length;
    add(
      slugWords.length && slugHits === slugWords.length
        ? {
            id: 'kw-slug',
            group: 'keyword',
            status: 'good',
            message: 'The URL contains the focus keyword.',
          }
        : slugHits
          ? {
              id: 'kw-slug',
              group: 'keyword',
              status: 'ok',
              message: 'The URL has part of the focus keyword.',
            }
          : {
              id: 'kw-slug',
              group: 'keyword',
              status: 'bad',
              message: 'Put the focus keyword in the URL slug.',
            },
    );
    add(
      has(firstParagraph, kw)
        ? {
            id: 'kw-intro',
            group: 'keyword',
            status: 'good',
            message: 'The focus keyword appears in the first paragraph.',
          }
        : {
            id: 'kw-intro',
            group: 'keyword',
            status: 'bad',
            message: 'Mention the focus keyword in the first paragraph.',
          },
    );
    add(
      headings.some((h) => has(h, kw))
        ? {
            id: 'kw-heading',
            group: 'keyword',
            status: 'good',
            message: 'A subheading uses the focus keyword.',
          }
        : {
            id: 'kw-heading',
            group: 'keyword',
            status: 'ok',
            message: 'Use the focus keyword (or a close variant) in a subheading.',
          },
    );
    add(
      density >= 0.5 && density <= 2.5
        ? {
            id: 'kw-density',
            group: 'keyword',
            status: 'good',
            message: `Keyword density is ${density}% (${keywordCount}×), a natural amount.`,
          }
        : density > 2.5
          ? {
              id: 'kw-density',
              group: 'keyword',
              status: 'bad',
              message: `Keyword density is ${density}% (${keywordCount}×): that reads as stuffing. Aim for 0.5–2.5%.`,
            }
          : {
              id: 'kw-density',
              group: 'keyword',
              status: keywordCount ? 'ok' : 'bad',
              message: `The focus keyword appears ${keywordCount}× (${density}%). Aim for 0.5–2.5%.`,
            },
    );
    if (images.length) {
      add(
        images.some((m) => has(m[1], kw))
          ? {
              id: 'kw-alt',
              group: 'keyword',
              status: 'good',
              message: 'An image alt text includes the focus keyword.',
            }
          : {
              id: 'kw-alt',
              group: 'keyword',
              status: 'ok',
              message: 'Describe an image with the focus keyword in its alt text.',
            },
      );
    }
    for (const sk of (input.secondaryKeywords ?? []).filter(Boolean).slice(0, 5)) {
      add(
        has(text, sk)
          ? {
              id: `kw2-${sk}`,
              group: 'keyword',
              status: 'good',
              message: `Related keyword “${sk}” is used.`,
            }
          : {
              id: `kw2-${sk}`,
              group: 'keyword',
              status: 'ok',
              message: `Related keyword “${sk}” is not used yet.`,
            },
      );
    }
  }

  const tl = metaTitle.length;
  add(
    tl >= 30 && tl <= 60
      ? {
          id: 'title-len',
          group: 'meta',
          status: 'good',
          message: `SEO title length is ${tl} characters.`,
        }
      : {
          id: 'title-len',
          group: 'meta',
          status: tl ? 'ok' : 'bad',
          message: `SEO title is ${tl} characters; 30–60 shows in full on Google.`,
        },
  );
  const dl = metaDesc.length;
  add(
    dl >= 120 && dl <= 160
      ? {
          id: 'desc-len',
          group: 'meta',
          status: 'good',
          message: `Meta description length is ${dl} characters.`,
        }
      : {
          id: 'desc-len',
          group: 'meta',
          status: dl ? 'ok' : 'bad',
          message: dl
            ? `Meta description is ${dl} characters; 120–160 is ideal.`
            : 'Write a meta description (120–160 characters).',
        },
  );
  add(
    input.slug.length <= 75 && input.slug.split('-').length <= 8
      ? { id: 'slug-len', group: 'meta', status: 'good', message: 'The URL is short and readable.' }
      : {
          id: 'slug-len',
          group: 'meta',
          status: 'ok',
          message: 'Shorten the URL slug to a few key words.',
        },
  );

  const w = readability.words;
  add(
    w >= 900
      ? {
          id: 'length',
          group: 'content',
          status: 'good',
          message: `${w} words: enough depth to rank.`,
        }
      : w >= 300
        ? {
            id: 'length',
            group: 'content',
            status: 'ok',
            message: `${w} words. Posts over 900 words tend to rank better.`,
          }
        : {
            id: 'length',
            group: 'content',
            status: 'bad',
            message: `${w} words. Write at least 300.`,
          },
  );
  add(
    readability.headings >= Math.max(1, Math.floor(w / 350))
      ? {
          id: 'headings',
          group: 'content',
          status: 'good',
          message: 'Subheadings break the text up well.',
        }
      : {
          id: 'headings',
          group: 'content',
          status: 'ok',
          message: 'Add subheadings (## Heading) about every 300 words.',
        },
  );
  add(
    readability.fleschScore >= 60
      ? {
          id: 'flesch',
          group: 'content',
          status: 'good',
          message: `Reading ease ${readability.fleschScore} (${readability.fleschLabel}).`,
        }
      : readability.fleschScore >= 40
        ? {
            id: 'flesch',
            group: 'content',
            status: 'ok',
            message: `Reading ease ${readability.fleschScore} (${readability.fleschLabel}). Shorter sentences and words help.`,
          }
        : {
            id: 'flesch',
            group: 'content',
            status: w ? 'bad' : 'ok',
            message: `Reading ease ${readability.fleschScore} (${readability.fleschLabel}). Simplify the language.`,
          },
  );
  add(
    readability.longSentencePct <= 25
      ? {
          id: 'sentences',
          group: 'content',
          status: 'good',
          message: 'Most sentences are a comfortable length.',
        }
      : {
          id: 'sentences',
          group: 'content',
          status: 'ok',
          message: `${readability.longSentencePct}% of sentences are over 20 words; keep it under 25%.`,
        },
  );
  add(
    readability.passivePct <= 10
      ? { id: 'passive', group: 'content', status: 'good', message: 'Little passive voice.' }
      : {
          id: 'passive',
          group: 'content',
          status: 'ok',
          message: `${readability.passivePct}% of sentences look passive; aim for 10% or less.`,
        },
  );

  add(
    internal.length
      ? {
          id: 'internal',
          group: 'links',
          status: 'good',
          message: `${internal.length} internal link(s) to your own pages.`,
        }
      : {
          id: 'internal',
          group: 'links',
          status: 'bad',
          message: 'Link to at least one of your own pages or posts.',
        },
  );
  add(
    external.length
      ? {
          id: 'external',
          group: 'links',
          status: 'good',
          message: `${external.length} outbound link(s) to sources.`,
        }
      : {
          id: 'external',
          group: 'links',
          status: 'ok',
          message: 'Link to a reputable source to back up a claim.',
        },
  );

  const missingAlt = images.filter((m) => !(m[1] ?? '').trim()).length;
  add(
    input.coverImageUrl || images.length
      ? { id: 'image', group: 'media', status: 'good', message: 'The post has images.' }
      : {
          id: 'image',
          group: 'media',
          status: 'ok',
          message: 'Add a cover image or an image in the text.',
        },
  );
  if (images.length) {
    add(
      missingAlt
        ? {
            id: 'alt',
            group: 'media',
            status: 'bad',
            message: `${missingAlt} image(s) have no alt text.`,
          }
        : { id: 'alt', group: 'media', status: 'good', message: 'Every image has alt text.' },
    );
  }
  add(
    input.ogImageUrl || input.coverImageUrl
      ? { id: 'og', group: 'media', status: 'good', message: 'A social share image is set.' }
      : { id: 'og', group: 'media', status: 'ok', message: 'Set a social share image (1200×630).' },
  );
  add(
    (input.faqCount ?? 0) > 0
      ? {
          id: 'faq',
          group: 'schema',
          status: 'good',
          message: 'FAQ structured data can earn rich results.',
        }
      : {
          id: 'faq',
          group: 'schema',
          status: 'ok',
          message: 'Add a few FAQs to be eligible for FAQ rich results.',
        },
  );

  const weight = { good: 1, ok: 0.5, bad: 0 } as const;
  const score = checks.length
    ? Math.round((checks.reduce((n, c) => n + weight[c.status], 0) / checks.length) * 100)
    : 0;
  return { score, checks, readability, keywordDensity: density, keywordCount };
}

/** Slug of a markdown heading, for the table of contents and in-page links. */
export function headingId(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** H2/H3 headings of a markdown body, for a table of contents. */
export function tableOfContents(
  markdown: string,
): Array<{ level: 2 | 3; text: string; id: string }> {
  const out: Array<{ level: 2 | 3; text: string; id: string }> = [];
  let inCode = false;
  for (const line of markdown.split('\n')) {
    if (line.trim().startsWith('```')) inCode = !inCode;
    if (inCode) continue;
    const m = line.match(/^(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const text = markdownToText(m[2]!);
    out.push({ level: m[1]!.length as 2 | 3, text, id: headingId(text) });
  }
  return out;
}
