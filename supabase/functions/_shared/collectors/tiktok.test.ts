import { assert, assertEquals, assertRejects } from '@std/assert';
import {
  type CollectorContext,
  PermanentError,
  type PostRef,
  RateLimitedError,
  TokenExpiredError,
  TransientError,
} from './types.ts';
import { collectors, getCollector } from './index.ts';
import { createTiktokCollector, tiktokCollector } from './tiktok.ts';
import { createFakeFetch, json, type Responder } from '../tiktok/fake-fetch.ts';
import { MemoryStore } from '../sync/memory-store.ts';
import { runSync } from '../sync/orchestrator.ts';
import userInfo from '../tiktok/fixtures/user.info.json' with { type: 'json' };
import userNoStats from '../tiktok/fixtures/user.info.no-stats.json' with { type: 'json' };
import page1 from '../tiktok/fixtures/video.list.page1.json' with { type: 'json' };
import page2 from '../tiktok/fixtures/video.list.page2.json' with { type: 'json' };
import videoQuery from '../tiktok/fixtures/video.query.json' with { type: 'json' };
import videoQueryEmpty from '../tiktok/fixtures/video.query.empty.json' with { type: 'json' };
import tokenInvalid from '../tiktok/fixtures/error.access_token_invalid.json' with { type: 'json' };
import scopeMissing from '../tiktok/fixtures/error.scope_not_authorized.json' with { type: 'json' };
import rateLimited from '../tiktok/fixtures/error.rate_limit_exceeded.json' with { type: 'json' };
import internalError from '../tiktok/fixtures/error.internal_error.json' with { type: 'json' };
import invalidParams from '../tiktok/fixtures/error.invalid_params.json' with { type: 'json' };

const NOW = new Date('2026-10-22T12:00:00Z');
const TOKEN = 'act.fixture-secret-access-token';
const OPEN_ID = 'fixture-open-id-0001';

function makeCtx(
  fetchFn: typeof fetch,
  opts: { externalId?: string | null } = {},
) {
  const quota: number[] = [];
  const warnings: string[] = [];
  const ctx: CollectorContext = {
    account: {
      id: 'acc-tt',
      influencerId: 'inf-1',
      platform: 'tiktok',
      handle: '@fixture.creator',
      externalId: opts.externalId === undefined ? OPEN_ID : opts.externalId,
      status: 'active',
    },
    token: {
      accessToken: TOKEN,
      scope: 'user.info.basic,user.info.stats,video.list',
    },
    fetch: fetchFn,
    now: NOW,
    reportQuota: (u) => quota.push(u),
    warn: (m) => warnings.push(m),
  };
  const total = () => quota.reduce((a, b) => a + b, 0);
  return { ctx, warnings, total };
}

/** video/list: cursor yoksa 1. sayfa, 1. sayfanın cursor'ıyla 2. sayfa. */
const videoList: Responder = (call) =>
  json(call.body?.cursor === page1.data.cursor ? page2 : page1);

/** video/query: istenen id'lerin fixture'ı. */
const videoQueryRoute: Responder = (call) => {
  const ids = (call.body?.filters as { video_ids?: string[] })?.video_ids ?? [];
  return json({
    ...videoQuery,
    data: {
      videos: videoQuery.data.videos.filter((v) => ids.includes(v.id)),
    },
  });
};

const post = (targetHours: number | null = 24): PostRef => ({
  id: 'post-1',
  externalId: '7420000000000000003',
  publishedAt: new Date('2026-10-19T09:00:00Z'),
  targetHours,
});

Deno.test('kayıt: tiktok toplayıcısı üretim kaydında', () => {
  assertEquals(getCollector(collectors, 'tiktok'), tiktokCollector);
  assertEquals(tiktokCollector.platform, 'tiktok');
  // YouTube kaydı yerinde kalır.
  assertEquals(getCollector(collectors, 'youtube')?.platform, 'youtube');
});

// ── fetchAccount ───────────────────────────────────────────────────────────

