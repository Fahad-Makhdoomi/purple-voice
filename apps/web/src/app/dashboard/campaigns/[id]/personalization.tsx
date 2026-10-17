'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/lib/use-api';
import { ErrorNote, Loading, Modal, Section, toast, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';

interface Column {
  key: string;
  role: 'phone' | 'name' | 'company' | 'email' | 'notes' | 'tags' | 'detail';
  variable: string | null;
  filled: number;
  samples: string[];
}

interface UploadPreview {
  total: number;
  columns: Column[];
  withName: number;
  withCompany: number;
}

const ROLE_LABEL: Record<Column['role'], string> = {
  phone: 'Phone number',
  name: 'Contact name',
  company: 'Business name',
  email: 'Email',
  notes: 'Notes (given to the AI)',
  tags: 'Tags',
  detail: 'Detail for the AI',
};

/** Shows what a CSV will do, column by column, before anything is imported. */
export function UploadPreviewModal({
  campaignId,
  csv,
  tags,
  onClose,
  onImported,
}: {
  campaignId: string;
  csv: string;
  tags: string[];
  onClose: () => void;
  onImported: (message: string) => Promise<void>;
}) {
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useAction();

  useEffect(() => {
    api<UploadPreview>(`/app/campaigns/${campaignId}/contacts/preview`, { body: { csv } })
      .then(setPreview)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not read the file'));
  }, [campaignId, csv]);

  async function importNow() {
    await run(async () => {
      const r = await api<{
        added: number;
        duplicates: number;
        invalidCount: number;
        invalid: Array<{ row: number; reason: string }>;
      }>(`/app/campaigns/${campaignId}/contacts`, { body: { csv, tags } });
      await onImported(
        `Added ${r.added} contacts${r.duplicates ? `, ${r.duplicates} already in the list` : ''}${r.invalidCount ? `, ${r.invalidCount} skipped (e.g. row ${r.invalid[0]?.row}: ${r.invalid[0]?.reason})` : ''}`,
      );
      onClose();
    });
  }

  const nobody = preview && preview.withName === 0 && preview.withCompany === 0;
  return (
    <Modal open onClose={onClose} title="Check your columns" size="lg">
      {error ? (
        <div className="space-y-4">
          <ErrorNote message={error} />
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      ) : !preview ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {preview.total} rows found. {preview.withName} have a contact name and{' '}
            {preview.withCompany} have a business name. Every column below reaches the AI, which
            uses it to personalise the call.
          </p>
          {nobody && (
            <ErrorNote message="No names or business names were found, so calls will not be personal. Name the columns “name” or “contact name” and “company” or “business name”." />
          )}
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Column</th>
                  <th scope="col">Used as</th>
                  <th scope="col">Filled</th>
                  <th scope="col">Examples</th>
                </tr>
              </thead>
              <tbody>
                {preview.columns.map((c) => (
                  <tr key={c.key}>
                    <td>
                      <p className="font-semibold">{c.key}</p>
                      {c.variable && <p className="num text-xs text-muted">{c.variable}</p>}
                    </td>
                    <td>{ROLE_LABEL[c.role]}</td>
                    <td className="num">
                      {c.filled}/{preview.total}
                    </td>
                    <td className="text-muted">{c.samples.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={importNow} disabled={busy}>
              Import {preview.total} contacts
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** The campaign's own instructions for tailoring each call, plus the variables the sheet provides. */
export function PersonalizationPanel({
  campaignId,
  personalization,
  contactCount,
  onSaved,
}: {
  campaignId: string;
  personalization: string;
  contactCount: number;
  onSaved: () => Promise<void>;
}) {
  const [text, setText] = useState(personalization);
  const { busy, run } = useAction();
  const vars = useApi<{ variables: Array<{ key: string; count: number }> }>(
    `/app/campaigns/${campaignId}/variables?n=${contactCount}`,
  );
  const dirty = text.trim() !== personalization.trim();

  return (
    <Section
      className="mb-6"
      title="Personalization"
      description="Each call is built from that contact's row in your sheet. Tell the AI how to use it; leave this empty and it still uses the name, business and notes."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api(`/app/campaigns/${campaignId}`, {
              method: 'PATCH',
              body: { personalization: text },
            });
            await onSaved();
          }, 'Personalization saved');
        }}
      >
        <Field
          id="personalization"
          label="How to personalise the call"
          optional
          help="For example: “Greet them by first name, mention their business and city, and tie the pitch to their industry.” You can use {{column_name}} too."
        >
          <textarea
            id="personalization"
            className="input min-h-24"
            maxLength={2000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <div>
          <p className="mb-2 text-sm font-semibold">Details from your sheet</p>
          {!vars.data ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : vars.data.variables.length === 0 ? (
            <p className="text-sm text-muted">
              No contacts yet. Upload a CSV to see the columns here.
            </p>
          ) : (
            <p className="flex flex-wrap gap-2">
              {vars.data.variables.map((v) => (
                <button
                  type="button"
                  key={v.key}
                  className="chip"
                  title={`${v.count} contacts have this. Click to add it to your instructions.`}
                  onClick={() => setText((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}{{${v.key}}}`)}
                >
                  {`{{${v.key}}}`} · {v.count}
                </button>
              ))}
            </p>
          )}
        </div>
        <button className="btn btn-secondary" disabled={busy || !dirty}>
          Save personalization
        </button>
      </form>
    </Section>
  );
}

/** The opening line and instructions the AI would start a call to this contact with. */
export function ScriptModal({
  campaignId,
  contactId,
  label,
  onClose,
}: {
  campaignId: string;
  contactId: string;
  label: string;
  onClose: () => void;
}) {
  const script = useApi<{
    greeting: string;
    instructions: string;
    variables: Record<string, string>;
  }>(`/app/campaigns/${campaignId}/contacts/${contactId}/script`);

  return (
    <Modal open onClose={onClose} title={`Call script for ${label}`} size="lg">
      {script.error ? (
        <ErrorNote message={script.error.message} />
      ) : !script.data ? (
        <Loading />
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-sm font-semibold">Opening line</p>
            <p className="rounded-sm border border-line bg-surface-2 px-4 py-3 text-sm">
              {script.data.greeting || 'The agent has no fixed opening line.'}
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm font-semibold">What the AI is told for this call</p>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-sm border border-line bg-surface-2 px-4 py-3 text-xs">
              {script.data.instructions}
            </pre>
          </div>
          <div className="flex justify-end gap-2">
            <button
              className="btn btn-secondary"
              onClick={() =>
                void navigator.clipboard
                  ?.writeText(script.data?.instructions ?? '')
                  .then(() => toast('Copied'))
              }
            >
              Copy
            </button>
            <button className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
