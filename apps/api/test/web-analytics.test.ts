import { describe, expect, it } from 'vitest';
import { classify, isBot, parseUserAgent } from '../src/services/web-analytics';

const none = { source: null, medium: null, gclid: false };

describe('traffic channel', () => {
  it('names search engines, AI assistants and social networks', () => {
    expect(classify('google.co.uk', none)).toEqual({ channel: 'Organic Search', source: 'Google' });
    expect(classify('bing.com', none)).toEqual({ channel: 'Organic Search', source: 'Bing' });
    expect(classify('chatgpt.com', none)).toEqual({ channel: 'AI Assistants', source: 'ChatGPT' });
    expect(classify('lnkd.in', none)).toEqual({ channel: 'Social', source: 'LinkedIn' });
    expect(classify('t.co', none)).toEqual({ channel: 'Social', source: 'X (Twitter)' });
  });
  it('treats other sites as referrals and no referrer as direct', () => {
    expect(classify('example.org', none)).toEqual({ channel: 'Referral', source: 'example.org' });
    expect(classify(null, none)).toEqual({ channel: 'Direct', source: null });
  });
  it('lets UTM tags and click ids win over the referrer', () => {
    expect(classify('google.com', { source: 'google', medium: 'cpc', gclid: false }).channel).toBe(
      'Paid Search',
    );
    expect(classify(null, { source: null, medium: null, gclid: true })).toEqual({
      channel: 'Paid Search',
      source: 'Google Ads',
    });
    expect(classify(null, { source: 'newsletter', medium: 'email', gclid: false })).toEqual({
      channel: 'Email',
      source: 'newsletter',
    });
  });
});

describe('user agent', () => {
  const iphone =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const windowsEdge =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';
  it('reads device, browser and OS', () => {
    expect(parseUserAgent(iphone)).toEqual({ device: 'Mobile', browser: 'Safari', os: 'iOS' });
    expect(parseUserAgent(windowsEdge)).toEqual({ device: 'Desktop', browser: 'Edge', os: 'Windows' });
  });
  it('skips bots and tools', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(true);
    expect(isBot('curl/8.4.0')).toBe(true);
    expect(isBot(undefined)).toBe(true);
    expect(isBot(iphone)).toBe(false);
  });
});
