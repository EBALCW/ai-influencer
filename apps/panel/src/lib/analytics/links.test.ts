import { describe, expect, it } from 'vitest';
import { analyticsHref } from './links';

describe('analyticsHref', () => {
  it('inf seçimini korur, boş parametreleri atar', () => {
    expect(analyticsHref('/analytics', 'demo-creator', { h: 5, x: '' })).toBe(
      '/analytics?h=5&inf=demo-creator',
    );
    expect(analyticsHref('/analytics', '')).toBe('/analytics');
  });
  it('ids listesini virgüllü bırakır, slug kodlanır', () => {
    expect(
      analyticsHref('/analytics/compare', 'a b', { ids: ['x', 'y'].join(',') }),
    ).toBe('/analytics/compare?ids=x,y&inf=a+b');
  });
});
