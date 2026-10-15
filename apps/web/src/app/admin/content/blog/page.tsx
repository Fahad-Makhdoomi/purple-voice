'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useApi } from '@/lib/use-api';
import { Loading, PageHeader, Pagination, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/format';

export default function BlogList() {
  const [page, setPage] = useState(1);
  const { data } = useApi<{
    posts: Array<{
      id: string;
      slug: string;
      title: string;
      status: string;
      publishedAt: string | null;
      tags: string[];
    }>;
    total: number;
    page: number;
    pageSize: number;
  }>(`/admin/cms/posts?page=${page}`);
  return (
    <>
      <PageHeader
        title="Blog"
        description="Articles at /blog. Good posts answer the questions your buyers search for."
        actions={
          <Link href="/admin/content/blog/new" className="btn btn-primary">
            <Plus size={16} aria-hidden="true" /> New post
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
                <th scope="col">Status</th>
                <th scope="col">Tags</th>
                <th scope="col">Published</th>
              </tr>
            </thead>
            <tbody>
              {data.posts.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={`/admin/content/blog/${p.id}`}
                      className="font-semibold hover:text-brand-700"
                    >
                      {p.title}
                    </Link>
                    <p className="font-mono text-xs text-muted">/blog/{p.slug}</p>
                  </td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="text-xs text-muted">{p.tags.join(', ') || '—'}</td>
                  <td className="text-muted">{formatDate(p.publishedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-4">
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onPage={setPage}
            />
          </div>
        </div>
      )}
    </>
  );
}
