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
import {
  createYoutubeCollector,
  wantsAnalytics,
  youtubeCollector,
} from './youtube.ts';
import {
  createFakeFetch,
  json,
  type Responder,
} from '../youtube/fake-fetch.ts';
import { MemoryStore } from '../sync/memory-store.ts';
import { runSync } from '../sync/orchestrator.ts';
import channelStats from '../youtube/fixtures/channels.statistics.json' with { type: 'json' };
import channelDetails from '../youtube/fixtures/channels.contentDetails.json' with { type: 'json' };
import page1 from '../youtube/fixtures/playlistItems.page1.json' with { type: 'json' };
import page2 from '../youtube/fixtures/playlistItems.page2.json' with { type: 'json' };
import videoDetails from '../youtube/fixtures/videos.details.json' with { type: 'json' };
import videoStats from '../youtube/fixtures/videos.statistics.json' with { type: 'json' };
import videosEmpty from '../youtube/fixtures/videos.empty.json' with { type: 'json' };
import analyticsReport from '../youtube/fixtures/analytics.report.json' with { type: 'json' };
import analyticsEmpty from '../youtube/fixtures/analytics.empty.json' with { type: 'json' };
import quotaExceeded from '../youtube/fixtures/error.quotaExceeded.json' with { type: 'json' };
import unauthorized from '../youtube/fixtures/error.unauthorized.json' with { type: 'json' };
import backendError from '../youtube/fixtures/error.backendError.json' with { type: 'json' };
import insufficient from '../youtube/fixtures/error.insufficientPermissions.json' with { type: 'json' };

const NOW = new Date('2026-10-22T12:00:00Z');
const TOKEN = 'ya29.fixture-secret-access-token';
const ANALYTICS_SCOPE =
  'https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly';

function makeCtx(
  fetchFn: typeof fetch,
  opts: { scope?: string; externalId?: string | null } = {},
) {
  const quota: number[] = [];
  const warnings: string[] = [];
  const ctx: CollectorContext = {
    account: {
      id: 'acc-yt',
      influencerId: 'inf-1',
      platform: 'youtube',
      handle: 'fixture',
      externalId:
        opts.externalId === undefined
          ? 'UCfixtureChannel000000001'
          : opts.externalId,
      status: 'active',
    },
    token: { accessToken: TOKEN, scope: opts.scope ?? ANALYTICS_SCOPE },
    fetch: fetchFn,
    now: NOW,
    reportQuota: (u) => quota.push(u),
    warn: (m) => warnings.push(m),
  };
  const total = () => quota.reduce((a, b) => a + b, 0);
  return { ctx, quota, warnings, total };
}

/** channels.list part'a göre doğru fixture'ı döner. */
const channels: Responder = (url) =>
  json(
    url.searchParams.get('part') === 'statistics'
      ? channelStats
      : channelDetails,
  );

/** videos.list: istenen id'lerin fixture'ları (statistics ya da ayrıntı). */
const videos: Responder = (url) => {
  const ids = (url.searchParams.get('id') ?? '').split(',');
  const source =
    url.searchParams.get('part') === 'statistics' ? videoStats : videoDetails;
  return json({
    ...source,
    items: source.items.filter((v) => ids.includes(v.id)),
  });
};

const playlist: Responder = (url) =>
  json(url.searchParams.get('pageToken') === 'PAGE_2' ? page2 : page1);

const post = (
  targetHours: number | null,
  hoursAgo = targetHours ?? 1,
): PostRef => ({
  id: 'post-1',
  externalId: 'vidShortV45',
  publishedAt: new Date(NOW.getTime() - hoursAgo * 3_600_000),
  targetHours,
});

Deno.test('kayıt: youtube toplayıcısı üretim kaydında', () => {
  assertEquals(getCollector(collectors, 'youtube'), youtubeCollector);
  assertEquals(youtubeCollector.platform, 'youtube');
});

Deno.test('fetchAccount: kanal istatistikleri, 1 kota birimi', async () => {
  const fake = createFakeFetch({ channels });
  const { ctx, total } = makeCtx(fake.fetch);
  const account = await youtubeCollector.fetchAccount(ctx);
  assertEquals(account, {
    followers: 8910,
    following: null,
    mediaCount: 42,
    totalViews: 1_234_567,
  });
  assertEquals(
    fake.calls[0].url.searchParams.get('id'),
    'UCfixtureChannel000000001',
  );
  assertEquals(fake.calls[0].url.searchParams.get('part'), 'statistics');
  assertEquals(total(), 1);
});

