import {
  assert,
  assertEquals,
  assertInstanceOf,
  assertRejects,
} from '@std/assert';
import {
  type CollectorContext,
  PermanentError,
  RateLimitedError,
  TokenExpiredError,
  TransientError,
} from '../collectors/types.ts';
import { dataGet, googleErrorReasons, youtubeError } from './client.ts';
import { createFakeFetch, json } from './fake-fetch.ts';
import quotaExceeded from './fixtures/error.quotaExceeded.json' with { type: 'json' };
import rateLimit from './fixtures/error.rateLimitExceeded.json' with { type: 'json' };
import unauthorized from './fixtures/error.unauthorized.json' with { type: 'json' };
import backendError from './fixtures/error.backendError.json' with { type: 'json' };
import insufficient from './fixtures/error.insufficientPermissions.json' with { type: 'json' };
import invalidGrant from './fixtures/error.invalidGrant.json' with { type: 'json' };

const NOW = new Date('2026-10-22T06:00:00Z'); // 23:00 PDT → kota 1 saat sonra sıfırlanır
const TOKEN = 'ya29.fixture-secret-access-token';

function ctxWith(
  fetchFn: typeof fetch,
  quota: number[] = [],
): CollectorContext {
  return {
    account: {
      id: 'acc-yt',
      influencerId: 'inf-1',
      platform: 'youtube',
      handle: 'fixture',
      externalId: 'UCfixtureChannel000000001',
      status: 'active',
    },
    token: { accessToken: TOKEN },
    fetch: fetchFn,
    now: NOW,
    reportQuota: (u) => quota.push(u),
    warn: () => {},
  };
}

const res = (status: number, headers: HeadersInit = {}) =>
  new Response(null, { status, headers });

Deno.test(
  'googleErrorReasons: errors[].reason, status ve OAuth hata dizesi',
  () => {
    assertEquals(googleErrorReasons(quotaExceeded), ['quotaExceeded']);
    assertEquals(googleErrorReasons(unauthorized), [
      'authError',
      'UNAUTHENTICATED',
    ]);
    assertEquals(googleErrorReasons(invalidGrant), ['invalid_grant']);
    assertEquals(googleErrorReasons(null), []);
    assertEquals(googleErrorReasons('x'), []);
  },
);

Deno.test('youtubeError: HTTP durumu + neden → tipli hata', () => {
  const quota = youtubeError(res(403), quotaExceeded, 'yt', NOW);
  assertInstanceOf(quota, RateLimitedError);
  assertEquals(quota.scope, 'platform');
  assertEquals(quota.retryAfterSeconds, 3600);

  const rate = youtubeError(
    res(403, { 'retry-after': '7' }),
    rateLimit,
    'yt',
    NOW,
  );
  assertInstanceOf(rate, RateLimitedError);
  assertEquals(rate.scope, 'account');
  assertEquals(rate.retryAfterSeconds, 7);

  const plain429 = youtubeError(res(429), null, 'yt', NOW);
  assertInstanceOf(plain429, RateLimitedError);
  assertEquals(plain429.scope, 'account');
  assertEquals(plain429.retryAfterSeconds, null);

  const auth = youtubeError(res(401), unauthorized, 'yt', NOW);
  assertInstanceOf(auth, TokenExpiredError);
  assertEquals(auth.accountStatus, 'expired');

  const revoked = youtubeError(res(400), invalidGrant, 'yt', NOW);
  assertInstanceOf(revoked, TokenExpiredError);
  assertEquals(revoked.accountStatus, 'error');

  assertInstanceOf(
    youtubeError(res(503), backendError, 'yt', NOW),
    TransientError,
  );
  assertInstanceOf(youtubeError(res(500), null, 'yt', NOW), TransientError);
  assertInstanceOf(youtubeError(res(408), null, 'yt', NOW), TransientError);
  assertInstanceOf(
    youtubeError(res(403), insufficient, 'yt', NOW),
    PermanentError,
  );
  assertInstanceOf(youtubeError(res(404), null, 'yt', NOW), PermanentError);
  assertInstanceOf(
    youtubeError(res(400), { error: { code: 400 } }, 'yt', NOW),
    PermanentError,
  );
});

Deno.test(
  'youtubeError: mesajda yanıt gövdesi yok, yalnız durum ve neden',
  () => {
    const e = youtubeError(res(403), insufficient, 'YouTube videos.list', NOW);
    assertEquals(
      e.message,
      'YouTube videos.list: istek reddedildi (403, insufficientPermissions)',
    );
  },
);

Deno.test(
  "dataGet: token başlıkta, URL'de değil; kota yanıt başına raporlanır",
  async () => {
    const quota: number[] = [];
    const fake = createFakeFetch({ videos: () => json({ items: [] }) });
    await dataGet(ctxWith(fake.fetch, quota), 'videos.list', {
      part: 'statistics',
      id: 'a,b',
    });
    assertEquals(fake.calls.length, 1);
    const call = fake.calls[0];
    assertEquals(
      call.url.origin + call.url.pathname,
      'https://www.googleapis.com/youtube/v3/videos',
    );
    assertEquals(call.url.searchParams.get('id'), 'a,b');
    assertEquals(call.authorization, `Bearer ${TOKEN}`);
    assert(!call.url.toString().includes(TOKEN));
    assertEquals(quota, [1]);
  },
);

Deno.test(
  'dataGet: hatalı yanıt da kota harcar, ağ hatası harcamaz',
  async () => {
    const quota: number[] = [];
    const failing = createFakeFetch({ videos: () => json(quotaExceeded, 403) });
    await assertRejects(
      () => dataGet(ctxWith(failing.fetch, quota), 'videos.list', { id: 'x' }),
      RateLimitedError,
    );
    assertEquals(quota, [1]);

    const offline = createFakeFetch({
      videos: () => new Error('connection reset'),
    });
    const err = await assertRejects(
      () => dataGet(ctxWith(offline.fetch, quota), 'videos.list', { id: 'x' }),
      TransientError,
    );
    assertEquals(quota, [1]);
    assert(!err.message.includes('connection reset'));
  },
);

Deno.test('dataGet: JSON olmayan 200 yanıt → kalıcı hata', async () => {
  const fake = createFakeFetch({
    videos: () => new Response('<html>', { status: 200 }),
  });
  await assertRejects(
    () => dataGet(ctxWith(fake.fetch), 'videos.list', {}),
    PermanentError,
  );
});
