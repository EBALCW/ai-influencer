import { describe, expect, it } from 'vitest';
import {
  addDays,
  formatSigned,
  isEmptySummary,
  isIsoDate,
  lastCompletedWeekStart,
  localDate,
  parseReportSummary,
  periodToUtcRange,
  resolvePeriod,
  shiftPeriod,
  weekStart,
  zonedMidnightUtc,
} from './weekly';

const emptySummary = {
  version: 1,
  timezone: 'Europe/Istanbul',
  periodStart: '2026-09-07',
  periodEnd: '2026-09-13',
  currency: 'USD',
  followers: {
    accounts: 0,
    accountsWithBaseline: 0,
    start: null,
    end: null,
    delta: null,
  },
  postsPublished: 0,
  views: 0,
  engagement: 0,
  engagementRate: null,
  postsWithoutBaseline: 0,
  cost: { entryCount: 0, missingRateCount: 0, total: 0, perVideo: null },
  topPosts: [],
  bottomPosts: [],
  nextPeriod: { scheduledCount: 0, items: [] },
};

describe('hafta sınırları (Europe/Istanbul)', () => {
  it('pazar 23:30 Türkiye o haftaya, pazartesi 00:30 sonraki haftaya düşer', () => {
    // 2026-09-13 pazar 23:30 TR = 20:30 UTC
    expect(weekStart(localDate(new Date('2026-09-13T20:30:00Z')))).toBe(
      '2026-09-07',
    );
    // 2026-09-14 pazartesi 00:30 TR = pazar 21:30 UTC
    expect(weekStart(localDate(new Date('2026-09-13T21:30:00Z')))).toBe(
      '2026-09-14',
    );
  });

  it('haftanın her günü aynı pazartesiye gider', () => {
    for (let i = 0; i < 7; i += 1)
      expect(weekStart(addDays('2026-09-07', i))).toBe('2026-09-07');
    expect(weekStart('2026-01-01')).toBe('2025-12-29'); // yıl sınırı
  });

  it('yerel gün aralığı UTC anına çevrilir (TR = UTC+3)', () => {
    expect(periodToUtcRange('2026-09-07', '2026-09-13')).toEqual({
      start: '2026-09-06T21:00:00.000Z',
      end: '2026-09-13T21:00:00.000Z',
    });
  });

  it('yaz saati olan dilimde de gece yarısı doğru hesaplanır', () => {
    // Berlin: 29 Mart 2026'da UTC+1 → UTC+2
    expect(zonedMidnightUtc('2026-03-29', 'Europe/Berlin').toISOString()).toBe(
      '2026-03-28T23:00:00.000Z',
    );
    expect(zonedMidnightUtc('2026-03-30', 'Europe/Berlin').toISOString()).toBe(
      '2026-03-29T22:00:00.000Z',
    );
  });

  it('otomatik rapor dönemi: biten son hafta', () => {
    // Pazartesi 09:00 TR (06:00 UTC) → bir önceki hafta
    expect(lastCompletedWeekStart(new Date('2026-09-14T06:00:00Z'))).toBe(
      '2026-09-07',
    );
    // Pazar gecesi henüz bitmemiş hafta değil, ondan önceki
    expect(lastCompletedWeekStart(new Date('2026-09-13T20:00:00Z'))).toBe(
      '2026-08-31',
    );
  });
});

describe('resolvePeriod', () => {
  const now = new Date('2026-10-22T10:00:00Z');

  it('varsayılan: içinde bulunulan hafta', () => {
    expect(resolvePeriod({}, now)).toEqual({
      kind: 'week',
      from: '2026-10-19',
      to: '2026-10-25',
    });
  });

  it('tarih verilirse o günün haftası', () => {
    expect(resolvePeriod({ date: '2026-09-10' }, now)).toEqual({
      kind: 'week',
      from: '2026-09-07',
      to: '2026-09-13',
    });
  });

  it('ay dönemi, artık yıl dahil', () => {
    expect(resolvePeriod({ period: 'month', date: '2028-02-10' }, now)).toEqual(
      { kind: 'month', from: '2028-02-01', to: '2028-02-29' },
    );
  });

  it('geçersiz tarih ve dönem bu haftaya düşer', () => {
    expect(
      resolvePeriod({ period: 'year', date: '2026-02-30' }, now).from,
    ).toBe('2026-10-19');
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-02-28')).toBe(true);
  });

  it('önceki/sonraki dönem', () => {
    const week = resolvePeriod({ date: '2026-09-10' }, now);
    expect(shiftPeriod(week, -1)).toBe('2026-08-31');
    expect(shiftPeriod(week, 1)).toBe('2026-09-14');
    const month = resolvePeriod({ period: 'month', date: '2026-01-15' }, now);
    expect(shiftPeriod(month, -1)).toBe('2025-12-01');
  });
});

describe('parseReportSummary', () => {
  it('boş hafta özetini kabul eder ve boş olarak işaretler', () => {
    const summary = parseReportSummary(emptySummary);
    expect(summary).not.toBeNull();
    expect(isEmptySummary(summary!)).toBe(true);
  });

  it('veri olan hafta boş sayılmaz', () => {
    const summary = parseReportSummary({
      ...emptySummary,
      postsPublished: 2,
      views: 1800,
    });
    expect(isEmptySummary(summary!)).toBe(false);
  });

  it('tanınmayan biçimde null döner (uydurma değer üretilmez)', () => {
    expect(parseReportSummary(null)).toBeNull();
    expect(parseReportSummary({ ...emptySummary, version: 2 })).toBeNull();
    expect(parseReportSummary({ views: 10 })).toBeNull();
  });

  it('işaretli değişim', () => {
    expect(formatSigned(150)).toBe('+150');
    expect(formatSigned(-1200)).toBe('−1.200');
    expect(formatSigned(null)).toBe('—');
  });
});
