import { env } from '../config/env';

/**
 * The branded HTML shell for the platform's own emails (verification,
 * welcome, onboarding and upgrade). Table layout with inline styles, because
 * that is what Gmail, Outlook and Apple Mail all render the same; a plain-text
 * part always goes alongside.
 */

const BRAND = '#6236F0';
const BRAND_DARK = '#260E78';
const INK = '#15131F';
const MUTED = '#5B5770';
const LINE = '#E9E6F2';
const BG = '#F5F3FB';

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface EmailContent {
  /** Shown after the subject in the inbox list. */
  preheader: string;
  /** Small label above the heading, e.g. "Welcome". */
  eyebrow?: string;
  heading: string;
  /** Paragraphs of plain text (escaped here). */
  paragraphs: string[];
  /** Ticked list under the paragraphs. */
  bullets?: string[];
  /** A highlighted box, e.g. an offer code. */
  callout?: { title: string; text: string };
  cta?: { label: string; url: string };
  /** Text after the button. */
  after?: string[];
  /** Unsubscribe link for onboarding and upgrade emails; account emails have none. */
  unsubscribeUrl?: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
}

const p = (text: string) =>
  `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${MUTED};">${escapeHtml(text)}</p>`;

export function renderEmail(c: EmailContent): RenderedEmail {
  const site = env.appUrl;
  const host = new URL(site).host;
  const bullets = c.bullets?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;">${c.bullets
        .map(
          (b) =>
            `<tr><td valign="top" style="padding:0 12px 10px 0;"><span style="display:inline-block;width:20px;height:20px;border-radius:10px;background:#EEE9FE;color:${BRAND};font-size:13px;line-height:20px;text-align:center;font-weight:700;">&#10003;</span></td><td style="padding:0 0 10px;font-size:15px;line-height:1.55;color:${INK};">${escapeHtml(b)}</td></tr>`,
        )
        .join('')}</table>`
    : '';
  const callout = c.callout
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 24px;"><tr><td style="background:#F3EFFF;border:1px solid #DCD2FD;border-radius:14px;padding:18px 20px;"><div style="font-size:13px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${BRAND};">${escapeHtml(c.callout.title)}</div><div style="margin-top:6px;font-size:16px;line-height:1.5;color:${INK};">${escapeHtml(c.callout.text)}</div></td></tr></table>`
    : '';
  const cta = c.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="border-radius:999px;background:${BRAND};background-image:linear-gradient(135deg,#7C58F8,${BRAND} 60%,#4C1DD8);"><a href="${escapeHtml(c.cta.url)}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(c.cta.label)} &rarr;</a></td></tr></table><p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:#8A86A0;">Button not working? Paste this into your browser:<br><a href="${escapeHtml(c.cta.url)}" style="color:${BRAND};word-break:break-all;">${escapeHtml(c.cta.url)}</a></p>`
    : '';
  const footerLinks = c.unsubscribeUrl
    ? `You're getting this because you created a Purple Voice account. <a href="${escapeHtml(c.unsubscribeUrl)}" style="color:#8A86A0;">Unsubscribe from tips and offers</a>.`
    : `You're getting this because of activity on your Purple Voice account.`;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(c.heading)}</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(c.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="padding:0 4px 20px;"><a href="${site}" style="text-decoration:none;"><img src="${site}/email/mark.png" width="36" height="36" alt="" style="vertical-align:middle;border:0;"><span style="vertical-align:middle;margin-left:10px;font-size:18px;font-weight:700;letter-spacing:-.01em;color:${INK};">Purple Voice</span></a></td></tr>
<tr><td style="background:#ffffff;border:1px solid ${LINE};border-radius:20px;overflow:hidden;">
<div style="height:6px;background:${BRAND};background-image:linear-gradient(90deg,#9C80FA,${BRAND},${BRAND_DARK});"></div>
<div style="padding:36px 36px 16px;">
${c.eyebrow ? `<div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${BRAND};margin-bottom:10px;">${escapeHtml(c.eyebrow)}</div>` : ''}
<h1 style="margin:0 0 18px;font-size:28px;line-height:1.2;letter-spacing:-.02em;font-weight:700;color:${INK};">${escapeHtml(c.heading)}</h1>
${c.paragraphs.map(p).join('')}
${bullets}${callout}${cta}
${(c.after ?? []).map(p).join('')}
<p style="margin:8px 0 20px;font-size:16px;line-height:1.6;color:${MUTED};">The Purple Voice team</p>
</div></td></tr>
<tr><td style="padding:22px 8px 0;text-align:center;font-size:12px;line-height:1.6;color:#8A86A0;">
Questions? Just reply, or write to <a href="mailto:${env.MAIL_REPLY_TO}" style="color:#8A86A0;">${env.MAIL_REPLY_TO}</a>.<br>
${footerLinks}<br>
<a href="${site}" style="color:#8A86A0;">${host}</a> · Purple Rocket
</td></tr>
</table></td></tr></table></body></html>`;

  const text = [
    c.heading,
    '',
    ...c.paragraphs.flatMap((x) => [x, '']),
    ...(c.bullets ?? []).map((b) => `- ${b}`),
    ...(c.bullets?.length ? [''] : []),
    ...(c.callout ? [`${c.callout.title}: ${c.callout.text}`, ''] : []),
    ...(c.cta ? [`${c.cta.label}: ${c.cta.url}`, ''] : []),
    ...(c.after ?? []).flatMap((x) => [x, '']),
    'The Purple Voice team',
    '',
    `Questions? Reply, or write to ${env.MAIL_REPLY_TO}.`,
    ...(c.unsubscribeUrl ? [`Unsubscribe from tips and offers: ${c.unsubscribeUrl}`] : []),
  ].join('\n');

  return { html, text };
}
