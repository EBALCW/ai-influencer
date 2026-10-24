import { assertEquals } from '@std/assert';
import { handler } from './index.ts';
Deno.test(
  'refresh giriş noktası sır olmadan veya yanlış sırla kapalıdır',
  async () => {
    const previous = Deno.env.get('CRON_SECRET');
    try {
      Deno.env.delete('CRON_SECRET');
      assertEquals(
        (
          await handler(
            new Request('https://fixture.invalid', { method: 'POST' }),
          )
        ).status,
        503,
      );
      Deno.env.set('CRON_SECRET', 'fixture-cron');
      assertEquals(
        (
          await handler(
            new Request('https://fixture.invalid', {
              method: 'POST',
              headers: { 'x-cron-secret': 'wrong' },
            }),
          )
        ).status,
        401,
      );
      assertEquals(
        (
          await handler(
            new Request('https://fixture.invalid', {
              headers: { 'x-cron-secret': 'fixture-cron' },
            }),
          )
        ).status,
        405,
      );
    } finally {
      if (previous === undefined) Deno.env.delete('CRON_SECRET');
      else Deno.env.set('CRON_SECRET', previous);
    }
  },
);