Deno.test(
  'fetchAccount: takipçi, takip, video ve toplam beğeni; token başlıkta',
  async () => {
    const fake = createFakeFetch({ 'user/info': () => json(userInfo) });
    const { ctx, total, warnings } = makeCtx(fake.fetch);
    const account = await tiktokCollector.fetchAccount(ctx);
    assertEquals(account, {
      followers: 12840,
      following: 37,
      mediaCount: 64,
      totalLikes: 456789,
    });
    const call = fake.calls[0];
    assertEquals(call.method, 'GET');
    assertEquals(
      call.url.searchParams.get('fields'),
      'open_id,display_name,follower_count,following_count,likes_count,video_count',
    );
    assertEquals(call.authorization, `Bearer ${TOKEN}`);
    assert(!call.url.toString().includes(TOKEN), 'token URL’de yok');
    assertEquals(total(), 1);
    assertEquals(warnings, []);
  },
);

Deno.test(
  'fetchAccount: user.info.stats izni yoksa 0 yazılmaz, kalıcı hata',
  async () => {
    const fake = createFakeFetch({ 'user/info': () => json(userNoStats) });
    const { ctx } = makeCtx(fake.fetch);
    const err = await assertRejects(
      () => tiktokCollector.fetchAccount(ctx),
      PermanentError,
    );
    assert(err.message.includes('user.info.stats'));
  },
);

Deno.test(
  'fetchAccount: token başka hesaba aitse (open_id farklı) yazılmaz',
  async () => {
    const fake = createFakeFetch({ 'user/info': () => json(userInfo) });
    const { ctx } = makeCtx(fake.fetch, { externalId: 'another-open-id' });
    await assertRejects(
      () => tiktokCollector.fetchAccount(ctx),
      PermanentError,
    );
    // external_id henüz yoksa token sahibinin hesabı kabul edilir.
    const { ctx: ctx2 } = makeCtx(fake.fetch, { externalId: null });
    assertEquals((await tiktokCollector.fetchAccount(ctx2)).followers, 12840);
  },
);

// ── fetchPosts ─────────────────────────────────────────────────────────────

Deno.test(
  'fetchPosts: ilk senkron cursor ile tüm sayfaları gezer, tarihsizi atlar',
  async () => {
    const fake = createFakeFetch({ 'video/list': videoList });
    const { ctx, total, warnings } = makeCtx(fake.fetch);
    const posts = await tiktokCollector.fetchPosts(ctx, { since: null });

    assertEquals(fake.calls.length, 2);
    assertEquals(fake.calls[0].method, 'POST');
    assertEquals(fake.calls[0].body, { max_count: 20 });
    assertEquals(fake.calls[1].body, {
      max_count: 20,
      cursor: page1.data.cursor,
    });
    assertEquals(
      fake.calls[0].url.searchParams.get('fields'),
      'id,create_time,title,video_description,duration,height,width,share_url',
    );
    assertEquals(total(), 2);

    assertEquals(
      posts.map((p) => [p.externalId, p.publishedAt.toISOString()]),
      [
        ['7420000000000000003', '2026-10-19T09:00:00.000Z'],
        ['7420000000000000002', '2026-10-17T09:00:00.000Z'],
        ['7420000000000000001', '2026-10-10T09:00:00.000Z'],
      ],
    );
    const [first, long, short] = posts;
    // share_url izleme parametreleri atılır
    assertEquals(
      first.url,
      'https://www.tiktok.com/@fixture.creator/video/7420000000000000003',
    );
    assertEquals(first.caption, 'Sabah rutini #fixture');
    assertEquals([first.durationS, first.isShort], [21, true]);
    // Açıklama başlığı içeriyorsa başlık tekrar eklenmez
    assertEquals(long.caption, 'Uzun anlatım bölüm 1');
    assertEquals([long.durationS, long.isShort], [312, false]);
    assertEquals(short.caption, '');
    assertEquals(warnings.length, 1, 'tarihsiz video için uyarı');
  },
);