Deno.test(
  'fetchAccount: external_id yoksa token sahibinin kanalı (mine=true)',
  async () => {
    const fake = createFakeFetch({ channels });
    const { ctx } = makeCtx(fake.fetch, { externalId: null });
    await youtubeCollector.fetchAccount(ctx);
    assertEquals(fake.calls[0].url.searchParams.get('mine'), 'true');
    assertEquals(fake.calls[0].url.searchParams.has('id'), false);
  },
);

Deno.test('fetchAccount: kanal bulunamazsa kalıcı hata', async () => {
  const fake = createFakeFetch({ channels: () => json({ items: [] }) });
  const { ctx } = makeCtx(fake.fetch);
  await assertRejects(() => youtubeCollector.fetchAccount(ctx), PermanentError);
});

Deno.test(
  'fetchPosts: ilk senkron tüm sayfaları gezer, yayımlanmamışları atlar',
  async () => {
    const fake = createFakeFetch({ channels, playlistItems: playlist, videos });
    const { ctx, total } = makeCtx(fake.fetch);
    const posts = await youtubeCollector.fetchPosts(ctx, { since: null });

    const resources = fake.calls.map((c) => c.resource);
    assertEquals(resources, [
      'channels',
      'playlistItems',
      'playlistItems',
      'videos',
    ]);
    assertEquals(
      fake.calls[1].url.searchParams.get('playlistId'),
      'UUfixtureChannel000000001',
    );
    assertEquals(fake.calls[1].url.searchParams.get('maxResults'), '50');
    assertEquals(fake.calls[2].url.searchParams.get('pageToken'), 'PAGE_2');
    // Tarihsiz (özel) öğe istenmez; tek videos.list çağrısında toplu id.
    const videosCall = fake.calls[3].url;
    assertEquals(
      videosCall.searchParams.get('id'),
      'vidShortV45,vidLand2m,vidLongForm1,vidOld00001',
    );
    assertEquals(
      videosCall.searchParams.get('part'),
      'snippet,contentDetails,status,player,liveStreamingDetails',
    );
    assertEquals(videosCall.searchParams.get('maxHeight'), '640');
    // vidOld00001 fixture'da yok (silinmiş) → sonuçta yok.
    assertEquals(
      posts.map((p) => [p.externalId, p.isShort]),
      [
        ['vidShortV45', true],
        ['vidLand2m', false],
        ['vidLongForm1', false],
      ],
    );
    assertEquals(total(), 4);
  },
);

Deno.test(
  "fetchPosts: since'tan eski öğeye gelince sayfalama durur",
  async () => {
    const fake = createFakeFetch({ channels, playlistItems: playlist, videos });
    const { ctx, total } = makeCtx(fake.fetch);
    // Kesim = since - 6 sa = 20 Eki 00:00 → vidLand2m (19 Eki) daha eski.
    const posts = await youtubeCollector.fetchPosts(ctx, {
      since: new Date('2026-10-20T06:00:00Z'),
    });
    assertEquals(
      fake.calls.map((c) => c.resource),
      ['channels', 'playlistItems', 'videos'],
    );
    assertEquals(
      posts.map((p) => p.externalId),
      ['vidShortV45'],
    );
    assertEquals(total(), 3);
  },
);

