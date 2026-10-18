'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Monitor,
  Plus,
  Smartphone,
  Tablet,
  Trash2,
} from 'lucide-react';
import {
  PAGE_BLOCK_INFO,
  PAGE_BLOCK_TYPES,
  PAGE_TEMPLATES,
  defaultBlock,
  newBlockId,
  templateBlocks,
  type PageBlock,
  type PageBlockType,
  type PageTemplate,
} from '@pv/shared';
import { useApi } from '@/lib/use-api';
import { Modal } from '@/components/ui';
import type { Faq, PublicPlan } from '@/lib/server-api';
import { cn } from '@/lib/cn';
import { BlockInspector } from './BlockInspector';

const DEVICES = [
  { id: 'desktop', label: 'Desktop', width: '100%', icon: Monitor },
  { id: 'tablet', label: 'Tablet', width: '820px', icon: Tablet },
  { id: 'phone', label: 'Phone', width: '390px', icon: Smartphone },
] as const;

/**
 * The page builder: an outline of blocks (drag to reorder, duplicate, hide,
 * delete), a live preview drawn by the website's own block components in the
 * active theme, and an inspector for the selected block.
 */
export function PageBuilder({
  blocks,
  onChange,
  folder,
}: {
  blocks: PageBlock[];
  onChange: (blocks: PageBlock[]) => void;
  folder: string;
}) {
  const [selected, setSelected] = useState<string | null>(blocks[0]?.id ?? null);
  const [adding, setAdding] = useState<number | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [device, setDevice] = useState<(typeof DEVICES)[number]['id']>('desktop');
  const settings = useApi<{ appearance: { theme: string }; captcha: { provider: 'none' } }>(
    '/public/settings',
  );
  const plans = useApi<{ plans: PublicPlan[] }>('/public/plans');
  const faqs = useApi<{ faqs: Faq[] }>('/public/faqs');
  const current = blocks.find((b) => b.id === selected) ?? null;
  const frame = useRef<HTMLIFrameElement>(null);

  // The preview iframe draws whatever we post it (app/builder-preview).
  const post = useCallback(() => {
    frame.current?.contentWindow?.postMessage(
      {
        type: 'pv:preview',
        blocks,
        selectedId: selected,
        theme: settings.data?.appearance.theme ?? 'default',
        plans: plans.data?.plans ?? [],
        faqs: faqs.data?.faqs ?? [],
      },
      window.location.origin,
    );
  }, [blocks, selected, settings.data, plans.data, faqs.data]);
  useEffect(post, [post]);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === 'pv:preview-ready') post();
      if (e.data?.type === 'pv:select' && typeof e.data.id === 'string') setSelected(e.data.id);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [post]);

  const insert = (at: number, items: PageBlock[]) => {
    const next = blocks.slice();
    next.splice(at, 0, ...items);
    onChange(next);
    setSelected(items[0]?.id ?? null);
  };
  const update = (b: PageBlock) => onChange(blocks.map((x) => (x.id === b.id ? b : x)));
  const remove = (id: string) => {
    onChange(blocks.filter((b) => b.id !== id));
    if (selected === id) setSelected(null);
  };
  const moveTo = (from: number, to: number) => {
    if (from === to) return;
    const next = blocks.slice();
    const [b] = next.splice(from, 1);
    next.splice(to > from ? to - 1 : to, 0, b!);
    onChange(next);
  };
  const width = DEVICES.find((d) => d.id === device)!.width;

  return (
    <div className="grid gap-5 2xl:grid-cols-[260px_minmax(0,1fr)_340px] xl:grid-cols-[240px_minmax(0,1fr)]">
      {/* Outline */}
      <section className="card card-pad h-fit xl:sticky xl:top-4" aria-label="Page outline">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Blocks</h2>
          <button
            type="button"
            className="btn btn-soft btn-sm"
            onClick={() => setAdding(blocks.length)}
          >
            <Plus size={14} aria-hidden="true" /> Add
          </button>
        </div>
        {blocks.length === 0 ? (
          <div className="space-y-2">
            <p className="text-sm text-muted">Start from a layout, or add blocks one by one.</p>
            {(Object.keys(PAGE_TEMPLATES) as PageTemplate[])
              .filter((t) => t !== 'blank')
              .map((t) => (
                <button
                  key={t}
                  type="button"
                  className="btn btn-secondary btn-sm w-full justify-start"
                  onClick={() => insert(0, templateBlocks(t))}
                >
                  {PAGE_TEMPLATES[t].label}
                </button>
              ))}
          </div>
        ) : (
          <ol className="space-y-1">
            {blocks.map((b, i) => (
              <li
                key={b.id}
                draggable
                onDragStart={() => setDragging(i)}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(i);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging !== null) moveTo(dragging, i);
                  setDragging(null);
                  setOver(null);
                }}
                className={cn(
                  'group flex items-center gap-1 rounded-sm border px-1.5 py-1.5 text-sm transition',
                  selected === b.id
                    ? 'border-brand-400 bg-brand-50'
                    : 'border-transparent hover:bg-canvas',
                  over === i &&
                    dragging !== null &&
                    dragging !== i &&
                    'border-t-2 border-t-brand-500',
                  b.hidden && 'opacity-50',
                )}
              >
                <GripVertical
                  size={14}
                  className="shrink-0 cursor-grab text-subtle"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left"
                  onClick={() => setSelected(b.id)}
                  aria-current={selected === b.id}
                >
                  {PAGE_BLOCK_INFO[b.type].label}
                  {'title' in b && b.title ? (
                    <span className="text-muted"> · {b.title}</span>
                  ) : null}
                </button>
                <span className="flex opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon h-7 w-7"
                    aria-label={b.hidden ? 'Show block' : 'Hide block'}
                    title={b.hidden ? 'Show' : 'Hide'}
                    onClick={() => update({ ...b, hidden: !b.hidden })}
                  >
                    {b.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon h-7 w-7"
                    aria-label="Duplicate block"
                    title="Duplicate"
                    onClick={() => insert(i + 1, [{ ...structuredClone(b), id: newBlockId() }])}
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon h-7 w-7 text-danger"
                    aria-label="Delete block"
                    title="Delete"
                    onClick={() => remove(b.id)}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 text-xs text-muted">
          Drag blocks to reorder. Hidden blocks stay in the draft only.
        </p>
      </section>

      {/* Preview */}
      <section className="min-w-0" aria-label="Live preview">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Live preview</p>
          <div
            className="flex gap-1 rounded-sm bg-canvas p-1"
            role="radiogroup"
            aria-label="Preview size"
          >
            {DEVICES.map((d) => (
              <button
                key={d.id}
                type="button"
                role="radio"
                aria-checked={device === d.id}
                aria-label={d.label}
                title={d.label}
                className={cn(
                  'rounded-sm p-1.5',
                  device === d.id ? 'bg-surface shadow-sm' : 'text-muted',
                )}
                onClick={() => setDevice(d.id)}
              >
                <d.icon size={15} />
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-line bg-canvas p-2">
          <iframe
            ref={frame}
            src="/builder-preview"
            title="Page preview"
            onLoad={post}
            className="mx-auto block h-[78vh] rounded-lg bg-surface shadow transition-[width] duration-300"
            style={{ width, maxWidth: '100%' }}
          />
        </div>
      </section>

      {/* Inspector */}
      <section
        className="card card-pad h-fit xl:col-span-2 2xl:sticky 2xl:top-4 2xl:col-span-1"
        aria-label="Block settings"
      >
        {current ? (
          <BlockInspector key={current.id} block={current} onChange={update} folder={folder} />
        ) : (
          <p className="text-sm text-muted">
            Select a block in the outline or the preview to edit it.
          </p>
        )}
      </section>

      <Modal open={adding !== null} onClose={() => setAdding(null)} title="Add a block" size="lg">
        <ul className="grid gap-2 sm:grid-cols-2">
          {PAGE_BLOCK_TYPES.map((t: PageBlockType) => (
            <li key={t}>
              <button
                type="button"
                className="h-full w-full rounded-lg border border-line p-4 text-left transition hover:border-brand-400 hover:bg-brand-50"
                onClick={() => {
                  insert(adding ?? blocks.length, [defaultBlock(t)]);
                  setAdding(null);
                }}
              >
                <span className="font-semibold">{PAGE_BLOCK_INFO[t].label}</span>
                <span className="mt-1 block text-sm text-muted">
                  {PAGE_BLOCK_INFO[t].description}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