Deno.test(
  'fetchPosts: artımlı senkron since − 6 sa öncesine gelince durur',
  async () => {
    const fake = createFakeFetch({ 'video/list': videoList });
    const { ctx } = makeCtx(fake.fetch);
    const since = new Date('2026-10-17T12:00:00Z'); // 2. video since − 3 sa
    const posts = await tiktokCollector.fetchPosts(ctx, { since });
    assertEquals(
      posts.map((p) => p.externalId),
      ['7420000000000000003', '7420000000000000002'],
    );
    assertEquals(fake.calls.length, 2, 'kesim 2. sayfada görülür');

    const later = createFakeFetch({ 'video/list': videoList });
    const { ctx: ctx2 } = makeCtx(later.fetch);
    const recent = await tiktokCollector.fetchPosts(ctx2, {
      since: new Date('2026-10-19T09:00:00Z'),
    });
    assertEquals(
      recent.map((p) => p.externalId),
      ['7420000000000000003'],
    );
    assertEquals(later.calls.length, 1, 'kesime ilk sayfada ulaşıldı');
  },
);

Deno.test('fetchPosts: sayfa sınırında durur ve uyarır', async () => {
  const fake = createFakeFetch({ 'video/list': () => json(page1) });
  const { ctx, warnings } = makeCtx(fake.fetch);
  const collector = createTiktokCollector({ maxPagesInitial: 1 });
  const posts = await collector.fetchPosts(ctx, { since: null });
  assertEquals(posts.length, 2);
  assertEquals(fake.calls.length, 1);
  assert(warnings.some((w) => w.includes('1 sayfada kesildi')));
});

Deno.test('fetchPosts: ilerlemeyen cursor sonsuz döngüye girmez', async () => {
  const stuck = {
    ...page1,
    data: { ...page1.data, videos: [], cursor: 0, has_more: true },
  };
  const fake = createFakeFetch({ 'video/list': () => json(stuck) });
  const { ctx } = makeCtx(fake.fetch);
  await tiktokCollector.fetchPosts(ctx, { since: null });
  // 1. çağrı cursor'sız, 2. çağrı cursor=0; aynı cursor dönünce durur.
  assertEquals(fake.calls.length, 2);
});

// ── fetchPostMetrics ───────────────────────────────────────────────────────

Deno.test(
  'fetchPostMetrics: izlenme/beğeni/yorum/paylaşım; olmayanlar null',
  async () => {
    const fake = createFakeFetch({ 'video/query': videoQueryRoute });
    const { ctx, total } = makeCtx(fake.fetch);
    const metrics = await tiktokCollector.fetchPostMetrics(ctx, post());
    assertEquals(fake.calls[0].method, 'POST');
    assertEquals(fake.calls[0].body, {
      filters: { video_ids: ['7420000000000000003'] },
    });
    assertEquals(
      fake.calls[0].url.searchParams.get('fields'),
      'id,view_count,like_count,comment_count,share_count',
    );
    assertEquals(total(), 1);
    assertEquals(
      [metrics?.views, metrics?.likes, metrics?.comments, metrics?.shares],
      [48210, 3904, 112, 87],
    );
    // Display API'de yok: uydurulmaz
    assertEquals(
      [
        metrics?.saves,
        metrics?.reach,
        metrics?.avgWatchTimeS,
        metrics?.completionRate,
      ],
      [null, null, null, null],
    );
    assertEquals(metrics?.raw.unavailable, [
      'saves',
      'reach',
      'avg_watch_time_s',
      'completion_rate',
    ]);
  },
);

Deno.test('fetchPostMetrics: silinmiş video → null', async () => {
  const fake = createFakeFetch({
    'video/query': () => json(videoQueryEmpty),
  });
  const { ctx } = makeCtx(fake.fetch);
  assertEquals(await tiktokCollector.fetchPostMetrics(ctx, post()), null);
});

// ── Hatalar ────────────────────────────────────────────────────────────────

