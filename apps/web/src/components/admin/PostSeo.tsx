'use client';

import { useMemo } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, CircleAlert, CircleX, Plus, Trash2 } from 'lucide-react';
import {
  POST_SCHEMA_TYPES,
  RESOURCE_CATEGORIES,
  analyzeSeo,
  type SeoCheck,
  type SeoReport,
} from '@pv/shared';
import { Field } from '@/components/forms/Field';
import { cn } from '@/lib/cn';

export interface AdvancedSeoFields {
  focusKeyword: string | null;
  secondaryKeywords: string[];
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  nofollow: boolean;
  schemaType: (typeof POST_SCHEMA_TYPES)[number];
  faq: Array<{ question: string; answer: string }>;
  howToSteps: Array<{ name: string; text: string }>;
  category: string | null;
  authorName: string | null;
  authorBio: string | null;
  showToc: boolean;
}

export const EMPTY_ADVANCED_SEO: AdvancedSeoFields = {
  focusKeyword: null,
  secondaryKeywords: [],
  canonicalUrl: null,
  ogTitle: null,
  ogDescription: null,
  nofollow: false,
  schemaType: 'BlogPosting',
  faq: [],
  howToSteps: [],
  category: null,
  authorName: null,
  authorBio: null,
  showToc: true,
};

const BLOG_CATEGORIES = ['Guides', 'Industries', 'Compliance', 'Product', 'Comparisons', 'Sales'];

interface PostLike extends AdvancedSeoFields {
  title: string;
  slug: string;
  body: string;
  excerpt: string;
  seoTitle: string | null;
  seoDescription: string | null;
  coverImageUrl: string | null;
  ogImageUrl: string | null;
}

export function useSeoReport(post: PostLike): SeoReport {
  return useMemo(
    () =>
      analyzeSeo({
        title: post.title,
        slug: post.slug,
        body: post.body,
        excerpt: post.excerpt,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        focusKeyword: post.focusKeyword,
        secondaryKeywords: post.secondaryKeywords,
        coverImageUrl: post.coverImageUrl,
        ogImageUrl: post.ogImageUrl,
        faqCount: post.faq.length,
      }),
    [
      post.title,
      post.slug,
      post.body,
      post.excerpt,
      post.seoTitle,
      post.seoDescription,
      post.focusKeyword,
      post.secondaryKeywords,
      post.coverImageUrl,
      post.ogImageUrl,
      post.faq.length,
    ],
  );
}

const GROUPS: Array<[SeoCheck['group'], string]> = [
  ['keyword', 'Focus keyword'],
  ['meta', 'Title, description and URL'],
  ['content', 'Content and readability'],
  ['links', 'Links'],
  ['media', 'Images and sharing'],
  ['schema', 'Rich results'],
];

function StatusIcon({ status }: { status: SeoCheck['status'] }) {
  if (status === 'good')
    return <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" aria-label="Good" />;
  if (status === 'ok')
    return (
      <CircleAlert
        size={15}
        className="mt-0.5 shrink-0 text-warning"
        aria-label="Could be better"
      />
    );
  return <CircleX size={15} className="mt-0.5 shrink-0 text-danger" aria-label="Needs work" />;
}

