'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Lock, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { humanize } from '@/lib/format';

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {back && (
          <Link
            href={back.href}
            className="mb-2 inline-block text-sm font-semibold text-brand-700 hover:text-brand-900"
          >
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('card card-pad', className)}>
      {(title || actions) && (
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold">{title}</h2>}
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Stat tile: label · value · optional hint. Values use the tile's ink, never a data colour. */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'gradient',
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: 'gradient' | 'plain';
}) {
  return (
    <div className={tone === 'gradient' ? 'stat-tile' : 'card p-5'}>
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            'text-sm font-medium',
            tone === 'gradient' ? 'text-brand-900/70' : 'text-muted',
          )}
        >
          {label}
        </p>
        {Icon && (
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full',
              tone === 'gradient' ? 'bg-white/50 text-brand-800' : 'bg-brand-50 text-brand-700',
            )}
          >
            <Icon size={16} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="num mt-3 text-[32px] font-light leading-none tracking-tight">{value}</p>
      {hint && (
        <p className={cn('mt-2 text-xs', tone === 'gradient' ? 'text-brand-900/60' : 'text-muted')}>
          {hint}
        </p>
      )}
    </div>
  );
}

/** Usage meter. The fill shifts from brand to warning to danger as it fills; the track is the same ramp, lighter. */
export function Meter({
  value,
  max,
  label,
}: {
  value: number;
  max: number | null;
  label?: string;
}) {
  const ratio = max ? Math.min(value / max, 1) : 0;
  const fill = ratio >= 0.95 ? 'bg-danger' : ratio >= 0.8 ? 'bg-warning' : 'bg-brand-600';
  const track = ratio >= 0.95 ? 'bg-danger/15' : ratio >= 0.8 ? 'bg-warning/15' : 'bg-brand-100';
  return (
    <div>
      {label && (
        <div className="mb-1.5 flex justify-between text-xs">
          <span className="font-medium text-ink-soft">{label}</span>
          <span className="num text-muted">
            {value.toLocaleString()} / {max === null ? '∞' : max.toLocaleString()}
          </span>
        </div>
      )}
      <div
        className={cn('h-2 overflow-hidden rounded-pill', max === null ? 'bg-brand-100' : track)}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max ?? undefined}
        aria-valuenow={value}
        aria-label={label}
      >
        <div
          className={cn('h-full rounded-pill transition-all', fill)}
          style={{ width: `${max ? Math.max(ratio * 100, value ? 2 : 0) : 0}%` }}
        />
      </div>
    </div>
  );
}

