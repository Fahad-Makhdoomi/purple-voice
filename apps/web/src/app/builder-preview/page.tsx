'use client';

import { useEffect, useState } from 'react';
import { pageBlocksSchema, type PageBlock } from '@pv/shared';
import { PageBlocks } from '@/components/site/blocks/PageBlocks';
import type { Faq, PublicPlan } from '@/lib/server-api';

interface PreviewState {
  blocks: PageBlock[];
  theme: string;
  plans: PublicPlan[];
  faqs: Faq[];
  selectedId: string | null;
}

/**
 * The page builder's preview, shown in an iframe so phone and tablet widths
 * get their real responsive layouts. It renders only what the builder on
 * this same origin posts to it, never anything from the URL, and can only
 * be framed by this site (next.config.mjs).
 */
export default function BuilderPreview() {
  const [state, setState] = useState<PreviewState | null>(null);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'pv:preview') return;
      const parsed = pageBlocksSchema.safeParse(e.data.blocks);
      setState({
        blocks: parsed.success ? parsed.data : [],
        theme: String(e.data.theme ?? 'default'),
        plans: Array.isArray(e.data.plans) ? e.data.plans : [],
        faqs: Array.isArray(e.data.faqs) ? e.data.faqs : [],
        selectedId: typeof e.data.selectedId === 'string' ? e.data.selectedId : null,
      });
    };
    window.addEventListener('message', onMessage);
    window.parent?.postMessage({ type: 'pv:preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (!state?.selectedId) return;
    document
      .querySelector(`[data-block="${CSS.escape(state.selectedId)}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [state?.selectedId]);

  return (
    <div
      data-theme={state?.theme ?? 'default'}
      className="site-theme min-h-screen bg-surface"
      onClickCapture={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('a,button,form')) e.preventDefault();
        const id = target.closest('[data-block]')?.getAttribute('data-block');
        if (id) window.parent?.postMessage({ type: 'pv:select', id }, window.location.origin);
      }}
    >
      {state && state.blocks.length > 0 ? (
        <PageBlocks
          blocks={state.blocks}
          selectedId={state.selectedId}
          data={{
            plans: state.plans,
            faqs: state.faqs,
            captcha: { provider: 'none', enabled: false },
            preview: true,
          }}
        />
      ) : (
        <p className="p-16 text-center text-sm text-muted">
          Your page appears here as you build it.
        </p>
      )}
    </div>
  );
}