Deno.test("fetchPosts: videos.list en fazla 50 id'lik paketlerle", async () => {
  const ids = Array.from(
    { length: 120 },
    (_, i) => `vid${String(i).padStart(8, '0')}`,
  );
  const pages = [ids.slice(0, 50), ids.slice(50, 100), ids.slice(100)];
  const fake = createFakeFetch({
    channels,
    playlistItems: (url) => {
      const n = Number(url.searchParams.get('pageToken') ?? '0');
      return json({
        items: pages[n].map((videoId, i) => ({
          contentDetails: {
            videoId,
            videoPublishedAt: new Date(
              NOW.getTime() - (n * 50 + i + 1) * 60_000,
            ).toISOString(),
          },
        })),
        ...(n < 2 ? { nextPageToken: String(n + 1) } : {}),
      });
    },
    videos: (url) =>
      json({
        items: (url.searchParams.get('id') ?? '').split(',').map((id) => ({
          id,
          snippet: { publishedAt: '2026-10-21T00:00:00Z', title: id },
          contentDetails: { duration: 'PT5M' },
          status: { privacyStatus: 'public' },
        })),
      }),
  });
  const { ctx, total } = makeCtx(fake.fetch);
  const posts = await youtubeCollector.fetchPosts(ctx, { since: null });
  const batches = fake.calls
    .filter((c) => c.resource === 'videos')
    .map((c) => (c.url.searchParams.get('id') ?? '').split(',').length);
  assertEquals(batches, [50, 50, 20]);
  assertEquals(posts.length, 120);
  assertEquals(total(), 1 + 3 + 3);
});

Deno.test('fetchPosts: sayfa üst sınırında durur ve uyarır', async () => {
  const fake = createFakeFetch({
    channels,
    playlistItems: (_url, n) =>
      json({
        items: [
          {
            contentDetails: {
              videoId: `v${n}`,
              videoPublishedAt: NOW.toISOString(),
            },
          },
        ],
        nextPageToken: `p${n + 1}`,
      }),
    videos: () => json({ items: [] }),
  });
  const { ctx, warnings } = makeCtx(fake.fetch);
  await createYoutubeCollector({ maxPagesInitial: 3 }).fetchPosts(ctx, {
    since: null,
  });
  assertEquals(
    fake.calls.filter((c) => c.resource === 'playlistItems').length,
    3,
  );
  assertEquals(warnings.length, 1);
});

Deno.test('wantsAnalytics: 1/5 sa Data API, 24 sa ve sonrası Analytics', () => {
  assertEquals(wantsAnalytics(post(1), NOW), false);
  assertEquals(wantsAnalytics(post(5), NOW), false);
  assertEquals(wantsAnalytics(post(24), NOW), true);
  assertEquals(wantsAnalytics(post(168), NOW), true);
  assertEquals(wantsAnalytics(post(null, 2), NOW), false);
  assertEquals(wantsAnalytics(post(null, 30), NOW), true);
});

Deno.test(
  'fetchPostMetrics: 1 sa noktasında yalnız Data API (Analytics çağrılmaz)',
  async () => {
    const fake = createFakeFetch({ videos });
    const { ctx, total } = makeCtx(fake.fetch);
    const m = await youtubeCollector.fetchPostMetrics(ctx, post(1));
    assertEquals(
      fake.calls.map((c) => c.resource),
      ['videos'],
    );
    assertEquals(m?.views, 15230);
    assertEquals(m?.likes, 1204);
    assertEquals(m?.comments, 87);
    assertEquals(m?.avgWatchTimeS, null);
    assertEquals(m?.completionRate, null);
    assertEquals(m?.raw.analyticsState, 'skipped');
    assertEquals(total(), 1);
  },
);

Deno.test(
  'fetchPostMetrics: 24 sa noktasında Analytics (Pasifik tarihleri, video filtresi)',
  async () => {
    const fake = createFakeFetch({
      videos,
      reports: () => json(analyticsReport),
    });
    const { ctx, total } = makeCtx(fake.fetch);
    const m = await youtubeCollector.fetchPostMetrics(ctx, post(24, 25));
    const report = fake.calls[1].url;
    assertEquals(
      report.origin + report.pathname,
      'https://youtubeanalytics.googleapis.com/v2/reports',
    );
    assertEquals(report.searchParams.get('ids'), 'channel==MINE');
    assertEquals(report.searchParams.get('filters'), 'video==vidShortV45');
    assertEquals(
      report.searchParams.get('metrics'),
      'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,shares',
    );
    // Yayın 21 Eki 11:00 UTC = 04:00 PDT; şimdi 22 Eki 05:00 PDT.
    assertEquals(report.searchParams.get('startDate'), '2026-10-21');
    assertEquals(report.searchParams.get('endDate'), '2026-10-22');
    assertEquals(fake.calls[1].authorization, `Bearer ${TOKEN}`);
    assertEquals(m?.views, 15230);
    assertEquals(m?.avgWatchTimeS, 37);
    assertEquals(m?.completionRate, 0.824);
    assertEquals(m?.shares, 56);
    // Analytics Data API kotasına sayılmaz.
    assertEquals(total(), 1);
  },
);

