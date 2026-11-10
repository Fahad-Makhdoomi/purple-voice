import { describe, expect, it } from 'vitest';
import { isPrivateIp } from '../src/lib/ssrf';
import { twilioSignature } from '../src/telephony/carrier-signature';
import { keepAllowedLinks } from '../src/voice/session';

describe('SSRF guard: private addresses', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.20.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    '::',
    'fd00::1',
    'fe80::1',
    'fec0::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1', // the hex form new URL() produces for [::ffff:127.0.0.1]
    '::ffff:a9fe:a9fe', // 169.254.169.254
    '0:0:0:0:0:ffff:a9fe:a9fe',
    '64:ff9b::a9fe:a9fe', // NAT64
    'not-an-ip',
  ])('blocks %s', (ip) => expect(isPrivateIp(ip)).toBe(true));

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '::ffff:8.8.8.8'])(
    'allows %s',
    (ip) => expect(isPrivateIp(ip)).toBe(false),
  );

  it('blocks the host new URL() gives for an IPv4-mapped literal', () => {
    const host = new URL('https://[::ffff:169.254.169.254]/').hostname.replace(/^\[|\]$/g, '');
    expect(isPrivateIp(host)).toBe(true);
  });
});

describe('Twilio request signature', () => {
  it('matches the example in Twilio’s security docs', () => {
    expect(
      twilioSignature('12345', 'https://mycompany.com/myapp.php?foo=1&bar=2', {
        CallSid: 'CA1234567890ABCDE',
        Caller: '+12349013030',
        Digits: '1234',
        From: '+12349013030',
        To: '+18005551212',
      }),
    ).toBe('0/KCTR6DLpKmkAf8muzZqo1nDgQ=');
  });
});

describe('agent message links', () => {
  const shareInfo = 'Brochure: https://www.acme.com/brochure.pdf and our booking page acme.com';
  it('keeps links to hosts the business listed', () => {
    expect(keepAllowedLinks('See https://acme.com/pricing.', shareInfo)).toBe(
      'See https://acme.com/pricing.',
    );
  });
  it('removes any other link', () => {
    expect(keepAllowedLinks('Log in at https://acme-secure-login.evil/x now', shareInfo)).toBe(
      'Log in at [link removed] now',
    );
    expect(keepAllowedLinks('www.evil.com', '')).toBe('[link removed]');
  });
});
