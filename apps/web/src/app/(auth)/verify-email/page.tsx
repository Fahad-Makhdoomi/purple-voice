import type { Metadata } from 'next';
import { Suspense } from 'react';
import { VerifyEmail } from '@/components/forms/AuthForms';

export const metadata: Metadata = {
  title: 'Confirm your email',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense>
      <VerifyEmail />
    </Suspense>
  );
}
