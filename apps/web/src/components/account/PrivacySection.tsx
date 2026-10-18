'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { LEGAL_VERSION } from '@pv/shared';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { ErrorNote, Modal, Section, useAction } from '@/components/ui';
import { Field } from '@/components/forms/Field';

/**
 * Privacy and data: marketing emails, download everything (GDPR art. 15/20,
 * CCPA right to know) and delete the account (GDPR art. 17, CCPA right to
 * delete).
 */
export function PrivacySection() {
  const { me, reload } = useSession();
  const { busy, run } = useAction();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasPassword = me?.user.hasPassword ?? true;

  return (
    <Section
      title="Privacy and data"
      description={
        <>
          What we do with your data is in our{' '}
          <Link href="/privacy" className="font-semibold text-brand-700">
            Privacy Policy
          </Link>
          {me?.user.termsAcceptedAt &&
            `; you accepted the Terms on ${new Date(me.user.termsAcceptedAt).toLocaleDateString()}`}
          .
        </>
      }
    >
      <div className="space-y-5">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="checkbox mt-0.5"
            checked={!!me?.user.marketingOptIn}
            disabled={busy}
            onChange={(e) => {
              const marketingOptIn = e.target.checked;
              void run(
                async () => {
                  await api('/auth/me', { method: 'PATCH', body: { marketingOptIn } });
                  await reload();
                },
                marketingOptIn ? 'Subscribed to product news' : 'Unsubscribed',
              );
            }}
          />
          <span>
            <span className="font-semibold">Product news and tips by email</span>
            <span className="block text-muted">
              Account and billing emails are sent either way.
            </span>
          </span>
        </label>

        <div className="flex flex-wrap gap-3 border-t border-line pt-5">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() =>
              run(async () => {
                // Through the API client, so an expired session is refreshed first.
                const data = await api<unknown>('/auth/me/export');
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
                );
                const a = document.createElement('a');
                a.href = url;
                a.download = `purple-voice-data-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }, 'Your data is downloading')
            }
          >
            <Download size={16} aria-hidden="true" /> Download my data
          </button>
          <button
            type="button"
            className="btn btn-ghost text-danger hover:bg-danger/5"
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={16} aria-hidden="true" /> Delete account
          </button>
        </div>
        <p className="text-xs text-muted">
          The download is a JSON file with your account, agents, campaigns, contacts, calls,
          transcripts and appointments. Keys and passwords are never included.
        </p>
      </div>

      <Modal open={deleting} onClose={() => setDeleting(false)} title="Delete your account">
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            setError(null);
            void run(async () => {
              try {
                await api('/auth/me', {
                  method: 'DELETE',
                  body: { password: f.get('password') || undefined, confirm: f.get('confirm') },
                });
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'Could not delete the account');
                throw err;
              }
              window.location.href = '/';
            });
          }}
        >
          <p className="text-sm text-ink-soft">
            This permanently deletes your workspace: agents, phone-number connections, campaigns,
            contacts, calls, transcripts, appointments and integrations. It can&apos;t be undone.
            Download your data first if you need it. A paid plan must be cancelled on the Billing
            page first.
          </p>
          {hasPassword && (
            <Field id="del-password" label="Your password">
              <input
                id="del-password"
                name="password"
                type="password"
                className="input"
                required
                autoComplete="current-password"
              />
            </Field>
          )}
          <Field id="del-confirm" label="Type DELETE to confirm">
            <input
              id="del-confirm"
              name="confirm"
              className="input font-mono"
              required
              pattern="DELETE"
              autoComplete="off"
            />
          </Field>
          {error && <ErrorNote message={error} />}
          <button className="btn btn-primary w-full bg-danger hover:bg-danger" disabled={busy}>
            {busy ? 'Deleting…' : 'Delete everything'}
          </button>
        </form>
      </Modal>
    </Section>
  );
}

/**
 * Asks a subscriber to accept the Terms and Privacy Policy again after they
 * change (and once for accounts created before acceptance was recorded).
 */
export function TermsPrompt() {
  const { me, reload } = useSession();
  const { busy, run } = useAction();
  if (!me?.user.needsTermsAcceptance || me.staff) return null;
  return (
    <Modal open onClose={() => undefined} title="We have updated our terms">
      <div className="space-y-5">
        <p className="text-sm text-ink-soft">
          Please read and accept our updated{' '}
          <Link href="/terms" target="_blank" className="font-semibold text-brand-700">
            Terms of Service
          </Link>
          ,{' '}
          <Link href="/acceptable-use" target="_blank" className="font-semibold text-brand-700">
            Acceptable Use and Calling Policy
          </Link>{' '}
          and{' '}
          <Link href="/privacy" target="_blank" className="font-semibold text-brand-700">
            Privacy Policy
          </Link>{' '}
          to keep using Purple Voice. They add the Free plan, campaign retry limits, consent
          confirmation for calling lists, and your privacy rights.
        </p>
        <button
          type="button"
          className="btn btn-primary w-full"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await api('/auth/accept-terms', { body: { version: LEGAL_VERSION } });
              await reload();
            }, 'Thanks')
          }
        >
          I agree
        </button>
      </div>
    </Modal>
  );
}