/** The live SEO score: a ring, the checks grouped, and readability numbers. */
export function SeoScore({ report }: { report: SeoReport }) {
  const tone =
    report.score >= 80 ? 'text-success' : report.score >= 55 ? 'text-warning' : 'text-danger';
  const r = report.readability;
  const circumference = 2 * Math.PI * 26;
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r="26" className="fill-none stroke-line" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r="26"
            className={cn('fill-none stroke-current transition-all duration-500', tone)}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - report.score / 100)}
          />
        </svg>
        <div>
          <p className={cn('num text-3xl font-semibold', tone)}>{report.score}</p>
          <p className="text-xs text-muted">
            SEO score ·{' '}
            {report.score >= 80
              ? 'Good to publish'
              : report.score >= 55
                ? 'Getting there'
                : 'Needs work'}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ['Words', r.words],
          ['Read', `${r.readingTimeMin} min`],
          ['Reading ease', r.fleschScore],
        ].map(([k, v]) => (
          <div key={k} className="rounded-sm bg-canvas px-2 py-2">
            <dt className="text-[11px] text-muted">{k}</dt>
            <dd className="num text-sm font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {GROUPS.map(([group, label]) => {
        const checks = report.checks.filter((c) => c.group === group);
        if (!checks.length) return null;
        return (
          <div key={group}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted">
              {label}
            </p>
            <ul className="space-y-1.5">
              {checks.map((c) => (
                <li key={c.id} className="flex gap-2 text-[13px] leading-snug text-ink-soft">
                  <StatusIcon status={c.status} />
                  <span>{c.message}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/** Focus keyword, social card, canonical, robots, schema, category and byline. */
export function AdvancedSeo({
  value,
  onChange,
  title,
  description,
  image,
  path,
}: {
  value: AdvancedSeoFields;
  onChange: (patch: Partial<AdvancedSeoFields>) => void;
  title: string;
  description: string;
  image: string | null;
  path: string;
}) {
  const socialTitle = value.ogTitle || title || 'Post title';
  const socialDesc = value.ogDescription || description || 'A short description of the post.';
  const host = typeof window !== 'undefined' ? window.location.host : '';
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Field
        id="focusKeyword"
        label="Focus keyword"
        help="The search phrase this post should rank for, e.g. “AI cold calling”."
      >
        <input
          id="focusKeyword"
          className="input"
          maxLength={100}
          value={value.focusKeyword ?? ''}
          onChange={(e) => onChange({ focusKeyword: e.target.value || null })}
        />
      </Field>
      <Field
        id="secondaryKeywords"
        label="Related keywords"
        help="Comma separated, up to 10."
        optional
      >
        <input
          id="secondaryKeywords"
          className="input"
          value={value.secondaryKeywords.join(', ')}
          onChange={(e) =>
            onChange({
              secondaryKeywords: e.target.value
                .split(',')
                .map((k) => k.trim())
                .filter(Boolean)
                .slice(0, 10),
            })
          }
        />
      </Field>
      <Field
        id="category"
        label="Category"
        help="Templates, Checklists, Scripts… list it under Resources."
        optional
      >
        <input
          id="category"
          className="input"
          list="post-categories"
          maxLength={60}
          value={value.category ?? ''}
          onChange={(e) => onChange({ category: e.target.value || null })}
        />
        <datalist id="post-categories">
          {[...BLOG_CATEGORIES, ...RESOURCE_CATEGORIES].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <Field
        id="schemaType"
        label="Structured data type"
        help="How search engines classify the post."
      >
        <select
          id="schemaType"
          className="select"
          value={value.schemaType}
          onChange={(e) =>
            onChange({ schemaType: e.target.value as AdvancedSeoFields['schemaType'] })
          }
        >
          {POST_SCHEMA_TYPES.map((t) => (
            <option key={t} value={t}>
              {t === 'HowTo' ? 'How-to (with steps)' : t.replace(/([a-z])([A-Z])/g, '$1 $2')}
            </option>
          ))}
        </select>
      </Field>

      <div className="rounded-lg border border-line sm:col-span-2">
        <p className="border-b border-line px-4 py-2 text-xs text-muted">Social preview</p>
        <div className="grid gap-0 sm:grid-cols-[200px_1fr]">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt=""
              className="aspect-[1.91/1] h-full w-full object-cover sm:rounded-bl-lg"
            />
          ) : (
            <div className="aspect-[1.91/1] bg-gradient-pastel sm:rounded-bl-lg" />
          )}
          <div className="min-w-0 p-4">
            <p className="text-xs uppercase text-muted">{host}</p>
            <p className="mt-1 line-clamp-2 font-semibold">{socialTitle}</p>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{socialDesc}</p>
          </div>
        </div>
      </div>
      <Field id="ogTitle" label={`Social title (${(value.ogTitle ?? '').length}/95)`} optional>
        <input
          id="ogTitle"
          className="input"
          maxLength={95}
          value={value.ogTitle ?? ''}
          onChange={(e) => onChange({ ogTitle: e.target.value || null })}
          placeholder="Defaults to the SEO title"
        />
      </Field>
      <Field
        id="ogDescription"
        label={`Social description (${(value.ogDescription ?? '').length}/200)`}
        optional
      >
        <input
          id="ogDescription"
          className="input"
          maxLength={200}
          value={value.ogDescription ?? ''}
          onChange={(e) => onChange({ ogDescription: e.target.value || null })}
          placeholder="Defaults to the meta description"
        />
      </Field>

      <Field
        id="canonicalUrl"
        label="Canonical URL"
        optional
        help={`Only if this post first appeared elsewhere. Defaults to ${path}.`}
        className="sm:col-span-2"
      >
        <input
          id="canonicalUrl"
          type="url"
          className="input font-mono text-xs"
          value={value.canonicalUrl ?? ''}
          onChange={(e) => onChange({ canonicalUrl: e.target.value || null })}
          placeholder="https://"
        />
      </Field>
      <Field
        id="authorName"
        label="Byline"
        optional
        help="Defaults to the staff account that wrote it."
      >
        <input
          id="authorName"
          className="input"
          maxLength={120}
          value={value.authorName ?? ''}
          onChange={(e) => onChange({ authorName: e.target.value || null })}
        />
      </Field>
      <Field
        id="authorBio"
        label="Author bio"
        optional
        help="One or two sentences on their expertise."
      >
        <input
          id="authorBio"
          className="input"
          maxLength={600}
          value={value.authorBio ?? ''}
          onChange={(e) => onChange({ authorBio: e.target.value || null })}
        />
      </Field>
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm sm:col-span-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="checkbox"
            checked={value.showToc}
            onChange={(e) => onChange({ showToc: e.target.checked })}
          />
          Show a table of contents
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="checkbox"
            checked={value.nofollow}
            onChange={(e) => onChange({ nofollow: e.target.checked })}
          />
          Ask search engines not to follow links (nofollow)
        </label>
      </div>
    </div>
  );
}

function move<T>(list: T[], i: number, by: number): T[] {
  const next = list.slice();
  const j = i + by;
  if (j < 0 || j >= next.length) return list;
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** Questions and answers: shown under the post and marked up as FAQPage. */
export function FaqEditor({
  items,
  onChange,
}: {
  items: AdvancedSeoFields['faq'];
  onChange: (items: AdvancedSeoFields['faq']) => void;
}) {
  return (
    <div className="space-y-3">
      {items.map((f, i) => (
        <div key={i} className="rounded-lg border border-line p-3">
          <div className="flex gap-2">
            <input
              className="input"
              aria-label={`Question ${i + 1}`}
              placeholder="Question"
              maxLength={300}
              value={f.question}
              onChange={(e) =>
                onChange(items.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))
              }
            />
            <button
              type="button"
              className="btn btn-ghost btn-icon h-10 w-10"
              aria-label="Move up"
              onClick={() => onChange(move(items, i, -1))}
            >
              <ArrowUp size={14} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon h-10 w-10"
              aria-label="Move down"
              onClick={() => onChange(move(items, i, 1))}
            >
              <ArrowDown size={14} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon h-10 w-10 text-danger"
              aria-label={`Remove question ${i + 1}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              <Trash2 size={14} />
            </button>
          </div>
          <textarea
            className="textarea mt-2 min-h-[70px]"
            aria-label={`Answer ${i + 1}`}
            placeholder="A direct answer in a few sentences"
            maxLength={3000}
            value={f.answer}
            onChange={(e) =>
              onChange(items.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))
            }
          />
        </div>
      ))}
      <button
        type="button"
        className="btn btn-soft btn-sm"
        disabled={items.length >= 30}
        onClick={() => onChange([...items, { question: '', answer: '' }])}
      >
        <Plus size={14} aria-hidden="true" /> Add a question
      </button>
    </div>
  );
}

/** Steps for HowTo structured data. */
export function HowToEditor({
  items,
  onChange,
}: {
  items: AdvancedSeoFields['howToSteps'];
  onChange: (items: AdvancedSeoFields['howToSteps']) => void;
}) {
  return (
    <ol className="space-y-3">
      {items.map((s, i) => (
        <li key={i} className="flex gap-3 rounded-lg border border-line p-3">
          <span className="num mt-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-800">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <input
              className="input"
              aria-label={`Step ${i + 1} name`}
              placeholder="Step name"
              maxLength={200}
              value={s.name}
              onChange={(e) =>
                onChange(items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))
              }
            />
            <textarea
              className="textarea min-h-[60px]"
              aria-label={`Step ${i + 1} instructions`}
              placeholder="What to do"
              maxLength={2000}
              value={s.text}
              onChange={(e) =>
                onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
              }
            />
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon h-9 w-9 text-danger"
            aria-label={`Remove step ${i + 1}`}
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 size={14} />
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          className="btn btn-soft btn-sm"
          disabled={items.length >= 40}
          onClick={() => onChange([...items, { name: '', text: '' }])}
        >
          <Plus size={14} aria-hidden="true" /> Add a step
        </button>
      </li>
    </ol>
  );
}
