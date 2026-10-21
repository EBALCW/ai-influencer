import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-redirect';

describe('safeNextPath', () => {
  it.each([
    ['/influencers', '/influencers'],
    ['/settings/team?tab=roles', '/settings/team?tab=roles'],
    ['/a/../b', '/b'],
  ])('aynı origin yolunu korur: %s', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    '',
    'influencers',
    '//evil.com',
    '/\\evil.com',
    '/\\/evil.com',
    'https://evil.com',
    '/\r\nSet-Cookie:x',
    '/\tevil',
  ])('dış veya bozuk hedefi ana sayfaya çevirir: %s', (input) => {
    expect(safeNextPath(input)).toBe('/');
  });
});
