'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { Section, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';
import { GoogleMark } from '@/components/brand/GoogleMark';

/**
 * Sign-in methods and the change-password form, shared by the subscriber
 * settings page and the staff account page. Accounts created with Google have
 * no password yet: they set one without being asked for a current password.
 */
export function PasswordSection() {
  const { me, reload } = useSession();
  const { busy, run } = useAction();
  const [formKey, setFormKey] = useState(0);
  const googleLinked = me?.user.googleLinked ?? false;
  // Until the session loads, assume the usual form.
  const hasPassword = me?.user.hasPassword ?? true;

  return (
    <Section
      title={hasPassword ? 'Password' : 'Set a password'}
      description={
        hasPassword
          ? 'Changing it signs you out on every other device.'
          : 'Add a password to also sign in with your email address.'
      }
    >
      {googleLinked && (
        <p className="mb-5 flex items-center gap-2.5 text-sm text-ink-soft">
          <GoogleMark size={18} />
          <span>
            <span className="font-semibold text-ink">Signed in with Google.</span>{' '}
            {hasPassword
              ? 'You can use “Continue with Google” or your email and password.'
              : 'You sign in with “Continue with Google”.'}
          </span>
        </p>
      )}
      <form
        key={formKey}
        className="grid gap-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run(
            async () => {
              await api('/auth/change-password', {
                body: {
                  currentPassword: hasPassword ? f.get('current') : undefined,
                  newPassword: f.get('next'),
                },
              });
              setFormKey((k) => k + 1);
              if (!hasPassword) await reload();
            },
            hasPassword ? 'Password changed' : 'Password set',
          );
        }}
      >
        {hasPassword && (
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
        )}
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
            {hasPassword ? 'Change password' : 'Set password'}
          </button>
        </div>
      </form>
    </Section>
  );
}
