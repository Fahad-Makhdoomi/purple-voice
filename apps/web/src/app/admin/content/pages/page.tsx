'use client';

import Link from 'next/link';
import { useState } from 'react';
import { FileText, LayoutTemplate, Plus } from 'lucide-react';
import { PAGE_TEMPLATES, type PageTemplate } from '@pv/shared';
import { useApi } from '@/lib/use-api';
import { Loading, Modal, PageHeader, StatusBadge } from '@/components/ui';
import { formatRelative } from '@/lib/format';

const TEMPLATE_HELP: Record<PageTemplate, string> = {
  blank: 'An empty builder page.',
  landing:
    'Hero, logos, features, image and text, numbers, testimonials, FAQ and a call to action.',
  feature: 'Explain one feature with an image, steps, a feature grid and a video.',
  about: 'Your story, numbers, a gallery, testimonials and a contact form.',
  pricing: 'A hero, the live plan cards, FAQs and a call to action.',
};

export default function PagesList() {
  const [choosing, setChoosing] = useState(false);
  const { data } = useApi<{
    pages: Array<{
      id: string;
      slug: string;
      title: string;
      status: string;
      layout: string;
      showInFooter: boolean;
      showInHeader: boolean;
      updatedAt: string;
    }>;
  }>('/admin/cms/pages');
  return (
    <>
      <PageHeader
        title="Pages"
        description="Landing pages built from blocks, and text pages such as Privacy and Terms. Published pages live at /<slug>."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setChoosing(true)}>
            <Plus size={16} aria-hidden="true" /> New page
          </button>
        }
      />
      {!data ? (
        <Loading />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">URL</th>
                <th scope="col">Type</th>
                <th scope="col">Status</th>
                <th scope="col">Menus</th>
                <th scope="col">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.pages.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={`/admin/content/pages/${p.id}`}
                      className="font-semibold hover:text-brand-700"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="font-mono text-xs text-muted">/{p.slug}</td>
                  <td className="text-sm text-ink-soft">
                    {p.layout === 'builder' ? 'Builder' : 'Text'}
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="text-sm text-ink-soft">
                    {[p.showInHeader && 'Header', p.showInFooter && 'Footer']
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </td>
                  <td className="text-muted">{formatRelative(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={choosing} onClose={() => setChoosing(false)} title="New page" size="lg">
        <ul className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(PAGE_TEMPLATES) as PageTemplate[]).map((t) => (
            <li key={t}>
              <Link
                href={`/admin/content/pages/new?template=${t}`}
                className="flex h-full gap-3 rounded-lg border border-line p-4 transition hover:border-brand-400 hover:bg-brand-50"
              >
                <LayoutTemplate
                  size={20}
                  className="mt-0.5 shrink-0 text-brand-600"
                  aria-hidden="true"
                />
                <span>
                  <span className="font-semibold">{PAGE_TEMPLATES[t].label}</span>
                  <span className="mt-1 block text-sm text-muted">{TEMPLATE_HELP[t]}</span>
                </span>
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/admin/content/pages/new"
              className="flex h-full gap-3 rounded-lg border border-line p-4 transition hover:border-brand-400 hover:bg-brand-50"
            >
              <FileText size={20} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />
              <span>
                <span className="font-semibold">Text page</span>
                <span className="mt-1 block text-sm text-muted">
                  Written in Markdown, like Privacy or Terms.
                </span>
              </span>
            </Link>
          </li>
        </ul>
      </Modal>
    </>
  );
}