/** Radial tick gauge (the dashboard reference's right-hand panel). */
export function Gauge({
  value,
  max,
  label,
  sublabel,
}: {
  value: number;
  max: number | null;
  label: string;
  sublabel?: string;
}) {
  const ratio = max ? Math.min(value / max, 1) : 0;
  const ticks = 48;
  const active = Math.round(ratio * ticks);
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[240px]">
      <svg
        viewBox="0 0 200 200"
        className="h-full w-full"
        role="img"
        aria-label={`${label}: ${Math.round(ratio * 100)}%`}
      >
        {Array.from({ length: ticks }, (_, i) => {
          const angle = (-225 + (i / (ticks - 1)) * 270) * (Math.PI / 180);
          const r1 = 70;
          const r2 = i % 4 === 0 ? 92 : 86;
          return (
            <line
              key={i}
              x1={100 + r1 * Math.cos(angle)}
              y1={100 + r1 * Math.sin(angle)}
              x2={100 + r2 * Math.cos(angle)}
              y2={100 + r2 * Math.sin(angle)}
              stroke={i < active ? 'white' : 'rgb(255 255 255 / 0.28)'}
              strokeWidth={i % 4 === 0 ? 2.5 : 1.5}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
        <span className="num text-3xl font-light">{value.toLocaleString()}</span>
        <span className="text-xs text-white/70">{sublabel ?? `${Math.round(ratio * 100)}%`}</span>
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn('animate-spin text-brand-500', className)}
      size={20}
      aria-label="Loading"
    />
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-20 text-sm text-muted" role="status">
      <Spinner /> {label}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-brand-200 bg-brand-50/40 px-6 py-14 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-brand-600 shadow">
        <Icon size={22} aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p
      className="rounded-sm border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger"
      role="alert"
    >
      {message}
    </p>
  );
}

const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'badge-success',
  COMPLETED: 'badge-success',
  SUCCEEDED: 'badge-success',
  PUBLISHED: 'badge-success',
  RESOLVED: 'badge-success',
  WON: 'badge-success',
  SCHEDULED: 'badge-brand',
  RUNNING: 'badge-brand',
  IN_PROGRESS: 'badge-brand',
  RINGING: 'badge-brand',
  OPEN: 'badge-brand',
  NEW: 'badge-brand',
  TRIALING: 'badge-brand',
  APPOINTMENT_BOOKED: 'badge-success',
  INTERESTED: 'badge-brand',
  PAUSED: 'badge-warning',
  PENDING: 'badge-warning',
  PAST_DUE: 'badge-warning',
  TRANSFERRED: 'badge-brand',
  CALLBACK_REQUESTED: 'badge-warning',
  HIGH: 'badge-warning',
  URGENT: 'badge-danger',
  FAILED: 'badge-danger',
  CANCELED: 'badge-danger',
  UNPAID: 'badge-danger',
  LOST: 'badge-danger',
  DO_NOT_CALL: 'badge-danger',
  NOT_INTERESTED: 'badge-neutral',
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="badge badge-neutral">—</span>;
  return (
    <span className={cn('badge', STATUS_TONE[status] ?? 'badge-neutral')}>{humanize(status)}</span>
  );
}

/** Native <dialog>: focus trapping, Escape to close and the backdrop come from the browser. */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        'w-[calc(100%-2rem)] rounded-xl border-0 bg-surface p-0 text-ink shadow-lg backdrop:bg-night/50 backdrop:backdrop-blur-sm',
        size === 'lg' ? 'max-w-3xl' : 'max-w-lg',
      )}
    >
      {open && (
        <div className="p-6 sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-icon -mr-2 -mt-2"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** Shown in place of a Pro-only feature on plans that don't include it. */
export function UpgradeGate({ feature, body }: { feature: string; body: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-night p-8 text-white sm:p-10">
      <div
        className="light-beam pointer-events-none absolute inset-0 opacity-70"
        aria-hidden="true"
      />
      <div className="relative max-w-lg">
        <span className="inline-flex items-center gap-2 rounded-pill bg-white/10 px-3 py-1 text-xs font-semibold text-brand-200">
          <Lock size={12} aria-hidden="true" /> Pro feature
        </span>
        <h2 className="mt-4 text-2xl font-semibold text-white">{feature}</h2>
        <p className="mt-2 text-white/65">{body}</p>
        <Link href="/dashboard/billing?plan=PRO" className="btn btn-magic mt-6">
          Upgrade to Pro
        </Link>
      </div>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-between text-sm" aria-label="Pagination">
      <span className="text-muted">
        Page {page} of {pages} · {total.toLocaleString()} total
      </span>
      <div className="flex gap-2">
        <button
          className="btn btn-secondary btn-sm"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </button>
        <button
          className="btn btn-secondary btn-sm"
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

/** Lightweight toast: one message at a time, announced politely. */
let pushToast: ((msg: { text: string; tone?: 'success' | 'error' }) => void) | null = null;
export function toast(text: string, tone: 'success' | 'error' = 'success') {
  pushToast?.({ text, tone });
}
export function Toaster() {
  const [msg, setMsg] = useState<{ text: string; tone?: 'success' | 'error' } | null>(null);
  useEffect(() => {
    pushToast = (m) => setMsg(m);
    return () => {
      pushToast = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2"
    >
      {msg && (
        <div
          className={cn(
            'pointer-events-auto animate-rise rounded-pill px-5 py-3 text-sm font-semibold shadow-lg',
            msg.tone === 'error' ? 'bg-danger text-white' : 'bg-ink text-white',
          )}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}

/** Wraps an async action with busy state and error toasts. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const run = async <T,>(fn: () => Promise<T>, success?: string): Promise<T | undefined> => {
    setBusy(true);
    try {
      const result = await fn();
      if (success) toast(success);
      return result;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Something went wrong', 'error');
      return undefined;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1.5" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="chip"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