Deno.test(
  'fetchPostMetrics: Analytics boş → Data API sayaçları yine döner',
  async () => {
    const fake = createFakeFetch({
      videos,
      reports: () => json(analyticsEmpty),
    });
    const { ctx } = makeCtx(fake.fetch);
    const m = await youtubeCollector.fetchPostMetrics(ctx, post(24));
    assertEquals(m?.views, 15230);
    assertEquals(m?.avgWatchTimeS, null);
    assertEquals(m?.raw.analyticsState, 'empty');
  },
);

Deno.test(
  'fetchPostMetrics: token Analytics kapsamı içermiyorsa çağrılmaz',
  async () => {
    const fake = createFakeFetch({ videos });
    const { ctx, warnings } = makeCtx(fake.fetch, {
      scope: 'https://www.googleapis.com/auth/youtube.readonly',
    });
    const m = await youtubeCollector.fetchPostMetrics(ctx, post(72));
    assertEquals(fake.calls.length, 1);
    assertEquals(m?.raw.analyticsState, 'unavailable');
    assertEquals(warnings.length, 1);
  },
);

Deno.test(
  'fetchPostMetrics: Analytics 403 izin hatası → Data API ile devam',
  async () => {
    const fake = createFakeFetch({
      videos,
      reports: () => json(insufficient, 403),
    });
    const { ctx, warnings } = makeCtx(fake.fetch);
    const m = await youtubeCollector.fetchPostMetrics(ctx, post(72));
    assertEquals(m?.views, 15230);
    assertEquals(m?.raw.analyticsState, 'unavailable');
    assert(warnings[0].includes('403'));
  },
);

Deno.test(
  'fetchPostMetrics: Analytics 5xx/401 orkestratöre gider',
  async () => {
    const transient = createFakeFetch({
      videos,
      reports: () => json(backendError, 503),
    });
    await assertRejects(
      () =>
        youtubeCollector.fetchPostMetrics(
          makeCtx(transient.fetch).ctx,
          post(72),
        ),
      TransientError,
    );
    const auth = createFakeFetch({
      videos,
      reports: () => json(unauthorized, 401),
    });
    await assertRejects(
      () =>
        youtubeCollector.fetchPostMetrics(makeCtx(auth.fetch).ctx, post(72)),
      TokenExpiredError,
    );
  },
);

Deno.test('fetchPostMetrics: silinmiş video → null', async () => {
  const fake = createFakeFetch({ videos: () => json(videosEmpty) });
  const { ctx } = makeCtx(fake.fetch);
  assertEquals(await youtubeCollector.fetchPostMetrics(ctx, post(1)), null);
});

Deno.test(
  'hata eşleme: kota dolu → platform kapsamlı rate limit, mesajda token yok',
  async () => {
    const fake = createFakeFetch({ channels: () => json(quotaExceeded, 403) });
    const { ctx, total } = makeCtx(fake.fetch);
    const err = await assertRejects(
      () => youtubeCollector.fetchAccount(ctx),
      RateLimitedError,
    );
    assertEquals(err.scope, 'platform');
    assert(
      (err.retryAfterSeconds ?? 0) > 30,
      'kota sıfırlanana kadar beklenmez',
    );
    assert(!err.message.includes(TOKEN));
    assert(
      !err.message.includes('exceeded your quota'),
      'yanıt gövdesi mesajda yok',
    );
    assertEquals(total(), 1);
  },
);

// ── Orkestratörle uçtan uca (MemoryStore, sahte fetch) ──────────────────────

function setupStore() {
  const store = new MemoryStore();
  store.accounts.push({
    id: 'acc-yt',
    influencerId: 'inf-1',
    platform: 'youtube',
    handle: 'fixture',
    externalId: 'UCfixtureChannel000000001',
    status: 'active',
  });
  store.tokens.set('acc-yt', { accessToken: TOKEN, scope: ANALYTICS_SCOPE });
  return store;
}

