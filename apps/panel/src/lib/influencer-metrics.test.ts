import { describe, expect, it } from 'vitest';
import { sevenDayViews } from './influencer-metrics';

const since = new Date('2026-10-14T00:00:00.000Z');

describe('sevenDayViews', () => {
  it('uses the latest cumulative snapshot on each side of the boundary', () => {
    expect(
      sevenDayViews(
        [
          { captured_at: '2026-10-13T12:00:00Z', views: 100 },
          { captured_at: '2026-10-15T12:00:00Z', views: 150 },
          { captured_at: '2026-10-17T12:00:00Z', views: 190 },
        ],
        since,
      ),
    ).toBe(90);
  });

  it('returns zero when snapshots are missing', () => {
    expect(sevenDayViews([], since)).toBe(0);
  });

  it('counts a new post from its first available snapshot', () => {
    expect(
      sevenDayViews(
        [{ captured_at: '2026-10-16T12:00:00Z', views: 42 }],
        since,
      ),
    ).toBe(42);
  });

  it('does not report negative growth after a counter reset', () => {
    expect(
      sevenDayViews(
        [
          { captured_at: '2026-10-13T12:00:00Z', views: 100 },
          { captured_at: '2026-10-16T12:00:00Z', views: 10 },
        ],
        since,
      ),
    ).toBe(0);
  });
});
