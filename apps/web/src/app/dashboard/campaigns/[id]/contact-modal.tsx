'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { ErrorNote, Modal, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';

export interface EditableContact {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  company: string | null;
  notes: string | null;
  tags: string[];
  status: string;
}

/** Add one contact by hand, or edit one that is already on the list. */
export function ContactModal({
  campaignId,
  contact,
  finished,
  onClose,
  onSaved,
}: {
  campaignId: string;
  /** The contact to edit; omit to add a new one. */
  contact?: EditableContact;
  /** The campaign has ended: numbers are locked and nobody can be added. */
  finished: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { busy, run } = useAction();
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      phone: String(f.get('phone') ?? ''),
      name: String(f.get('name') ?? ''),
      email: String(f.get('email') ?? ''),
      company: String(f.get('company') ?? ''),
      notes: String(f.get('notes') ?? ''),
      tags: String(f.get('tags') ?? ''),
    };
    setError(null);
    const ok = await run(async () => {
      if (contact) {
        await api(`/app/campaigns/${campaignId}/contacts/${contact.id}`, {
          method: 'PATCH',
          body: {
            ...body,
            phone: finished ? undefined : body.phone,
            tags: body.tags
              .split(/[;,]/)
              .map((t) => t.trim())
              .filter(Boolean),
          },
        });
        return true;
      }
      const r = await api<{
        added: number;
        duplicates: number;
        invalid: Array<{ reason: string }>;
      }>(`/app/campaigns/${campaignId}/contacts`, { body: { contacts: [body] } });
      if (!r.added) {
        setError(
          r.duplicates
            ? 'That number is already on the list.'
            : (r.invalid[0]?.reason ?? 'Could not add this contact.'),
        );
        return false;
      }
      return true;
    });
    if (ok) {
      await onSaved();
      onClose();
    }
  }

  const locked = contact && contact.status === 'CALLING';
  return (
    <Modal open onClose={onClose} title={contact ? 'Edit contact' : 'Add contact'}>
      <form onSubmit={submit} className="space-y-4">
        {locked && (
          <ErrorNote message="This contact is on a call right now. Try again in a moment." />
        )}
        <Field
          id="c-phone"
          label="Phone number"
          help={
            contact && finished
              ? 'The campaign has finished, so the number is locked.'
              : contact
                ? 'Changing the number puts this contact back in the queue as a new person.'
                : 'With country code, e.g. +14155550123.'
          }
        >
          <input
            id="c-phone"
            name="phone"
            className="input"
            required
            defaultValue={contact?.phone ?? ''}
            disabled={!!contact && finished}
            autoFocus
            inputMode="tel"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="c-name" label="Name" optional>
            <input id="c-name" name="name" className="input" defaultValue={contact?.name ?? ''} />
          </Field>
          <Field id="c-company" label="Company" optional>
            <input
              id="c-company"
              name="company"
              className="input"
              defaultValue={contact?.company ?? ''}
            />
          </Field>
        </div>
        <Field id="c-email" label="Email" optional>
          <input
            id="c-email"
            name="email"
            type="email"
            className="input"
            defaultValue={contact?.email ?? ''}
          />
        </Field>
        <Field
          id="c-tags"
          label="Tags"
          optional
          help="Separate with commas. After the campaign you can build a follow-up from a tag."
        >
          <input
            id="c-tags"
            name="tags"
            className="input"
            placeholder="vip, webinar"
            defaultValue={contact?.tags.join(', ') ?? ''}
          />
        </Field>
        <Field id="c-notes" label="Notes" optional help="The agent can read these during the call.">
          <textarea
            id="c-notes"
            name="notes"
            className="textarea min-h-[72px]"
            defaultValue={contact?.notes ?? ''}
          />
        </Field>
        {error && <ErrorNote message={error} />}
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy || !!locked}>
            {contact ? 'Save changes' : 'Add contact'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
