// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createToolLoginLimiter } from './rate-limit';

describe('giriş kodu hız sınırı', () => {
  it('kullanıcı başına sayar, pencere geçince yeniden izin verir', () => {
    let now = 1_000_000;
    const limiter = createToolLoginLimiter(2, 60_000, () => now);
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(false);
    // Başka kullanıcı etkilenmez
    expect(limiter.take('b')).toBe(true);
    now += 59_000;
    expect(limiter.take('a')).toBe(false);
    now += 2_000;
    expect(limiter.take('a')).toBe(true);
  });
});
