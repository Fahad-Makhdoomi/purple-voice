'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { Loading, PageHeader, StatusBadge } from '@/components/ui';
import { formatRelative } from '@/lib/format';

export default function PagesList() {
  const { data } = useApi<{
    pages: Array<{
      id: string;
      slug: string;
      title: string;
      status: string;
      showInFooter: boolean;
      updatedAt: string;
    }>;
  }>('/admin/cms/pages');
  return (
    <>
      <PageHeader
        title="Pages"
        description="Standalone pages such as About, Privacy and Terms. Published pages live at /<slug>."
        actions={
          <Link href="/admin/content/pages/new" className="btn btn-primary">
            <Plus size={16} aria-hidden="true" /> New page
          </Link>
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
                <th scope="col">Status</th>
                <th scope="col">Footer</th>
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
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td>{p.showInFooter ? 'Yes' : '—'}</td>
                  <td className="text-muted">{formatRelative(p.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
