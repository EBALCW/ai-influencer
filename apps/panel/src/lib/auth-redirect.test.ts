import { describe, expect, it } from 'vitest';
import { isAllowedBootstrapEmail, isSafeNextPath } from './auth-redirect';

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

describe('isAllowedBootstrapEmail', () => {
  it('compares the preconfigured first-owner address case-insensitively', () => {
    expect(
      isAllowedBootstrapEmail(' Owner@Example.com ', 'owner@example.com'),
    ).toBe(true);
  });

  it('rejects missing or different addresses', () => {
    expect(isAllowedBootstrapEmail('owner@example.com', undefined)).toBe(false);
    expect(
      isAllowedBootstrapEmail('other@example.com', 'owner@example.com'),
    ).toBe(false);
  });
});
