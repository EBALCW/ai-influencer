import { describe, expect, it } from 'vitest';
import { inviteSchema, roleUpdateSchema, userIdSchema } from './team-schemas';

describe('team schemas', () => {
  it('daveti normalize eder', () => {
    expect(
      inviteSchema.parse({ email: '  Ali@Ekip.COM ', role: 'editor' }),
    ).toEqual({ email: 'ali@ekip.com', role: 'editor' });
  });

  it.each([
    { email: 'yanlis', role: 'editor' },
    { email: 'a@b.co', role: 'admin' },
    { email: 'a@b.co' },
    null,
  ])('geçersiz daveti reddeder: %j', (body) => {
    expect(inviteSchema.safeParse(body).success).toBe(false);
  });

  it('bilinmeyen rolü reddeder', () => {
    expect(roleUpdateSchema.safeParse({ role: 'superuser' }).success).toBe(
      false,
    );
  });

  it('kullanıcı id olarak sadece uuid kabul eder', () => {
    expect(
      userIdSchema.safeParse('10000000-0000-4000-8000-000000000001').success,
    ).toBe(true);
    expect(userIdSchema.safeParse('../../auth/users').success).toBe(false);
  });
});
