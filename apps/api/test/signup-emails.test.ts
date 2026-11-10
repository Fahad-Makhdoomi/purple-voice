import { describe, expect, it } from 'vitest';
import { emailDomain, isDisposableDomain } from '../src/services/email-guard';
import { escapeHtml, renderEmail } from '../src/services/email-templates';
import {
  STEPS,
  isStepKey,
  unsubscribeSig,
  unsubscribeUrl,
  verificationEmail,
  verifyUnsubscribe,
} from '../src/services/lifecycle-emails';
import { plivoSignatureV2, plivoSignatureV3 } from '../src/telephony/carrier-signature';

describe('disposable email domains', () => {
  it('blocks known throwaway domains and their subdomains', () => {
    expect(isDisposableDomain('mailinator.com')).toBe(true);
    expect(isDisposableDomain('guerrillamail.com')).toBe(true);
    expect(isDisposableDomain('inbox.mailinator.com')).toBe(true);
    expect(isDisposableDomain('10minutemail.com')).toBe(true);
  });

  it('lets ordinary providers and company domains through', () => {
    for (const d of ['gmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'purplerocket.co'])
      expect(isDisposableDomain(d)).toBe(false);
  });

  it('applies the admin list too', () => {
    expect(isDisposableDomain('spam.example.com', ['example.com'])).toBe(true);
    expect(isDisposableDomain('example.org', ['example.com'])).toBe(false);
  });

  it('reads the domain from an address', () => {
    expect(emailDomain('Someone@Mailinator.COM')).toBe('mailinator.com');
  });
});

describe('email templates', () => {
  it('escapes names and text', () => {
    expect(escapeHtml('<b>"x"</b>&\'')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt;&amp;&#39;');
    const r = renderEmail(verificationEmail('<script>alert(1)</script>', 'https://a.test/v?t=1&x=2'));
    expect(r.html).not.toContain('<script>alert(1)</script>');
    expect(r.html).toContain('https://a.test/v?t=1&amp;x=2');
    expect(r.text).toContain('https://a.test/v?t=1&x=2');
  });

  it('puts the unsubscribe link only where given', () => {
    const plain = renderEmail({ preheader: 'p', heading: 'h', paragraphs: ['a'] });
    expect(plain.html).not.toContain('Unsubscribe');
    const marketing = renderEmail({
      preheader: 'p',
      heading: 'h',
      paragraphs: ['a'],
      unsubscribeUrl: 'https://a.test/u',
    });
    expect(marketing.html).toContain('https://a.test/u');
    expect(marketing.text).toContain('Unsubscribe');
  });
});

describe('lifecycle sequence', () => {
  it('starts with the welcome and is in order', () => {
    expect(STEPS[0].key).toBe('welcome');
    const days = STEPS.map((s) => s.delayDays);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
    expect(isStepKey('pro-offer')).toBe(true);
    expect(isStepKey('nope')).toBe(false);
  });

  it('signs unsubscribe links per user', () => {
    const sig = unsubscribeSig('user_1');
    expect(verifyUnsubscribe('user_1', sig)).toBe(true);
    expect(verifyUnsubscribe('user_2', sig)).toBe(false);
    expect(verifyUnsubscribe('user_1', 'x'.repeat(32))).toBe(false);
    expect(unsubscribeUrl('user_1')).toContain(`s=${sig}`);
  });
});

describe('Plivo signatures', () => {
  it('V2 ignores the query string and depends on the nonce', () => {
    const a = plivoSignatureV2('token', 'https://x.test/api/p?callId=1&sig=2', 'n1');
    expect(a).toBe(plivoSignatureV2('token', 'https://x.test/api/p', 'n1'));
    expect(a).not.toBe(plivoSignatureV2('token', 'https://x.test/api/p', 'n2'));
  });

  it('V3 covers the POST fields', () => {
    const url = 'https://x.test/api/p?callId=1';
    const a = plivoSignatureV3('token', url, 'n', 'POST', { CallUUID: 'u', From: '1' });
    expect(a).toBe(plivoSignatureV3('token', url, 'n', 'POST', { From: '1', CallUUID: 'u' }));
    expect(a).not.toBe(plivoSignatureV3('token', url, 'n', 'POST', { CallUUID: 'v', From: '1' }));
  });
});
