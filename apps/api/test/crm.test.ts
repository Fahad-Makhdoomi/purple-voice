import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { crmToCampaignSchema, shouldAdvance, stageKeyForOutcome } from '@pv/shared';
import { nextCallOpening } from '../src/services/crm';
import {
  metaSignatureOk,
  parseMetaWebhook,
  parseTwilioWhatsapp,
  twilioSignature,
} from '../src/modules/hooks';

describe('CRM pipeline rules', () => {
  it('maps a call to the stage it earns', () => {
    expect(stageKeyForOutcome('APPOINTMENT_BOOKED', false, true)).toBe('appointment');
    expect(stageKeyForOutcome('INTERESTED', true, true)).toBe('appointment');
    expect(stageKeyForOutcome('INTERESTED', false, true)).toBe('interested');
    expect(stageKeyForOutcome('CALLBACK_REQUESTED', false, true)).toBe('interested');
    expect(stageKeyForOutcome('NOT_INTERESTED', false, true)).toBe('contacted');
    expect(stageKeyForOutcome(null, false, false)).toBeNull();
  });

  it('only moves leads forward through open stages', () => {
    const open = (position: number) => ({ kind: 'OPEN' as const, position });
    expect(shouldAdvance(open(0), open(2))).toBe(true);
    expect(shouldAdvance(open(3), open(2))).toBe(false);
    expect(shouldAdvance(open(2), open(2))).toBe(false);
    expect(shouldAdvance({ kind: 'WON', position: 4 }, open(5))).toBe(false);
    expect(shouldAdvance(open(1), { kind: 'LOST', position: 5 })).toBe(false);
  });

  it('needs leads or a stage, and one campaign target', () => {
    expect(crmToCampaignSchema.safeParse({ leadIds: ['a'], campaignId: 'c' }).success).toBe(true);
    expect(crmToCampaignSchema.safeParse({ campaignId: 'c' }).success).toBe(false);
    expect(
      crmToCampaignSchema.safeParse({
        stageId: 's',
        campaignId: 'c',
        newCampaign: { name: 'Leads', agentId: 'a', phoneNumberId: 'n' },
      }).success,
    ).toBe(false);
  });
});

describe('new-lead calling hours', () => {
  const at = (iso: string) => new Date(iso);

  it('calls now with no hours, or inside them', () => {
    const now = at('2026-10-22T12:00:00Z');
    expect(nextCallOpening(null, null, 'UTC', now)).toEqual(now);
    expect(nextCallOpening('09:00', '18:00', 'UTC', now)).toEqual(now);
  });

  it('waits for the hours to open, today or tomorrow, in the workspace zone', () => {
    expect(nextCallOpening('09:00', '18:00', 'UTC', at('2026-10-22T06:30:00Z'))).toEqual(
      at('2026-10-22T09:00:00Z'),
    );
    expect(nextCallOpening('09:00', '18:00', 'UTC', at('2026-10-22T19:00:00Z'))).toEqual(
      at('2026-10-23T09:00:00Z'),
    );
    // 20:00 in Kolkata (UTC+5:30) is after hours: next morning at 09:00 IST = 03:30 UTC.
    expect(nextCallOpening('09:00', '18:00', 'Asia/Kolkata', at('2026-10-22T14:30:00Z'))).toEqual(
      at('2026-10-23T03:30:00Z'),
    );
  });
});

describe('WhatsApp webhooks', () => {
  const meta = {
    object: 'whatsapp_business_account',
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: '1111' },
              contacts: [{ wa_id: '14155550123', profile: { name: 'Dana Fox' } }],
              messages: [{ from: '14155550123', type: 'text', text: { body: 'Hi, price?' } }],
            },
          },
        ],
      },
    ],
  };

  it('reads Meta messages for our number only', () => {
    expect(parseMetaWebhook(meta, '1111')).toEqual([
      { from: '+14155550123', name: 'Dana Fox', text: 'Hi, price?' },
    ]);
    expect(parseMetaWebhook(meta, '2222')).toEqual([]);
    // Delivery receipts carry no messages.
    expect(parseMetaWebhook({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] })).toEqual([]);
  });

  it('checks the Meta signature over the raw body', () => {
    const raw = Buffer.from(JSON.stringify(meta));
    const sig = `sha256=${crypto.createHmac('sha256', 'app-secret').update(raw).digest('hex')}`;
    expect(metaSignatureOk('app-secret', raw, sig)).toBe(true);
    expect(metaSignatureOk('other-secret', raw, sig)).toBe(false);
    expect(metaSignatureOk('app-secret', raw, undefined)).toBe(false);
  });

  it('reads Twilio messages and checks their signature', () => {
    const fields = {
      From: 'whatsapp:+14155550123',
      To: 'whatsapp:+14155238886',
      Body: 'Call me',
      ProfileName: 'Dana',
    };
    expect(parseTwilioWhatsapp(fields)).toEqual({
      from: '+14155550123',
      name: 'Dana',
      text: 'Call me',
    });
    expect(parseTwilioWhatsapp({ From: '+14155550123' })).toBeNull();
    // Twilio's documented algorithm: URL, then each field name and value in name order.
    const url = 'https://api.example.com/api/hooks/whatsapp/token';
    const expected = crypto
      .createHmac('sha1', 'auth-token')
      .update(`${url}Bodycall meFromwhatsapp:+1ProfileNameD`)
      .digest('base64');
    expect(
      twilioSignature('auth-token', url, {
        ProfileName: 'D',
        From: 'whatsapp:+1',
        Body: 'call me',
      }),
    ).toBe(expected);
  });
});