Deno.test(
  "runSync: posts işi tekrar çalışınca duplicate yok, kota sync_runs'a",
  async () => {
    const store = setupStore();
    const fake = createFakeFetch({ channels, playlistItems: playlist, videos });
    const deps = {
      store,
      collectors,
      fetch: fake.fetch,
      now: () => NOW,
      sleep: () => Promise.resolve(),
      log: () => {},
    };
    await runSync('posts', deps);
    await runSync('posts', deps);
    assertEquals(store.posts.length, 3);
    assertEquals(
      store.posts.map((p) => [p.external_id, p.is_short, p.duration_s]),
      [
        ['vidShortV45', true, 45],
        ['vidLand2m', false, 120],
        ['vidLongForm1', false, 3723],
      ],
    );
    assertEquals(store.runs[0].status, 'succeeded');
    assertEquals(store.runs[0].quotaUnits, 4);
    // İkinci çalışma artımlı: since = en yeni post → tek sayfa.
    assertEquals(store.runs[1].quotaUnits, 3);
  },
);

Deno.test(
  "runSync: accounts işi total_views dahil hesap snapshot'ı yazar",
  async () => {
    const store = setupStore();
    const fake = createFakeFetch({ channels });
    await runSync('accounts', {
      store,
      collectors,
      fetch: fake.fetch,
      now: () => NOW,
      log: () => {},
    });
    assertEquals(store.accountSnapshots.length, 1);
    const snap = store.accountSnapshots[0];
    assertEquals(
      [snap.followers, snap.media_count, snap.total_views],
      [8910, 42, 1_234_567],
    );
    assertEquals(store.runs[0].quotaUnits, 1);
  },
);

Deno.test(
  'runSync: Analytics gecikmesi — 24 sa boş, 72 sa noktasında dolu; completion 0–1',
  async () => {
    const store = setupStore();
    const publishedAt = new Date(NOW.getTime() - 24 * 3_600_000 - 10 * 60_000);
    const dueBase = {
      postId: 'post-1',
      accountId: 'acc-yt',
      platform: 'youtube' as const,
      externalId: 'vidShortV45',
      publishedAt,
    };
    store.due.push({ ...dueBase, targetHours: 24 });
    const fake = createFakeFetch({
      videos,
      reports: [() => json(analyticsEmpty), () => json(analyticsReport)],
    });
    let now = NOW;
    const deps = {
      store,
      collectors,
      fetch: fake.fetch,
      now: () => now,
      log: () => {},
    };
    await runSync('metrics', deps);
    assertEquals(store.metrics.length, 1);
    assertEquals(store.metrics[0].views, 15230);
    assertEquals(store.metrics[0].avg_watch_time_s, null);
    assertEquals(store.metrics[0].completion_rate, null);

    now = new Date(publishedAt.getTime() + 72 * 3_600_000 + 5 * 60_000);
    store.due.push({ ...dueBase, targetHours: 72 });
    await runSync('metrics', deps);
    assertEquals(store.metrics.length, 2);
    const later = store.metrics[1];
    assertEquals(later.target_hours, 72);
    assertEquals(later.avg_watch_time_s, 37);
    assertEquals(later.completion_rate, 0.824);
    assert(later.completion_rate! >= 0 && later.completion_rate! <= 1);
    assertEquals(later.shares, 56);
    // saves/reach YouTube'da yok → ölçülmedi olarak işaretlenir.
    assertEquals(
      (later.raw_payload._unmeasured as string[]).includes('saves'),
      true,
    );
  },
);

Deno.test(
  'runSync: kota dolunca platformun diğer hesapları atlanır',
  async () => {
    const store = setupStore();
    store.accounts.push({
      ...store.accounts[0],
      id: 'acc-yt-2',
      externalId: 'UCsecond',
    });
    store.tokens.set('acc-yt-2', { accessToken: 'other-token' });
    const fake = createFakeFetch({ channels: () => json(quotaExceeded, 403) });
    const summary = await runSync('accounts', {
      store,
      collectors,
      fetch: fake.fetch,
      now: () => NOW,
      sleep: () => Promise.resolve(),
      log: () => {},
    });
    assertEquals(fake.calls.length, 1, 'kota dolunca tekrar denenmez');
    assertEquals(summary.runs[0].status, 'partial');
    assertEquals(summary.skipped, [
      { accountId: 'acc-yt-2', reason: 'rate_limited' },
    ]);
  },
);
