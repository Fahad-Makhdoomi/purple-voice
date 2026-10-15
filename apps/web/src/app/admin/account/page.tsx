'use client';

import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { PageHeader, Section, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';
import { PasswordSection } from '@/components/account/PasswordSection';

/** Staff members' own profile and password. Subscribers use /dashboard/settings. */
export default function AccountPage() {
  const { me, reload } = useSession();
  const { busy, run } = useAction();

  return (
    <>
      <PageHeader title="Your account" />
      <div className="grid max-w-4xl gap-6">
        <Section title="Profile">
          <form
            className="grid gap-5 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                await api('/auth/me', {
                  method: 'PATCH',
                  body: { name: f.get('name'), timezone: f.get('timezone') || undefined },
                });
                await reload();
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
            <Field id="timezone" label="Time zone">
              <input
                id="timezone"
                name="timezone"
                className="input"
                defaultValue={me?.user.timezone ?? ''}
              />
            </Field>
            <Field id="email" label="Email" help="Sign-in emails can't be changed here.">
              <input id="email" className="input" value={me?.user.email ?? ''} disabled readOnly />
            </Field>
            <div className="sm:col-span-2">
              <button className="btn btn-primary" disabled={busy}>
                Save
              </button>
            </div>
          </form>
        </Section>
        <PasswordSection />
      </div>
    </>
  );
}
