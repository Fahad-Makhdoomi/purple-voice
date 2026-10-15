import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ForgotPasswordForm } from '@/components/forms/AuthForms';
import { getSettings } from '@/lib/server-api';

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false } };

export default async function Page() {
  const { captcha } = await getSettings();
  return (
    <Suspense>
      <ForgotPasswordForm
        captcha={{ provider: captcha.provider, enabled: !!captcha.forms.forgotPassword }}
      />
    </Suspense>
  );
}
