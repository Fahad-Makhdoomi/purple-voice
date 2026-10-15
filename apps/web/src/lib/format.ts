const nf = new Intl.NumberFormat('en-US');

export const formatNumber = (n: number | null | undefined) => (n == null ? '—' : nf.format(n));

export function formatMoney(cents: number | null | undefined, opts: { decimals?: boolean } = {}) {
  if (cents == null) return 'Custom';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: opts.decimals ? 2 : cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

export const formatPercent = (ratio: number | null | undefined, digits = 1) =>
  ratio == null ? '—' : `${(ratio * 100).toFixed(digits)}%`;

export function formatDuration(sec: number | null | undefined) {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDate(
  value: string | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-US', opts).format(new Date(value));
}

export const formatDateTime = (value: string | Date | null | undefined) =>
  formatDate(value, { dateStyle: 'medium', timeStyle: 'short' });

export function formatRelative(value: string | Date | null | undefined) {
  if (!value) return '—';
  const diff = (new Date(value).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day');
  return formatDate(value);
}

/** "APPOINTMENT_BOOKED" → "Appointment booked" */
export const humanize = (value: string | null | undefined) =>
  value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') : '—';
