import { describe, expect, it } from 'vitest';
import {
  calendarRange,
  dailyWarning,
  gapWarning,
  localInput,
  localToIso,
  scheduleWarnings,
} from './schedule-rules';

describe('hesap bazlı yayın saatleri', () => {
  const current = {
    id: 'current',
    accountId: 'a',
    at: '2026-11-02T00:00:00Z',
    timezone: 'Europe/Istanbul',
  };
  it('tam beş saate izin verir, 4s59dk için gün sınırı aşılırken de uyarır', () => {
    expect(
      scheduleWarnings(current, [
        { id: 'other', accountId: 'a', at: '2026-11-01T19:00:00Z' },
      ]),
    ).toEqual([]);
    expect(
      scheduleWarnings(current, [
        { id: 'other', accountId: 'a', at: '2026-11-01T19:01:00Z' },
      ]),
    ).toEqual([gapWarning]);
    expect(
      scheduleWarnings(current, [
        { id: 'other', accountId: 'b', at: current.at },
      ]),
    ).toEqual([]);
  });
  it('günlük dört sınırını hedef saat diliminde sayar, kendini iki kez saymaz', () => {
    const others = ['21:00', '22:00', '23:00', '23:30'].map((time, index) => ({
      id: String(index),
      accountId: 'a',
      at: `2026-11-01T${time}:00Z`,
    }));
    expect(scheduleWarnings(current, [...others, current])).toEqual([
      gapWarning,
      dailyWarning,
    ]);
    expect(
      scheduleWarnings({ ...current, timezone: 'UTC' }, others),
    ).not.toContain(dailyWarning);
  });
  it('tarayıcının yerel saatini kullanmadan IANA dönüşümü yapar', () => {
    expect(localToIso('2026-11-02T12:00', 'Europe/Istanbul')).toBe(
      '2026-11-02T09:00:00.000Z',
    );
    expect(localInput('2026-11-02T09:00:00Z', 'Europe/Istanbul')).toBe(
      '2026-11-02T12:00',
    );
    expect(() => localToIso('2026-02-31T12:00', 'UTC')).toThrow();
    expect(() => localToIso('2026-11-02T12:00', 'Unknown/Zone')).toThrow();
  });
  it('DST boşluğunu reddeder ve tekrarlanan saatin ilk anını seçer', () => {
    expect(() => localToIso('2026-03-08T02:30', 'America/New_York')).toThrow(
      'mevcut değil',
    );
    expect(localToIso('2026-11-01T01:30', 'America/New_York')).toBe(
      '2026-11-01T05:30:00.000Z',
    );
    expect(localToIso('2026-04-05T01:45', 'Australia/Lord_Howe')).toBe(
      '2026-04-04T14:45:00.000Z',
    );
  });
  it('hafta/ay sınırları pazartesiden başlar ve DST haftası 169 saattir', () => {
    const week = calendarRange('2026-11-01', 'week', 'America/New_York');
    expect(week.days[0]).toBe('2026-10-26');
    expect(week.days).toHaveLength(7);
    expect((Date.parse(week.to) - Date.parse(week.from)) / 3600000).toBe(169);
    const month = calendarRange('2026-11-20', 'month', 'Europe/Istanbul');
    expect(month.days).toHaveLength(42);
    expect(month.previous).toBe('2026-10-01');
    expect(month.next).toBe('2026-12-01');
  });
});
