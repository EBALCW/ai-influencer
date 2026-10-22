import { describe, expect, it } from 'vitest';
import { axisTicks, polylinePoints, sqrtPosition } from './chart';

describe('chart', () => {
  it('karekök ölçek: 1 sa / 4 sa = yarı yol, sınırlar korunur', () => {
    expect(sqrtPosition(1, 4)).toBe(0.5);
    expect(sqrtPosition(0, 4)).toBe(0);
    expect(sqrtPosition(9, 4)).toBe(1);
    expect(sqrtPosition(5, 0)).toBe(0);
  });
  it('eksen işaretleri veri aralığıyla sınırlı, en az ilk işaret kalır', () => {
    expect(axisTicks(30, [1, 5, 24, 72, 168])).toEqual([1, 5, 24]);
    expect(axisTicks(0.5, [1, 5, 24])).toEqual([1]);
  });
  it('noktaları saate göre sıralar ve kutuya yerleştirir', () => {
    expect(
      polylinePoints(
        [
          { hours: 4, views: 100 },
          { hours: 1, views: 50 },
        ],
        4,
        100,
        [0, 0, 100, 100],
      ),
    ).toBe('50.0,50.0 100.0,0.0');
  });
});
