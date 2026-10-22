import { assertEquals } from '@std/assert';
import { cleanShareUrl, count, mapUser, mapVideo } from './map.ts';
import { tiktokError, tiktokErrorCode } from './client.ts';
import {
  PermanentError,
  RateLimitedError,
  TokenExpiredError,
  TransientError,
} from '../collectors/types.ts';

const NOW = new Date('2026-10-22T12:00:00Z');

Deno.test('count: negatif, kesirli string ve eksik değerler', () => {
  assertEquals(count(12), 12);
  assertEquals(count('42'), 42);
  assertEquals(count(-1), null);
  assertEquals(count(undefined), null);
  assertEquals(count(''), null);
  assertEquals(count('abc'), null);
});

Deno.test('mapUser: sayaç yoksa null, eksik video sayısı null', () => {
  assertEquals(mapUser({ open_id: 'x' }), null);
  assertEquals(mapUser({ follower_count: 5 }), {
    followers: 5,
    following: null,
    mediaCount: null,
    totalLikes: null,
  });
});

Deno.test('cleanShareUrl: yalnız https, sorgu ve parça atılır', () => {
  assertEquals(
    cleanShareUrl('https://www.tiktok.com/@a/video/1?u_code=secret#x'),
    'https://www.tiktok.com/@a/video/1',
  );
  assertEquals(cleanShareUrl('javascript:alert(1)'), null);
  assertEquals(cleanShareUrl('http://www.tiktok.com/@a/video/1'), null);
  assertEquals(cleanShareUrl(42), null);
});

Deno.test('mapVideo: başlık + açıklama, sayısal id ve tarihsiz kayıt', () => {
  const v = mapVideo({
    id: '1',
    create_time: 1_792_400_400,
    title: 'Başlık',
    video_description: 'Açıklama',
    duration: 181,
  });
  assertEquals(v?.caption, 'Başlık\n\nAçıklama');
  assertEquals(v?.isShort, false);
  assertEquals(v?.url, null);
  assertEquals(mapVideo({ id: '1', title: 'x', create_time: 1 })?.caption, 'x');
  assertEquals(mapVideo({ id: 1, create_time: 1_792_400_400 }), null);
  assertEquals(mapVideo({ id: '1' }), null);
  assertEquals(
    mapVideo({ id: '1', create_time: 1, duration: null })?.isShort,
    true,
  );
});

Deno.test('tiktokError: kod ve durum eşlemesi', () => {
  const r = (status: number, headers: HeadersInit = {}) =>
    new Response(null, { status, headers });
  const body = (code: string) => ({ error: { code, message: 'gizli' } });
  assertEquals(tiktokErrorCode(body('ok')), 'ok');
  assertEquals(tiktokErrorCode(null), null);
  assertEquals(tiktokErrorCode({ error: 'x' }), null);

  const expired = tiktokError(r(401), null, 'T', NOW);
  assertEquals(expired instanceof TokenExpiredError, true);
  assertEquals((expired as TokenExpiredError).accountStatus, 'expired');

  const scope = tiktokError(r(403), body('scope_permission_missed'), 'T', NOW);
  assertEquals((scope as TokenExpiredError).accountStatus, 'error');

  const limited = tiktokError(r(200), body('rate_limit_exceeded'), 'T', NOW);
  assertEquals(limited instanceof RateLimitedError, true);
  assertEquals((limited as RateLimitedError).retryAfterSeconds, null);

  assertEquals(
    tiktokError(r(503), null, 'T', NOW) instanceof TransientError,
    true,
  );
  assertEquals(
    tiktokError(r(408), null, 'T', NOW) instanceof TransientError,
    true,
  );
  const notFound = tiktokError(r(404), body('unknown'), 'T', NOW);
  assertEquals(notFound instanceof PermanentError, true);
  assertEquals(notFound.message, 'T: istek reddedildi (404, unknown)');
});
