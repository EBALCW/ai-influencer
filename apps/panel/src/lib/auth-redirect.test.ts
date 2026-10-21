import { describe, expect, it } from 'vitest';
import { isSafeNextPath } from './auth-redirect';

describe('isSafeNextPath', () => {
  it('allows local absolute paths and their query strings', () => {
    expect(isSafeNextPath('/settings/team?tab=members')).toBe(true);
  });

  it.each(['https://example.com', '//example.com', '/\\example.com', '/x\ny'])(
    'rejects unsafe redirect target %j',
    (value) => {
      expect(isSafeNextPath(value)).toBe(false);
    },
  );
});
