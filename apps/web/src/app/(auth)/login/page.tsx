import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/forms/AuthForms';
import { getAuthProviders } from '@/lib/auth-providers';
import { getSettings } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function Page() {
  const [{ captcha }, providers] = await Promise.all([getSettings(), getAuthProviders()]);
  return (
    <Suspense>
      <LoginForm
        captcha={{ provider: captcha.provider, enabled: !!captcha.forms.login }}
        google={providers.google}
      />
    </Suspense>
  );
}
