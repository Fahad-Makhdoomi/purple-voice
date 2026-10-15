import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { billableMinutes, mergeLimits, withinLimit, PLAN_CATALOG } from '@pv/shared';
import { decrypt, encrypt, encryptJson, decryptJson } from '../src/lib/crypto';
import { hashPassword, verifyPassword } from '../src/lib/password';
import {
  signState,
  signSubject,
  signedCallbackUrl,
  verifyState,
  verifySubject,
} from '../src/lib/signed-url';
import { parseCsv, toE164 } from '../src/lib/csv';
import { signatureHeader } from '../src/jobs/webhooks';
import { verifyWebhook } from '../src/services/stripe';

describe('plans and limits', () => {
  it('treats null as unlimited and 0 as off', () => {
    expect(withinLimit(null, 10_000)).toBe(true);
    expect(withinLimit(0, 0)).toBe(false);
    expect(withinLimit(1, 0)).toBe(true);
    expect(withinLimit(1, 1)).toBe(false);
    expect(withinLimit(100, 90, 10)).toBe(true);
    expect(withinLimit(100, 90, 11)).toBe(false);
  });

  it('applies per-workspace overrides on top of the plan', () => {
    const merged = mergeLimits(PLAN_CATALOG.BASIC.limits, { agents: 3, campaigns: null });
    expect(merged.agents).toBe(3);
    expect(merged.campaigns).toBeNull();
    expect(merged.phoneNumbers).toBe(1);
  });

  it('matches the published Basic and Pro plans', () => {
    expect(PLAN_CATALOG.BASIC.priceMonthlyCents).toBe(1900);
    expect(PLAN_CATALOG.BASIC.includedMinutes).toBe(1000);
    expect(PLAN_CATALOG.BASIC.limits.contactsPerCampaign).toBe(100);
    expect(PLAN_CATALOG.PRO.priceMonthlyCents).toBe(29900);
    expect(PLAN_CATALOG.PRO.includedMinutes).toBe(20000);
    expect(PLAN_CATALOG.PRO.limits.contactsPerCampaign).toBeNull();
    expect(PLAN_CATALOG.PRO.features.webhooks).toBe(true);
    expect(PLAN_CATALOG.BASIC.features.webhooks).toBe(false);
  });

  it('bills each started minute', () => {
    expect(billableMinutes(0)).toBe(0);
    expect(billableMinutes(1)).toBe(1);
    expect(billableMinutes(60)).toBe(1);
    expect(billableMinutes(61)).toBe(2);
  });
});

describe('secrets', () => {
  it('round-trips encrypted values and rejects tampering', () => {
    const ct = encrypt('sk-live-secret');
    expect(ct).not.toContain('sk-live');
    expect(decrypt(ct)).toBe('sk-live-secret');
    const parts = ct.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => decrypt(parts.join('.'))).toThrow();
    expect(decryptJson<{ a: number }>(encryptJson({ a: 1 }))).toEqual({ a: 1 });
  });

  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('correct horse 1');
    expect(hash.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse 1', hash)).toBe(true);
    expect(await verifyPassword('wrong horse 1', hash)).toBe(false);
  });
});

describe('signed callback URLs', () => {
  it('verifies only the matching purpose and subject', () => {
    const sig = signSubject('voice', 'call_1');
    expect(verifySubject('voice', 'call_1', sig)).toBe(true);
    expect(verifySubject('status', 'call_1', sig)).toBe(false);
    expect(verifySubject('voice', 'call_2', sig)).toBe(false);
    expect(verifySubject('voice', 'call_1', undefined)).toBe(false);
  });

  it('builds provider callback URLs carrying the signature', () => {
    const url = new URL(signedCallbackUrl('TWILIO', 'status', 'callId', 'abc'));
    expect(url.pathname).toBe('/api/telephony/twilio/status');
    expect(verifySubject('status', 'abc', url.searchParams.get('sig'))).toBe(true);
  });

  it('expires and protects OAuth state', () => {
    const state = signState({ workspaceId: 'w1' });
    expect(verifyState<{ workspaceId: string }>(state)?.workspaceId).toBe('w1');
    expect(verifyState(state.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')))).toBeNull();
    expect(verifyState(signState({ workspaceId: 'w1' }, -1))).toBeNull();
  });
});

describe('contact import', () => {
  it('parses quoted CSV with extra columns', () => {
    const rows = parseCsv(
      'Phone,Name,Deal Size\n"+1 (415) 555-0123","Lee, Sam",5000\r\n4155550199,Ana,\n',
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ phone: '+1 (415) 555-0123', name: 'Lee, Sam', deal_size: '5000' });
  });

  it('normalises phone numbers to E.164', () => {
    expect(toE164('+1 (415) 555-0123')).toBe('+14155550123');
    expect(toE164('4155550123')).toBe('+14155550123');
    expect(toE164('0044 20 7946 0958')).toBe('+442079460958');
    expect(toE164('12')).toBeNull();
    expect(toE164('')).toBeNull();
  });
});

describe('webhook signatures', () => {
  it('signs outgoing webhooks receivers can verify', () => {
    const body = JSON.stringify({ hello: 'world' });
    const header = signatureHeader('whsec_test', body, 1700000000);
    const expected = crypto
      .createHmac('sha256', 'whsec_test')
      .update(`1700000000.${body}`)
      .digest('hex');
    expect(header).toBe(`t=1700000000,v1=${expected}`);
  });

  it('accepts correctly signed Stripe webhooks and rejects the rest', () => {
    const body = Buffer.from(
      JSON.stringify({ id: 'evt_1', type: 'invoice.paid', data: { object: {} } }),
    );
    const t = Math.floor(Date.now() / 1000);
    const sig = crypto
      .createHmac('sha256', 'whsec_stripe')
      .update(`${t}.${body.toString()}`)
      .digest('hex');
    expect(verifyWebhook(body, `t=${t},v1=${sig}`).id).toBe('evt_1');
    expect(() => verifyWebhook(body, undefined)).toThrow();
    expect(() => verifyWebhook(body, `t=${t},v1=${'0'.repeat(64)}`)).toThrow();
    expect(() => verifyWebhook(body, `t=${t - 3600},v1=${sig}`)).toThrow();
  });
});
