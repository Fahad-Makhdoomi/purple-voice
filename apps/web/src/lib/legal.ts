import type { LegalSettings, SeoSettings } from '@pv/shared';
import { siteUrl } from '@/lib/config';

/**
 * Fills the {{placeholders}} the legal pages are written with
 * (apps/api/prisma/legal-pages.ts) from Admin → Site settings → Legal
 * details. A line whose placeholders are all empty is dropped, so an
 * unset VAT number or representative simply doesn't appear.
 */
export function fillLegal(body: string, legal: LegalSettings, seo: SeoSettings): string {
  const privacyEmail = legal.privacyEmail || seo.contactEmail;
  const dpo = [legal.dpoName, legal.dpoEmail].filter(Boolean).join(', ');
  const values: Record<string, string> = {
    company_name: legal.companyName || seo.siteName,
    company_address: legal.address,
    company_country: legal.country,
    registration_number: legal.registrationNumber,
    vat_number: legal.vatNumber,
    ico_number: legal.icoNumber,
    privacy_email: privacyEmail,
    contact_email: seo.contactEmail,
    dpo,
    eu_representative: legal.euRepresentative,
    uk_representative: legal.ukRepresentative,
    governing_law: legal.governingLaw || 'England and Wales',
    effective_date: legal.effectiveDate,
    hosting_provider: legal.hostingProvider,
    hosting_region: legal.hostingRegion || 'See our hosting provider',
    site_name: seo.siteName,
    site_url: siteUrl.replace(/^https?:\/\//, ''),
  };
  return body
    .split('\n')
    .filter((line) => {
      const keys = [...line.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]!);
      return !keys.length || keys.some((k) => values[k]);
    })
    .map((line) =>
      line
        .replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, k: string) => values[k] ?? '')
        // "Address: , United Kingdom" → "Address: United Kingdom"
        .replace(/:\s*,\s*/g, ': ')
        .replace(/,\s*,/g, ',')
        .replace(/,\s*\./g, '.'),
    )
    .join('\n');
}
