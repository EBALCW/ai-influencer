import { describe, expect, it } from 'vitest';
import { canManageTeam, canWriteData } from './team-roles';

describe('team role permissions', () => {
  it('allows writes for owners and editors, but not viewers', () => {
    expect(canWriteData('owner')).toBe(true);
    expect(canWriteData('editor')).toBe(true);
    expect(canWriteData('viewer')).toBe(false);
  });

  it('allows only owners to manage the team', () => {
    expect(canManageTeam('owner')).toBe(true);
    expect(canManageTeam('editor')).toBe(false);
    expect(canManageTeam('viewer')).toBe(false);
  });
});
