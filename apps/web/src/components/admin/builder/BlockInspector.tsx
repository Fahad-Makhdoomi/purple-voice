'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from 'lucide-react';
import {
  BLOCK_ANIMATIONS,
  BLOCK_BACKGROUNDS,
  BLOCK_ICONS,
  BLOCK_PADDINGS,
  PAGE_BLOCK_INFO,
  type PageBlock,
} from '@pv/shared';
import { MediaPickerModal } from '@/components/admin/MediaLibrary';
import { cn } from '@/lib/cn';

type Spec =
  | {
      key: string;
      label: string;
      kind: 'text' | 'textarea' | 'markdown' | 'image' | 'url';
      help?: string;
      max?: number;
    }
  | { key: string; label: string; kind: 'select'; options: Array<string | [string, string]> }
  | { key: string; label: string; kind: 'checkbox' }
  | { key: string; label: string; kind: 'button' }
  | {
      key: string;
      label: string;
      kind: 'items';
      item: Spec[];
      max: number;
      blank: Record<string, unknown>;
    };

const COLUMNS: Array<[string, string]> = [
  ['2', 'Two columns'],
  ['3', 'Three columns'],
  ['4', 'Four columns'],
];

/** What each block type can edit, in display order. */
const SPECS: Record<PageBlock['type'], Spec[]> = {
  hero: [
    { key: 'eyebrow', label: 'Small label above', kind: 'text', max: 80 },
    { key: 'title', label: 'Headline', kind: 'textarea', max: 200 },
    { key: 'subtitle', label: 'Intro', kind: 'textarea', max: 600 },
    { key: 'primary', label: 'Main button', kind: 'button' },
    { key: 'secondary', label: 'Second button', kind: 'button' },
    { key: 'imageUrl', label: 'Image', kind: 'image' },
    { key: 'imageAlt', label: 'Image description (alt text)', kind: 'text', max: 200 },
    {
      key: 'layout',
      label: 'Layout',
      kind: 'select',
      options: [
        ['centered', 'Centred, image below'],
        ['split', 'Text left, image right'],
      ],
    },
  ],
  richText: [{ key: 'markdown', label: 'Text (Markdown)', kind: 'markdown', max: 100000 }],
  features: [
    { key: 'title', label: 'Heading', kind: 'text', max: 200 },
    { key: 'subtitle', label: 'Intro', kind: 'textarea', max: 600 },
    { key: 'columns', label: 'Columns', kind: 'select', options: COLUMNS },
    {
      key: 'items',
      label: 'Features',
      kind: 'items',
      max: 24,
      blank: { icon: 'sparkles', title: 'New feature', text: '' },
      item: [
        { key: 'icon', label: 'Icon', kind: 'select', options: [...BLOCK_ICONS] },
        { key: 'title', label: 'Title', kind: 'text', max: 120 },
        { key: 'text', label: 'Text', kind: 'textarea', max: 600 },
      ],
    },
  ],
  imageText: [
    { key: 'title', label: 'Heading', kind: 'text', max: 200 },
    { key: 'markdown', label: 'Text (Markdown)', kind: 'markdown', max: 10000 },
    { key: 'imageUrl', label: 'Image', kind: 'image' },
    { key: 'imageAlt', label: 'Image description (alt text)', kind: 'text', max: 200 },
    {
      key: 'imageSide',
      label: 'Image side',
      kind: 'select',
      options: [
        ['right', 'Right'],
        ['left', 'Left'],
      ],
    },
    { key: 'button', label: 'Button', kind: 'button' },
  ],
  stats: [
    { key: 'title', label: 'Heading', kind: 'text', max: 200 },
    {
      key: 'items',
      label: 'Numbers',
      kind: 'items',
      max: 8,
      blank: { value: '10×', label: 'What it means' },
      item: [
        { key: 'value', label: 'Number', kind: 'text', max: 24 },
        { key: 'label', label: 'Label', kind: 'text', max: 120 },
      ],
    },
  ],
  steps: [
    { key: 'title', label: 'Heading', kind: 'text', max: 200 },
    { key: 'subtitle', label: 'Intro', kind: 'textarea', max: 600 },
    {
      key: 'items',
      label: 'Steps',
      kind: 'items',
      max: 12,
      blank: { title: 'Next step', text: '' },
      item: [
        { key: 'title', label: 'Title', kind: 'text', max: 120 },
        { key: 'text', label: 'Text', kind: 'textarea', max: 600 },
      ],
    },
  ],
  testimonials: [
    { key: 'title', label: 'Heading', kind: 'text', max: 200 },
    {
      key: 'items',
      label: 'Quotes',
      kind: 'items',
      max: 12,
      blank: { quote: '', name: '', role: '', avatarUrl: '' },
      item: [
        { key: 'quote', label: 'Quote', kind: 'textarea', max: 800 },
        { key: 'name', label: 'Name', kind: 'text', max: 120 },
        { key: 'role', label: 'Role and company', kind: 'text', max: 120 },
        { key: 'avatarUrl', label: 'Photo', kind: 'image' },
      ],
    },
  ],
  logos: [
    { key: 'title', label: 'Label', kind: 'text', max: 200 },
    {
      key: 'items',
      label: 'Logos',
      kind: 'items',
      max: 24,
      blank: { imageUrl: '', alt: '', href: '' },
      item: [
        { key: 'imageUrl', label: 'Logo', kind: 'image' },
        { key: 'alt', label: 'Company name', kind: 'text', max: 120 },
        { key: 'href', label: 'Link', kind: 'url' },
      ],
    },
  ],
  gallery: [
    { key: 'title', label: 'Heading', kind: 'text', max: 200 },
    { key: 'columns', label: 'Columns', kind: 'select', options: COLUMNS },
    {
      key: 'items',
      label: 'Images',
      kind: 'items',
      max: 24,
      blank: { imageUrl: '', alt: '', caption: '' },
      item: [
        { key: 'imageUrl', label: 'Image', kind: 'image' },
        { key: 'alt', label: 'Description (alt text)', kind: 'text', max: 200 },
        { key: 'caption', label: 'Caption', kind: 'text', max: 200 },
      ],
    },
  ],
  video: [
    { key: 'title', label: 'Heading', kind: 'text', max: 200 },
    {
      key: 'url',
      label: 'YouTube or Vimeo link',
      kind: 'url',
      help: 'Played in privacy-enhanced mode: no tracking until someone presses play.',
    },
    { key: 'caption', label: 'Caption', kind: 'text', max: 300 },
  ],
  faq: [
    { key: 'title', label: 'Heading', kind: 'text', max: 200 },
    {
      key: 'source',
      label: 'Questions',
      kind: 'select',
      options: [
        ['custom', 'Written here'],
        ['site', 'From Admin → FAQs'],
      ],
    },
    {
      key: 'category',
      label: 'FAQ category (for “From Admin → FAQs”)',
      kind: 'text',
      max: 60,
      help: 'Leave empty for all.',
    },
    {
      key: 'items',
      label: 'Questions written here',
      kind: 'items',
      max: 40,
      blank: { question: '', answer: '' },
      item: [
        { key: 'question', label: 'Question', kind: 'text', max: 300 },
        { key: 'answer', label: 'Answer', kind: 'textarea', max: 5000 },
      ],
    },
  ],
  pricing: [
    { key: 'title', label: 'Heading', kind: 'text', max: 200 },
    { key: 'subtitle', label: 'Intro', kind: 'textarea', max: 600 },
  ],
  cta: [
    { key: 'title', label: 'Heading', kind: 'text', max: 200 },
    { key: 'text', label: 'Text', kind: 'textarea', max: 600 },
    { key: 'primary', label: 'Main button', kind: 'button' },
    { key: 'secondary', label: 'Second button', kind: 'button' },
  ],
  contact: [
    { key: 'title', label: 'Heading', kind: 'text', max: 200 },
    { key: 'text', label: 'Text', kind: 'textarea', max: 600 },
  ],
  spacer: [
    {
      key: 'size',
      label: 'Height',
      kind: 'select',
      options: [
        ['sm', 'Small'],
        ['md', 'Medium'],
        ['lg', 'Large'],
      ],
    },
    { key: 'divider', label: 'Show a divider line', kind: 'checkbox' },
  ],
};

