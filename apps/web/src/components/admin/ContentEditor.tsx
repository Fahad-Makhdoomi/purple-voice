'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ImagePlus, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { Field } from '@/components/forms/Field';
import { Tabs, toast, useAction } from '@/components/ui';
import { MediaPickerModal } from './MediaLibrary';

/** Markdown body with a live preview and an "insert image" button wired to the media library. */
export function MarkdownEditor({
  value,
  onChange,
  folder,
}: {
  value: string;
  onChange: (v: string) => void;
  folder: string;
}) {
  const [mode, setMode] = useState<'write' | 'preview'>('write');
  const [picker, setPicker] = useState(false);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Tabs
          value={mode}
          onChange={setMode}
          options={[
            { value: 'write', label: 'Write' },
            { value: 'preview', label: 'Preview' },
          ]}
        />
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicker(true)}>
          <ImagePlus size={14} aria-hidden="true" /> Insert image
        </button>
      </div>
      {mode === 'write' ? (
        <textarea
          aria-label="Body (Markdown)"
          className="textarea min-h-[420px] font-mono text-[13px]"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            '## A heading\n\nWrite in Markdown. **Bold**, _italic_, [links](https://…), lists and tables are supported.'
          }
        />
      ) : (
        <div className="prose-pv min-h-[420px] rounded-sm border border-line bg-surface p-6">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {value || '_Nothing to preview yet._'}
          </ReactMarkdown>
        </div>
      )}
      <MediaPickerModal
        open={picker}
        folder={folder}
        onClose={() => setPicker(false)}
        onPick={(a) =>
          onChange(
            `${value}${value.endsWith('\n') || !value ? '' : '\n\n'}![${a.alt || ''}](${a.url})\n`,
          )
        }
      />
    </div>
  );
}

export interface SeoFields {
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  noindex: boolean;
}

/** SEO metadata fields with length guidance, a search-result preview and an AI draft button. */
export function SeoPanel({
  value,
  onChange,
  title,
  body,
  path,
  folder,
}: {
  value: SeoFields;
  onChange: (v: SeoFields) => void;
  title: string;
  body: string;
  path: string;
  folder: string;
}) {
  const [picker, setPicker] = useState(false);
  const { busy, run } = useAction();
  const shownTitle = value.seoTitle || title || 'Page title';
  const shownDesc =
    value.seoDescription || 'Add a meta description so search engines show the right summary.';

  return (
    <div className="space-y-4">
      <div className="rounded-sm border border-line bg-surface p-4">
        <p className="text-xs text-muted">Search preview</p>
        <p className="mt-1 truncate text-[17px] text-[#1a0dab]">{shownTitle}</p>
        <p className="truncate text-xs text-success">
          {typeof window !== 'undefined' ? window.location.origin : ''}
          {path}
        </p>
        <p className="mt-1 line-clamp-2 text-[13px] text-ink-soft">{shownDesc}</p>
      </div>
      <button
        type="button"
        className="btn btn-soft btn-sm"
        disabled={busy || !title}
        onClick={() =>
          run(async () => {
            const r = await api<{ seoTitle: string; seoDescription: string }>(
              '/admin/cms/ai/seo-suggest',
              { body: { title, body } },
            );
            onChange({ ...value, seoTitle: r.seoTitle, seoDescription: r.seoDescription });
            toast('Drafted with Claude — review before publishing');
          })
        }
      >
        <Sparkles size={14} aria-hidden="true" /> {busy ? 'Drafting…' : 'Draft with AI'}
      </button>
      <Field
        id="seoTitle"
        label={`SEO title (${(value.seoTitle ?? '').length}/60)`}
        help="Defaults to the page title."
      >
        <input
          id="seoTitle"
          className="input"
          maxLength={70}
          value={value.seoTitle ?? ''}
          onChange={(e) => onChange({ ...value, seoTitle: e.target.value || null })}
        />
      </Field>
      <Field
        id="seoDescription"
        label={`Meta description (${(value.seoDescription ?? '').length}/160)`}
      >
        <textarea
          id="seoDescription"
          className="textarea min-h-[80px]"
          maxLength={170}
          value={value.seoDescription ?? ''}
          onChange={(e) => onChange({ ...value, seoDescription: e.target.value || null })}
        />
      </Field>
      <Field id="ogImage" label="Social share image" help="1200×630 works best.">
        <div className="flex gap-2">
          <input
            id="ogImage"
            className="input font-mono text-xs"
            value={value.ogImageUrl ?? ''}
            onChange={(e) => onChange({ ...value, ogImageUrl: e.target.value || null })}
          />
          <button type="button" className="btn btn-secondary" onClick={() => setPicker(true)}>
            Choose
          </button>
        </div>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="checkbox"
          checked={value.noindex}
          onChange={(e) => onChange({ ...value, noindex: e.target.checked })}
        />
        Hide from search engines (noindex)
      </label>
      <MediaPickerModal
        open={picker}
        folder={folder}
        onClose={() => setPicker(false)}
        onPick={(a) => onChange({ ...value, ogImageUrl: a.url })}
      />
    </div>
  );
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
