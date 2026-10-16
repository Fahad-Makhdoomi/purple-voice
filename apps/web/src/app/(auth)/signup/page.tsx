import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignupForm } from '@/components/forms/AuthForms';
import { getAuthProviders } from '@/lib/auth-providers';
import { getSettings } from '@/lib/server-api';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Create a Purple Voice workspace and put your first AI voice agent on the phone.',
  alternates: { canonical: '/signup' },
};

export default async function Page() {
  const [{ captcha }, providers] = await Promise.all([getSettings(), getAuthProviders()]);
  return (
    <Suspense>
      <SignupForm
        captcha={{ provider: captcha.provider, enabled: !!captcha.forms.signup }}
        google={providers.google}
      />
    </Suspense>
  );
}
