import { describe, expect, it } from 'vitest';
import { utcToZoned, zonedToUtc } from '../src/voice/time';
import { fillVariables } from '../src/voice/prompt';
import { toolsForAgent, TOOL_SCHEMAS } from '../src/voice/tools';
import { withinCallWindow } from '../src/jobs/dialer';
import { mulawDurationMs } from '../src/voice/transports';
import { escapeXml } from '../src/telephony/types';
import { TwilioAdapter } from '../src/telephony/twilio';
import { PlivoAdapter } from '../src/telephony/plivo';

describe('time zones', () => {
  it('converts wall-clock time to UTC across DST', () => {
    expect(zonedToUtc('2026-01-15', '09:00', 'America/New_York').toISOString()).toBe(
      '2026-01-15T14:00:00.000Z',
    );
    expect(zonedToUtc('2026-07-15', '09:00', 'America/New_York').toISOString()).toBe(
      '2026-07-15T13:00:00.000Z',
    );
    expect(zonedToUtc('2026-07-15', '09:00', 'Asia/Kolkata').toISOString()).toBe(
      '2026-07-15T03:30:00.000Z',
    );
  });

  it('round-trips UTC to wall-clock', () => {
    const z = utcToZoned(new Date('2026-07-15T13:00:00Z'), 'America/New_York');
    expect(z).toEqual({ date: '2026-07-15', time: '09:00', weekday: 3 });
  });
});

describe('campaign call window', () => {
  const campaign = {
    timezone: 'America/New_York',
    callDays: [1, 2, 3, 4, 5],
    callWindowStart: '09:00',
    callWindowEnd: '18:00',
  };
  it('dials only inside days and hours, in the campaign time zone', () => {
    expect(withinCallWindow(campaign, new Date('2026-07-15T14:00:00Z'))).toBe(true); // Wed 10:00 NY
    expect(withinCallWindow(campaign, new Date('2026-07-15T12:00:00Z'))).toBe(false); // Wed 08:00 NY
    expect(withinCallWindow(campaign, new Date('2026-07-15T22:00:00Z'))).toBe(false); // Wed 18:00 NY
    expect(withinCallWindow(campaign, new Date('2026-07-18T14:00:00Z'))).toBe(false); // Saturday
  });
});

describe('agent prompt and tools', () => {
  it('fills contact variables and blanks unknown ones', () => {
    expect(
      fillVariables('Hi {{first_name}} from {{ company }}{{missing}}!', {
        first_name: 'Sam',
        company: 'Acme',
      }),
    ).toBe('Hi Sam from Acme!');
  });

  it('offers only the tools an agent has enabled', () => {
    const base = { appointmentBookingEnabled: false, transferEnabled: false, transferNumber: null };
    expect(toolsForAgent(base).map((t) => t.name)).toEqual(['end_call']);
    expect(toolsForAgent({ ...base, transferEnabled: true }).map((t) => t.name)).toEqual([
      'end_call',
    ]);
    expect(
      toolsForAgent({
        appointmentBookingEnabled: true,
        transferEnabled: true,
        transferNumber: '+14155550100',
      }).map((t) => t.name),
    ).toEqual(['check_availability', 'book_appointment', 'transfer_call', 'end_call']);
  });

  it('validates tool input regardless of vendor', () => {
    expect(
      TOOL_SCHEMAS.book_appointment.safeParse({ start: '2026-07-15T10:00', name: 'Sam' }).success,
    ).toBe(true);
    expect(
      TOOL_SCHEMAS.book_appointment.safeParse({ start: 'tomorrow at ten', name: 'Sam' }).success,
    ).toBe(false);
    expect(TOOL_SCHEMAS.check_availability.safeParse({ date: '2026-07-15' }).success).toBe(true);
  });
});

describe('telephony documents', () => {
  it('escapes XML and connects media streams', () => {
    expect(escapeXml(`<a href="x">&'`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&apos;');
    const twilio = new TwilioAdapter({
      accountSid: 'AC' + '0'.repeat(32),
      authToken: 't'.repeat(32),
    });
    expect(twilio.streamDocument('wss://x/ws/twilio/c/s').body).toContain(
      '<Connect><Stream url="wss://x/ws/twilio/c/s"/>',
    );
    const plivo = new PlivoAdapter({ authId: 'MA1234567890', authToken: 't'.repeat(32) });
    const doc = plivo.streamDocument('wss://x/ws/plivo/c/s');
    expect(doc.body).toContain('bidirectional="true"');
    expect(doc.body).toContain('audio/x-mulaw;rate=8000');
    expect(plivo.transferDocument('+14155550100').body).toContain('<Number>14155550100</Number>');
  });

  it('measures μ-law audio duration', () => {
    expect(mulawDurationMs(Buffer.alloc(160).toString('base64'))).toBe(20);
    expect(mulawDurationMs(Buffer.alloc(8000).toString('base64'))).toBe(1000);
  });
});

describe('single-brace variables', () => {
  it('fills {name} too, and tidies a missing one', () => {
    expect(fillVariables('Hello {name}, ek second?', { name: 'Ravi' })).toBe(
      'Hello Ravi, ek second?',
    );
    expect(fillVariables('Hello {name}, ek second?', {})).toBe('Hello, ek second?');
  });
});