type Values = Record<string, unknown>;

function Input({
  spec,
  value,
  onChange,
  folder,
  id,
}: {
  spec: Spec;
  value: unknown;
  onChange: (v: unknown) => void;
  folder: string;
  id: string;
}) {
  const [picker, setPicker] = useState(false);
  const str =
    typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value);
  switch (spec.kind) {
    case 'text':
    case 'url':
      return (
        <input
          id={id}
          className={cn('input h-9 text-sm', spec.kind === 'url' && 'font-mono text-xs')}
          maxLength={'max' in spec ? spec.max : 500}
          value={str}
          placeholder={spec.kind === 'url' ? 'https:// or /page' : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'textarea':
    case 'markdown':
      return (
        <textarea
          id={id}
          className={cn(
            'textarea text-sm',
            spec.kind === 'markdown' ? 'min-h-[220px] font-mono text-[12px]' : 'min-h-[72px]',
          )}
          maxLength={spec.max}
          value={str}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'select':
      return (
        <select
          id={id}
          className="select h-9 text-sm"
          value={str}
          onChange={(e) =>
            onChange(spec.key === 'columns' ? Number(e.target.value) : e.target.value)
          }
        >
          {spec.options.map((o) => {
            const [v, label] = Array.isArray(o) ? o : [o, o];
            return (
              <option key={v} value={v}>
                {label}
              </option>
            );
          })}
        </select>
      );
    case 'checkbox':
      return (
        <input
          id={id}
          type="checkbox"
          className="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case 'image':
      return (
        <div>
          {str && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={str}
              alt=""
              className="mb-2 max-h-28 rounded-sm border border-line object-contain"
            />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPicker(true)}
            >
              <ImagePlus size={14} aria-hidden="true" /> {str ? 'Change' : 'Choose image'}
            </button>
            {str && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange('')}>
                <X size={14} aria-hidden="true" /> Remove
              </button>
            )}
          </div>
          <MediaPickerModal
            open={picker}
            folder={folder}
            onClose={() => setPicker(false)}
            onPick={(a) => onChange(a.url)}
          />
        </div>
      );
    case 'button': {
      const b = (value as { label?: string; href?: string } | undefined) ?? {};
      return (
        <div className="grid grid-cols-2 gap-2">
          <input
            id={id}
            className="input h-9 text-sm"
            placeholder="Label"
            maxLength={60}
            value={b.label ?? ''}
            onChange={(e) => onChange({ ...b, label: e.target.value })}
          />
          <input
            className="input h-9 font-mono text-xs"
            aria-label={`${spec.label} link`}
            placeholder="/signup"
            value={b.href ?? ''}
            onChange={(e) => onChange({ ...b, href: e.target.value })}
          />
        </div>
      );
    }
    case 'items':
      return null;
  }
}

function Fields({
  specs,
  values,
  onChange,
  folder,
  prefix,
}: {
  specs: Spec[];
  values: Values;
  onChange: (key: string, v: unknown) => void;
  folder: string;
  prefix: string;
}) {
  return (
    <div className="space-y-4">
      {specs.map((spec) => {
        const id = `${prefix}-${spec.key}`;
        if (spec.kind === 'items') {
          const list = (values[spec.key] as Values[] | undefined) ?? [];
          const setList = (next: Values[]) => onChange(spec.key, next);
          return (
            <div key={spec.key}>
              <p className="label">{spec.label}</p>
              <ol className="space-y-3">
                {list.map((item, i) => (
                  <li key={i} className="rounded-sm border border-line bg-canvas p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted">#{i + 1}</span>
                      <span className="flex gap-1">
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon h-7 w-7"
                          aria-label="Move up"
                          disabled={i === 0}
                          onClick={() => {
                            const n = list.slice();
                            [n[i - 1], n[i]] = [n[i]!, n[i - 1]!];
                            setList(n);
                          }}
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon h-7 w-7"
                          aria-label="Move down"
                          disabled={i === list.length - 1}
                          onClick={() => {
                            const n = list.slice();
                            [n[i + 1], n[i]] = [n[i]!, n[i + 1]!];
                            setList(n);
                          }}
                        >
                          <ArrowDown size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon h-7 w-7 text-danger"
                          aria-label={`Remove #${i + 1}`}
                          onClick={() => setList(list.filter((_, j) => j !== i))}
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    </div>
                    <Fields
                      specs={spec.item}
                      values={item}
                      folder={folder}
                      prefix={`${id}-${i}`}
                      onChange={(k, v) =>
                        setList(list.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
                      }
                    />
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className="btn btn-soft btn-sm mt-3"
                disabled={list.length >= spec.max}
                onClick={() => setList([...list, { ...spec.blank }])}
              >
                <Plus size={14} aria-hidden="true" /> Add
              </button>
            </div>
          );
        }
        if (spec.kind === 'checkbox') {
          return (
            <label key={spec.key} className="flex items-center gap-2 text-sm">
              <Input
                spec={spec}
                value={values[spec.key]}
                onChange={(v) => onChange(spec.key, v)}
                folder={folder}
                id={id}
              />
              {spec.label}
            </label>
          );
        }
        return (
          <div key={spec.key}>
            <label htmlFor={id} className="label">
              {spec.label}
            </label>
            <Input
              spec={spec}
              value={values[spec.key]}
              onChange={(v) => onChange(spec.key, v)}
              folder={folder}
              id={id}
            />
            {'help' in spec && spec.help && <p className="mt-1 text-xs text-muted">{spec.help}</p>}
          </div>
        );
      })}
    </div>
  );
}

const STYLE_SPECS: Spec[] = [
  {
    key: 'background',
    label: 'Background',
    kind: 'select',
    options: BLOCK_BACKGROUNDS.map(
      (b) =>
        [
          b,
          {
            none: 'Page colour',
            muted: 'Soft',
            brand: 'Brand tint',
            dark: 'Dark',
            gradient: 'Brand gradient',
          }[b],
        ] as [string, string],
    ),
  },
  {
    key: 'align',
    label: 'Alignment',
    kind: 'select',
    options: [
      ['left', 'Left'],
      ['center', 'Centre'],
    ],
  },
  {
    key: 'padding',
    label: 'Space above and below',
    kind: 'select',
    options: BLOCK_PADDINGS.map(
      (p) => [p, { none: 'None', sm: 'Small', md: 'Medium', lg: 'Large' }[p]] as [string, string],
    ),
  },
  {
    key: 'width',
    label: 'Width',
    kind: 'select',
    options: [
      ['narrow', 'Narrow'],
      ['normal', 'Normal'],
      ['wide', 'Wide'],
    ],
  },
  {
    key: 'animation',
    label: 'Animation on scroll',
    kind: 'select',
    options: BLOCK_ANIMATIONS.map(
      (a) =>
        [
          a,
          { none: 'None', fade: 'Fade in', rise: 'Rise in', zoom: 'Zoom in', blur: 'Blur in' }[a],
        ] as [string, string],
    ),
  },
  { key: 'anchor', label: 'Anchor (for /page#anchor links)', kind: 'text', max: 60 },
];

/** Edits the selected block: its content, then its look. */
export function BlockInspector({
  block,
  onChange,
  folder,
}: {
  block: PageBlock;
  onChange: (block: PageBlock) => void;
  folder: string;
}) {
  const [tab, setTab] = useState<'content' | 'style'>('content');
  const values = block as unknown as Values;
  return (
    <div>
      <p className="font-semibold">{PAGE_BLOCK_INFO[block.type].label}</p>
      <p className="text-xs text-muted">{PAGE_BLOCK_INFO[block.type].description}</p>
      <div className="mt-4 flex gap-1 rounded-sm bg-canvas p-1 text-sm" role="tablist">
        {(['content', 'style'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={cn(
              'flex-1 rounded-sm px-3 py-1.5 font-medium',
              tab === t ? 'bg-surface shadow-sm' : 'text-muted',
            )}
            onClick={() => setTab(t)}
          >
            {t === 'content' ? 'Content' : 'Style'}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === 'content' ? (
          <Fields
            specs={SPECS[block.type]}
            values={values}
            folder={folder}
            prefix={block.id}
            onChange={(k, v) => onChange({ ...block, [k]: v } as PageBlock)}
          />
        ) : (
          <Fields
            specs={STYLE_SPECS}
            values={block.style as unknown as Values}
            folder={folder}
            prefix={`${block.id}-style`}
            onChange={(k, v) =>
              onChange({ ...block, style: { ...block.style, [k]: v } } as PageBlock)
            }
          />
        )}
      </div>
    </div>
  );
}
