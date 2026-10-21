import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './rate-limit';

describe('createRateLimiter', () => {
  it('pencere içinde sınırı aşınca bekleme süresi döner, pencere geçince açılır', () => {
    let now = 0;
    const limiter = createRateLimiter({
      limit: 2,
      windowMs: 60_000,
      now: () => now,
    });

    expect(limiter.check('u1')).toEqual({ ok: true });
    now = 10_000;
    expect(limiter.check('u1')).toEqual({ ok: true });
    now = 20_000;
    expect(limiter.check('u1')).toEqual({ ok: false, retryAfterSeconds: 40 });

    // Başka kullanıcı etkilenmez
    expect(limiter.check('u2')).toEqual({ ok: true });

    now = 60_001;
    expect(limiter.check('u1')).toEqual({ ok: true });
  });
});
