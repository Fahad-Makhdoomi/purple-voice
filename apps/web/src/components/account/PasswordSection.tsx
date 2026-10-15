'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { Section, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';

/** Change-password form, shared by the subscriber settings page and the staff account page. */
export function PasswordSection() {
  const { busy, run } = useAction();
  const [formKey, setFormKey] = useState(0);

  return (
    <Section title="Password" description="Changing it signs you out on every other device.">
      <form
        key={formKey}
        className="grid gap-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(async () => {
            await api('/auth/change-password', {
              body: { currentPassword: f.get('current'), newPassword: f.get('next') },
            });
            setFormKey((k) => k + 1);
          }, 'Password changed');
        }}
      >
        <Field id="current" label="Current password">
          <input
            id="current"
            name="current"
            type="password"
            className="input"
            required
            autoComplete="current-password"
          />
        </Field>
        <Field
          id="next"
          label="New password"
          help="At least 10 characters, with a letter and a number."
        >
          <input
            id="next"
            name="next"
            type="password"
            className="input"
            required
            minLength={10}
            autoComplete="new-password"
          />
        </Field>
        <div className="sm:col-span-2">
          <button className="btn btn-primary" disabled={busy}>
            Change password
          </button>
        </div>
      </form>
    </Section>
  );
}
