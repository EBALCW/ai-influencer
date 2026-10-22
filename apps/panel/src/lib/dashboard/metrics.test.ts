import { describe, expect, it } from 'vitest';
import {
  changePercent,
  dashboardFilter,
  engagementRate,
  lineSegments,
  metricNumber,
} from './metrics';
describe('dashboard metrics', () => {
  it('uses UTC inclusive calendar days for presets', () => {
    expect(
      dashboardFilter({ range: '7' }, new Date('2026-03-01T23:30:00-05:00')),
    ).toMatchObject({ from: '2026-02-24', to: '2026-03-02' });
    expect(
      dashboardFilter({ range: '30' }, new Date('2026-03-01T00:00Z')).from,
    ).toBe('2026-01-31');
    expect(
      dashboardFilter({ range: '90' }, new Date('2026-03-01T00:00Z')).from,
    ).toBe('2025-12-02');
  });
  it('validates query input, real dates, duplicate query arrays and bounded periods', () => {
    for (const q of [
      { platform: 'other' },
      { inf: ['one', 'two'] },
      { range: 'custom', from: '2026-02-30', to: '2026-03-01' },
      { range: 'custom', from: '2026-03-02', to: '2026-03-01' },
      { range: 'custom', from: '2024-01-01', to: '2026-03-01' },
      { range: 'custom' },
    ])
      expect(() => dashboardFilter(q)).toThrow();
    expect(
      dashboardFilter({
        range: 'custom',
        from: '2026-01-01',
        to: '2026-01-01',
        platform: 'youtube',
        inf: 'demo-creator',
      }),
    ).toMatchObject({ platform: 'youtube', inf: 'demo-creator' });
  });
  it('uses weighted engagement and does not invent measurements', () => {
    expect(engagementRate(30, 300)).toBe(10);
    expect(engagementRate(0, 300)).toBe(0);
    expect(engagementRate(30, 0)).toBeNull();
    expect(engagementRate(null, 300)).toBeNull();
    expect(metricNumber(null)).toBe('—');
  });
  it('handles negative growth and zero baselines', () => {
    expect(changePercent(-20, 80)).toBe(-20);
    expect(changePercent(20, 120)).toBe(20);
    expect(changePercent(20, 20)).toBeNull();
    expect(changePercent(null, 100)).toBeNull();
  });
  it('keeps missing days as gaps in the chart', () => {
    expect(lineSegments([10, null, 20])).toHaveLength(2);
    expect(lineSegments([null, null])).toEqual([]);
    expect(lineSegments([0])).toEqual(['10,130']);
  });
});