Deno.test(
  'hata: 401 access_token_invalid → TokenExpired(expired)',
  async () => {
    const fake = createFakeFetch({
      'user/info': () => json(tokenInvalid, 401),
    });
    const { ctx } = makeCtx(fake.fetch);
    const err = await assertRejects(
      () => tiktokCollector.fetchAccount(ctx),
      TokenExpiredError,
    );
    assertEquals(err.accountStatus, 'expired');
    assert(!err.message.includes(TOKEN));
    assert(!err.message.includes('not found in the request'), 'gövde yok');
  },
);

Deno.test(
  'hata: scope_not_authorized → TokenExpired(error) (yeniden bağlanmalı)',
  async () => {
    const fake = createFakeFetch({
      'video/list': () => json(scopeMissing, 401),
    });
    const { ctx } = makeCtx(fake.fetch);
    const err = await assertRejects(
      () => tiktokCollector.fetchPosts(ctx, { since: null }),
      TokenExpiredError,
    );
    assertEquals(err.accountStatus, 'error');
  },
);

Deno.test('hata: 429 rate_limit_exceeded → RateLimited(account)', async () => {
  const fake = createFakeFetch({
    'video/query': () => json(rateLimited, 429, { 'retry-after': '20' }),
  });
  const { ctx, total } = makeCtx(fake.fetch);
  const err = await assertRejects(
    () => tiktokCollector.fetchPostMetrics(ctx, post()),
    RateLimitedError,
  );
  assertEquals([err.scope, err.retryAfterSeconds], ['account', 20]);
  assertEquals(total(), 1, 'başarısız yanıt da istek olarak sayılır');
});

Deno.test('hata: 5xx / internal_error / ağ hatası → Transient', async () => {
  const fake = createFakeFetch({
    'user/info': [
      () => json(internalError, 500),
      // HTTP 200 ama zarf hatası
      () => json(internalError, 200),
      () => new TypeError('ağ yok'),
    ],
  });
  const { ctx, total } = makeCtx(fake.fetch);
  for (let i = 0; i < 3; i++) {
    await assertRejects(
      () => tiktokCollector.fetchAccount(ctx),
      TransientError,
    );
  }
  assertEquals(total(), 2, 'ağ hatasında istek sayılmaz');
});

Deno.test(
  'hata: invalid_params → Permanent; mesajda yalnız durum ve kod',
  async () => {
    const fake = createFakeFetch({
      'video/list': () => json(invalidParams, 400),
    });
    const { ctx } = makeCtx(fake.fetch);
    const err = await assertRejects(
      () => tiktokCollector.fetchPosts(ctx, { since: null }),
      PermanentError,
    );
    assertEquals(
      err.message,
      'TikTok video/list: istek reddedildi (400, invalid_params)',
    );
    assert(!err.message.includes('secret_field'));
  },
);

Deno.test('hata: data alanı olmayan yanıt → Permanent', async () => {
  const fake = createFakeFetch({
    'user/info': () => json({ error: { code: 'ok' } }),
  });
  const { ctx } = makeCtx(fake.fetch);
  await assertRejects(() => tiktokCollector.fetchAccount(ctx), PermanentError);
});

// ── Orkestratörle uçtan uca (MemoryStore, sahte fetch) ──────────────────────

function setupStore() {
  const store = new MemoryStore();
  store.accounts.push({
    id: 'acc-tt',
    influencerId: 'inf-1',
    platform: 'tiktok',
    handle: '@fixture.creator',
    externalId: OPEN_ID,
    status: 'active',
  });
  store.tokens.set('acc-tt', { accessToken: TOKEN });
  return store;
}

const deps = (store: MemoryStore, fetchFn: typeof fetch) => ({
  store,
  collectors,
  fetch: fetchFn,
  now: () => NOW,
  sleep: () => Promise.resolve(),
  log: () => {},
});

