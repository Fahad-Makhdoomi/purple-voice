import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro } from '@/components/site/shared/PageIntro';
import { ConsentStatus, PrivacyRequestForm } from '@/components/site/PrivacyChoices';
import { getSettings } from '@/lib/server-api';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Your privacy choices',
  description:
    'Change your cookie settings, opt out of sale or sharing, and make access, deletion or correction requests.',
  alternates: { canonical: '/privacy-choices' },
};

/**
 * One place for every privacy choice: cookies, Global Privacy Control, the
 * US "Do Not Sell or Share" opt-out and GDPR / UK GDPR / CCPA requests.
 */
export default async function PrivacyChoicesPage() {
  const settings = await getSettings();
  return (
    <>
      <PageIntro
        eyebrow="Privacy"
        title="Your privacy choices"
        lead="Control cookies, opt out, and ask us for a copy of your data or to delete it."
      />
      <section className="bg-surface py-16 sm:py-20">
        <div className="container grid max-w-5xl gap-8 lg:grid-cols-[1fr_1.3fr]">
          <div className="space-y-6">
            <ConsentStatus />
            <div className="card card-pad space-y-3">
              <h2 className="text-h3">Do not sell or share my personal information</h2>
              <p className="text-ink-soft">
                We do not sell personal information and do not share it for cross-context
                behavioural advertising. You do not need to do anything; if you want it on record,
                choose “Do not sell or share” in the form.
              </p>
            </div>
            <div className="card card-pad space-y-3">
              <h2 className="text-h3">Signed in?</h2>
              <p className="text-ink-soft">
                Download your data or delete your account yourself under{' '}
                <Link href="/dashboard/settings" className="font-semibold text-brand-700">
                  Settings → Privacy and data
                </Link>
                .
              </p>
            </div>
            <p className="text-sm text-muted">
              More in our{' '}
              <Link href="/privacy" className="underline">
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link href="/cookies" className="underline">
                Cookie Policy
              </Link>
              .
            </p>
          </div>
          <PrivacyRequestForm
            captcha={{
              provider: settings.captcha.provider,
              enabled: !!settings.captcha.forms.contact,
            }}
          />
        </div>
      </section>
    </>
  );
}
