'use client';

import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useWorkspace } from '@/lib/workspace';
import { PageHeader, Section, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';
import { PasswordSection } from '@/components/account/PasswordSection';

export default function SettingsPage() {
  const { me, reload } = useSession();
  const { workspace, actingAsStaff, reload: reloadWs } = useWorkspace();
  const { busy, run } = useAction();

  return (
    <>
      <PageHeader title="Settings" />
      <div className="grid max-w-4xl gap-6">
        {!actingAsStaff && (
          <Section title="Profile and workspace">
            <form
              className="grid gap-5 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void run(async () => {
                  await api('/auth/me', {
                    method: 'PATCH',
                    body: {
                      name: f.get('name'),
                      company: f.get('company'),
                      timezone: f.get('timezone'),
                    },
                  });
                  await Promise.all([reload(), reloadWs()]);
                }, 'Saved');
              }}
            >
              <Field id="name" label="Your name">
                <input
                  id="name"
                  name="name"
                  className="input"
                  defaultValue={me?.user.name}
                  required
                  minLength={2}
                />
              </Field>
              <Field id="company" label="Workspace / company name">
                <input
                  id="company"
                  name="company"
                  className="input"
                  defaultValue={workspace.name}
                  required
                  minLength={2}
                />
              </Field>
              <Field id="timezone" label="Time zone">
                <input
                  id="timezone"
                  name="timezone"
                  className="input"
                  defaultValue={me?.user.timezone ?? workspace.timezone}
                />
              </Field>
              <Field id="email" label="Email" help="Contact support to change your sign-in email.">
                <input
                  id="email"
                  className="input"
                  value={me?.user.email ?? ''}
                  disabled
                  readOnly
                />
              </Field>
              <div className="sm:col-span-2">
                <button className="btn btn-primary" disabled={busy}>
                  Save
                </button>
              </div>
            </form>
          </Section>
        )}

        {!actingAsStaff && <PasswordSection />}
        {actingAsStaff && (
          <p className="text-sm text-muted">
            Profile settings belong to the customer and aren&apos;t editable while acting as staff.
          </p>
        )}
      </div>
    </>
  );
}
