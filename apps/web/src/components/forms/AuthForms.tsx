'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { homePathForRole, type Role } from '@pv/shared';
import { api, ApiError, setActingWorkspace } from '@/lib/api';
import { Field, FormError } from './Field';
import { useCaptcha, type CaptchaProvider } from './useCaptcha';

type CaptchaProps = { provider: CaptchaProvider; enabled: boolean };

/** Only same-site paths are honoured as a post-login destination. */
function safeNext(next: string | null): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : null;
}

function PasswordInput({
  id,
  name,
  autoComplete,
}: {
  id: string;
  name: string;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? 'text' : 'password'}
        required
        minLength={name === 'password' && autoComplete === 'new-password' ? 10 : 1}
        autoComplete={autoComplete}
        className="input pr-11"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-ink"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

export function LoginForm({ captcha }: { captcha: CaptchaProps }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cap = useCaptcha({ ...captcha, action: 'login' });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setBusy(true);
    try {
      const { user } = await api<{ user: { role: Role } }>('/auth/login', {
        body: {
          email: form.get('email'),
          password: form.get('password'),
          captchaToken: await cap.getToken(),
        },
      });
      setActingWorkspace(null);
      router.replace(safeNext(params.get('next')) ?? homePathForRole(user.role));
      router.refresh();
    } catch (err) {
      cap.reset();
      setError(err instanceof ApiError ? err.message : 'Could not sign in');
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="text-h2">Welcome back</h1>
      <p className="mt-2 text-muted">Sign in to manage your agents and calls.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <Field id="email" label="Email">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            autoFocus
          />
        </Field>
        <Field id="password" label="Password">
          <PasswordInput id="password" name="password" autoComplete="current-password" />
        </Field>
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm font-semibold text-brand-700 hover:text-brand-900"
          >
            Forgot password?
          </Link>
        </div>
        {cap.element}
        <FormError message={error} />
        <button className="btn btn-primary btn-lg w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        New to Purple Voice?{' '}
        <Link href="/signup" className="font-semibold text-brand-700 hover:text-brand-900">
          Create an account
        </Link>
      </p>
    </>
  );
}

export function SignupForm({ captcha }: { captcha: CaptchaProps }) {
  const router = useRouter();
  const params = useSearchParams();
  const plan = params.get('plan');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cap = useCaptcha({ ...captcha, action: 'signup' });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(null);
    setBusy(true);
    try {
      await api('/auth/register', {
        body: {
          name: form.get('name'),
          company: form.get('company') || undefined,
          email: form.get('email'),
          password: form.get('password'),
          captchaToken: await cap.getToken(),
        },
      });
      router.replace(
        plan === 'BASIC' || plan === 'PRO' ? `/dashboard/billing?plan=${plan}` : '/dashboard',
      );
      router.refresh();
    } catch (err) {
      cap.reset();
      setError(err instanceof ApiError ? err.message : 'Could not create your account');
      setBusy(false);
    }
  }

  return (
    <>
      <h1 className="text-h2">Create your account</h1>
      <p className="mt-2 text-muted">
        {plan === 'PRO'
          ? 'You picked Pro.'
          : plan === 'BASIC'
            ? 'You picked Basic.'
            : 'Set up your workspace,'}{' '}
        choose a plan when you&apos;re ready to connect a number.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="name" label="Your name">
            <input
              id="name"
              name="name"
              required
              minLength={2}
              autoComplete="name"
              className="input"
              autoFocus
            />
          </Field>
          <Field id="company" label="Company" optional>
            <input id="company" name="company" autoComplete="organization" className="input" />
          </Field>
        </div>
        <Field id="email" label="Work email">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
          />
        </Field>
        <Field
          id="password"
          label="Password"
          help="At least 10 characters, with a letter and a number."
        >
          <PasswordInput id="password" name="password" autoComplete="new-password" />
        </Field>
        {cap.element}
        <FormError message={error} />
        <button className="btn btn-primary btn-lg w-full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="text-center text-xs text-subtle">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="underline">
            terms
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="underline">
            privacy policy
          </Link>
          .
        </p>
      </form>
      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-900">
          Sign in
        </Link>
      </p>
    </>
  );
}

export function ForgotPasswordForm({ captcha }: { captcha: CaptchaProps }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const cap = useCaptcha({ ...captcha, action: 'forgot_password' });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api('/auth/forgot-password', {
        body: { email: form.get('email'), captchaToken: await cap.getToken() },
      });
      setSent(true);
    } catch (err) {
      cap.reset();
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div role="status">
        <CheckCircle2 size={36} className="text-success" aria-hidden="true" />
        <h1 className="mt-4 text-h2">Check your inbox</h1>
        <p className="mt-2 text-muted">
          If an account exists for that email, a reset link is on its way. It expires in an hour.
        </p>
        <Link href="/login" className="btn btn-secondary mt-8">
          Back to sign in
        </Link>
      </div>
    );
  }
  return (
    <>
      <h1 className="text-h2">Reset your password</h1>
      <p className="mt-2 text-muted">We&apos;ll email you a link to choose a new one.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <Field id="email" label="Email">
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            autoFocus
          />
        </Field>
        {cap.element}
        <FormError message={error} />
        <button className="btn btn-primary btn-lg w-full" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>
    </>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api('/auth/reset-password', { body: { token, password: form.get('password') } });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status">
        <CheckCircle2 size={36} className="text-success" aria-hidden="true" />
        <h1 className="mt-4 text-h2">Password updated</h1>
        <p className="mt-2 text-muted">
          You&apos;ve been signed out everywhere. Sign in with your new password.
        </p>
        <Link href="/login" className="btn btn-primary mt-8">
          Sign in
        </Link>
      </div>
    );
  }
  return (
    <>
      <h1 className="text-h2">Choose a new password</h1>
      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <Field
          id="password"
          label="New password"
          help="At least 10 characters, with a letter and a number."
        >
          <PasswordInput id="password" name="password" autoComplete="new-password" />
        </Field>
        <FormError
          message={!token ? 'This link is missing its token. Request a new one.' : error}
        />
        <button className="btn btn-primary btn-lg w-full" disabled={busy || !token}>
          {busy ? 'Saving…' : 'Save password'}
        </button>
      </form>
    </>
  );
}
