import { describe, expect, it } from 'vitest';
import { parseMonth, shiftMonth } from './period';

describe('parseMonth', () => {
  it('ay sınırlarını tarih metni olarak üretir', () => {
    expect(parseMonth('2026-02', '2026-10-22')).toEqual({
      month: '2026-02',
      from: '2026-02-01',
      to: '2026-02-28',
    });
    expect(parseMonth('2028-02', '2026-10-22').to).toBe('2028-02-29');
    expect(parseMonth('2026-12', '2026-10-22').to).toBe('2026-12-31');
  });

  it('geçersiz değerde bugünün ayına düşer', () => {
    expect(parseMonth('2026-13', '2026-10-22').month).toBe('2026-10');
    expect(parseMonth(undefined, '2026-10-22').month).toBe('2026-10');
    expect(parseMonth('x', '2026-10-22').month).toBe('2026-10');
  });
});

describe('shiftMonth', () => {
  it('yıl sınırını geçer', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });
});
