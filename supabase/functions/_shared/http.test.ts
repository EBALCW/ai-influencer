import { assertEquals } from '@std/assert';
import { requireCronSecret } from './http.ts';

const req = (secret?: string) =>
  new Request('http://localhost/fn', {
    method: 'POST',
    headers: secret ? { 'x-cron-secret': secret } : {},
  });

Deno.test('sır tanımlı değilse 503', () => {
  assertEquals(requireCronSecret(req('x'), null)?.status, 503);
  assertEquals(requireCronSecret(req(''), '')?.status, 503);
});

Deno.test('başlık yoksa ya da yanlışsa 401', () => {
  assertEquals(requireCronSecret(req(), 's3cret')?.status, 401);
  assertEquals(requireCronSecret(req('s3cre'), 's3cret')?.status, 401);
  assertEquals(requireCronSecret(req('s3cretX'), 's3cret')?.status, 401);
});

Deno.test('doğru sır → null (yetkili)', () => {
  assertEquals(requireCronSecret(req('s3cret'), 's3cret'), null);
});
