import { describe, expect, it } from 'vitest';
import { DEFAULT_WORKING_HOURS } from '@pv/shared';
import { addDays, fitsRules, slotsForDay, type SlotRules } from '../src/services/calendar';
import { zonedToUtc } from '../src/voice/time';
import { toolsForAgent } from '../src/voice/tools';

const rules: SlotRules = {
  timezone: 'America/New_York',
  workingHours: DEFAULT_WORKING_HOURS,
  durationMin: 30,
  slotStepMin: 30,
  bufferMin: 0,
  minNoticeMin: 60,
  maxDaysAhead: 60,
};
// Monday 2026-11-02 08:00 in New York: well before opening.
const now = zonedToUtc('2026-11-02', '08:00', rules.timezone).getTime();
const at = (date: string, time: string) => zonedToUtc(date, time, rules.timezone);
const iv = (date: string, a: string, b: string) => ({
  start: at(date, a).getTime(),
  end: at(date, b).getTime(),
});

describe('calendar slots', () => {
  it('offers every step inside opening hours', () => {
    const slots = slotsForDay('2026-11-03', rules, [], now);
    expect(slots).toHaveLength(16); // 09:00 to 16:30
    expect(slots[0]).toEqual(at('2026-11-03', '09:00'));
    expect(slots.at(-1)).toEqual(at('2026-11-03', '16:30'));
  });

  it('is closed on days with no hours', () => {
    expect(slotsForDay('2026-11-07', rules, [], now)).toHaveLength(0); // Saturday
  });

  it('skips busy time and respects the buffer', () => {
    const busy = [iv('2026-11-03', '10:00', '11:00')];
    const plain = slotsForDay('2026-11-03', rules, busy, now).map((d) => d.getTime());
    expect(plain).not.toContain(at('2026-11-03', '10:30').getTime());
    expect(plain).toContain(at('2026-11-03', '09:30').getTime());
    expect(plain).toContain(at('2026-11-03', '11:00').getTime());

    const buffered = slotsForDay('2026-11-03', { ...rules, bufferMin: 15 }, busy, now).map((d) =>
      d.getTime(),
    );
    expect(buffered).not.toContain(at('2026-11-03', '09:30').getTime());
    expect(buffered).not.toContain(at('2026-11-03', '11:00').getTime());
    expect(buffered).toContain(at('2026-11-03', '11:30').getTime());
  });

  it('honours minimum notice and the booking horizon', () => {
    const soon = zonedToUtc('2026-11-03', '09:20', rules.timezone).getTime();
    const slots = slotsForDay('2026-11-03', rules, [], soon).map((d) => d.getTime());
    expect(slots[0]).toBe(at('2026-11-03', '10:30').getTime()); // 09:20 + 60 min notice
    expect(fitsRules(at('2027-03-03', '10:00'), 30, rules, [], now).ok).toBe(false);
  });

  it('rejects times outside hours and straddling the close', () => {
    expect(fitsRules(at('2026-11-03', '08:30'), 30, rules, [], now).ok).toBe(false);
    expect(fitsRules(at('2026-11-03', '16:45'), 30, rules, [], now).ok).toBe(false);
    expect(fitsRules(at('2026-11-03', '16:30'), 30, rules, [], now).ok).toBe(true);
  });

  it('supports split days', () => {
    const split = {
      ...rules,
      workingHours: {
        '2': [
          { start: '09:00', end: '12:00' },
          { start: '14:00', end: '16:00' },
        ],
      },
    };
    expect(slotsForDay('2026-11-03', split, [], now)).toHaveLength(10);
  });

  it('steps days across a DST change', () => {
    // US clocks went back on 2026-11-01.
    expect(addDays('2026-10-31', 2, rules.timezone)).toBe('2026-11-02');
    expect(addDays('2026-11-30', 1, rules.timezone)).toBe('2026-12-01');
  });
});

describe('calendar tools for agents', () => {
  it('adds the booking tools together', () => {
    const names = toolsForAgent({
      appointmentBookingEnabled: true,
      transferEnabled: false,
      transferNumber: null,
    }).map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'check_availability',
        'book_appointment',
        'find_my_appointments',
        'reschedule_appointment',
        'cancel_appointment',
      ]),
    );
  });
});