Deno.test(
  'runSync: posts işi iki kez çalışınca duplicate yok, istek sayısı sync_runs’a',
  async () => {
    const store = setupStore();
    const fake = createFakeFetch({ 'video/list': videoList });
    await runSync('posts', deps(store, fake.fetch));
    await runSync('posts', deps(store, fake.fetch));
    assertEquals(
      store.posts.map((p) => [p.external_id, p.is_short, p.duration_s]),
      [
        ['7420000000000000003', true, 21],
        ['7420000000000000002', false, 312],
        ['7420000000000000001', true, 9],
      ],
    );
    assertEquals(store.runs[0].status, 'succeeded');
    assertEquals(store.runs[0].quotaUnits, 2);
    // Artımlı: since = en yeni post → ilk sayfada kesim
    assertEquals(store.runs[1].quotaUnits, 1);
  },
);

Deno.test(
  'runSync: accounts işi total_likes dahil hesap snapshot’ı yazar',
  async () => {
    const store = setupStore();
    const fake = createFakeFetch({ 'user/info': () => json(userInfo) });
    await runSync('accounts', deps(store, fake.fetch));
    const snap = store.accountSnapshots[0];
    assertEquals(
      [snap.followers, snap.following, snap.media_count, snap.total_likes],
      [12840, 37, 64, 456789],
    );
    assertEquals(snap.total_views, null);
  },
);

Deno.test(
  'runSync: metrics snapshot yazar, olmayan metrikler _unmeasured',
  async () => {
    const store = setupStore();
    store.due.push({
      postId: 'post-1',
      accountId: 'acc-tt',
      platform: 'tiktok',
      externalId: '7420000000000000003',
      publishedAt: new Date(NOW.getTime() - 24 * 3_600_000 - 5 * 60_000),
      targetHours: 24,
    });
    const fake = createFakeFetch({ 'video/query': videoQueryRoute });
    await runSync('metrics', deps(store, fake.fetch));
    assertEquals(store.metrics.length, 1);
    const m = store.metrics[0];
    assertEquals(
      [m.views, m.likes, m.comments, m.shares],
      [48210, 3904, 112, 87],
    );
    assertEquals(
      [m.avg_watch_time_s, m.completion_rate, m.reach],
      [null, null, null],
    );
    assertEquals(m.raw_payload._unmeasured, ['saves']);
  },
);

Deno.test(
  'runSync: elle girilmiş kontrol noktası sync’te ezilmez',
  async () => {
    const store = setupStore();
    const publishedAt = new Date(NOW.getTime() - 24 * 3_600_000 - 5 * 60_000);
    // Panelden elle girilmiş 24 sa değeri (source = 'manual' veritabanında).
    store.metrics.push({
      post_id: 'post-1',
      captured_at: new Date(
        publishedAt.getTime() + 24 * 3_600_000,
      ).toISOString(),
      hours_since_publish: 24,
      target_hours: 24,
      views: 99,
      reach: null,
      likes: 1,
      comments: 0,
      shares: 0,
      saves: 0,
      avg_watch_time_s: 7.5,
      completion_rate: 0.4,
      raw_payload: { source: 'manual' },
    });
    store.due.push({
      postId: 'post-1',
      accountId: 'acc-tt',
      platform: 'tiktok',
      externalId: '7420000000000000003',
      publishedAt,
      targetHours: 24,
    });
    const fake = createFakeFetch({ 'video/query': videoQueryRoute });
    await runSync('metrics', deps(store, fake.fetch));
    assertEquals(fake.calls.length, 0, 'zaten ölçülmüş nokta due değil');
    assertEquals(store.metrics.length, 1);
    assertEquals(store.metrics[0].views, 99);
    assertEquals(store.metrics[0].avg_watch_time_s, 7.5);
  },
);

Deno.test(
  'runSync: süresi dolmuş token hesabı expired yapar, iş failed',
  async () => {
    const store = setupStore();
    const fake = createFakeFetch({
      'user/info': () => json(tokenInvalid, 401),
    });
    const summary = await runSync('accounts', deps(store, fake.fetch));
    assertEquals(summary.runs[0].status, 'failed');
    assertEquals(store.statusChanges, [
      { accountId: 'acc-tt', status: 'expired' },
    ]);
    assert(!(summary.runs[0].error ?? '').includes(TOKEN));
  },
);
