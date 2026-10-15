'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { Loading, Modal, PageHeader, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';

interface Faq {
  id: string;
  question: string;
  answer: string;
  category: string;
  sortOrder: number;
  published: boolean;
}

export default function FaqsAdmin() {
  const { data, reload } = useApi<{ faqs: Faq[] }>('/admin/cms/faqs');
  const [editing, setEditing] = useState<Faq | 'new' | null>(null);
  const { busy, run } = useAction();
  const current = editing === 'new' ? null : editing;

  return (
    <>
      <PageHeader
        title="FAQs"
        description="Shown on /faq (grouped by category), the home page and pricing. Marked up for Google's FAQ results."
        actions={
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            <Plus size={16} aria-hidden="true" /> New FAQ
          </button>
        }
      />
      {!data ? (
        <Loading />
      ) : (
        <div className="card divide-y divide-line">
          {data.faqs.map((f) => (
            <button
              key={f.id}
              type="button"
              className="flex w-full items-start gap-4 p-4 text-left hover:bg-brand-50/40"
              onClick={() => setEditing(f)}
            >
              <span className="badge badge-neutral shrink-0">{f.category}</span>
              <span className="flex-1">
                <span className="font-semibold">{f.question}</span>
                <span className="mt-1 line-clamp-1 block text-sm text-muted">{f.answer}</span>
              </span>
              {!f.published && <span className="badge badge-warning">Hidden</span>}
            </button>
          ))}
        </div>
      )}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={current ? 'Edit FAQ' : 'New FAQ'}
      >
        {editing && (
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const body = {
                question: f.get('question'),
                answer: f.get('answer'),
                category: f.get('category') || 'General',
                sortOrder: Number(f.get('sortOrder') || 0),
                published: f.get('published') === 'on',
              };
              const ok = await run(async () => {
                if (current) await api(`/admin/cms/faqs/${current.id}`, { method: 'PATCH', body });
                else await api('/admin/cms/faqs', { body });
                return true;
              }, 'FAQ saved');
              if (ok) {
                setEditing(null);
                await reload();
              }
            }}
          >
            <Field id="question" label="Question">
              <input
                id="question"
                name="question"
                className="input"
                required
                defaultValue={current?.question}
              />
            </Field>
            <Field id="answer" label="Answer">
              <textarea
                id="answer"
                name="answer"
                className="textarea"
                required
                defaultValue={current?.answer}
              />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="category" label="Category">
                <input
                  id="category"
                  name="category"
                  className="input"
                  defaultValue={current?.category ?? 'General'}
                />
              </Field>
              <Field id="sortOrder" label="Order">
                <input
                  id="sortOrder"
                  name="sortOrder"
                  type="number"
                  className="input"
                  defaultValue={current?.sortOrder ?? 0}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="published"
                className="checkbox"
                defaultChecked={current?.published ?? true}
              />{' '}
              Published
            </label>
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1" disabled={busy}>
                Save
              </button>
              {current && (
                <button
                  type="button"
                  className="btn btn-ghost text-danger"
                  onClick={() =>
                    window.confirm('Delete this FAQ?') &&
                    run(async () => {
                      await api(`/admin/cms/faqs/${current.id}`, { method: 'DELETE' });
                      setEditing(null);
                      await reload();
                    }, 'FAQ deleted')
                  }
                >
                  Delete
                </button>
              )}
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
