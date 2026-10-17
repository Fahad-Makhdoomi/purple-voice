/**
 * Minimal RFC 4180 CSV parser for contact uploads: quoted fields, escaped
 * quotes, CRLF or LF. Returns one object per row keyed by the lower-cased
 * header. Contact lists are small enough (≤ 50k rows) to parse in memory.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const input = text.replace(/^﻿/, '');

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  return body.map((r) => Object.fromEntries(keys.map((k, idx) => [k, (r[idx] ?? '').trim()])));
}

/**
 * Normalises a phone number to E.164. Numbers without a country code are
 * assumed to be in `defaultCountryCode` (digits only, e.g. "1").
 */
export function toE164(raw: string, defaultCountryCode = '1'): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) return null;
  let e164: string;
  if (trimmed.startsWith('+')) e164 = `+${digits}`;
  else if (trimmed.startsWith('00')) e164 = `+${digits.slice(2)}`;
  else if (digits.length === 10) e164 = `+${defaultCountryCode}${digits}`;
  else e164 = `+${digits}`;
  return /^\+[1-9]\d{6,14}$/.test(e164) ? e164 : null;
}

const NAME_KEYS = [
  'name',
  'full_name',
  'contact_name',
  'person_name',
  'contact',
  'customer_name',
  'lead_name',
];
const COMPANY_KEYS = [
  'company',
  'company_name',
  'business',
  'business_name',
  'organization',
  'organisation',
  'organization_name',
  'account_name',
];

const firstFilled = (row: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) {
    const v = String(row[k] ?? '').trim();
    if (v) return v;
  }
  return undefined;
};

/**
 * Picks the person's name and business name out of a contact row, accepting
 * the usual spreadsheet headings ("Business Name", "Contact Name", or
 * separate "First Name" / "Last Name" columns).
 */
export function contactIdentity(row: Record<string, unknown>): {
  name?: string;
  company?: string;
} {
  const first = String(row.first_name ?? '').trim();
  const last = String(row.last_name ?? '').trim();
  return {
    name: firstFilled(row, NAME_KEYS) ?? ([first, last].filter(Boolean).join(' ') || undefined),
    company: firstFilled(row, COMPANY_KEYS),
  };
}
