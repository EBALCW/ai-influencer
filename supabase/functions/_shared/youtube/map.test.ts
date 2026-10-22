import { assert, assertEquals } from '@std/assert';
import {
  captionOf,
  detectShort,
  items,
  mapAnalyticsReport,
  mapChannel,
  mapMetrics,
  mapPlaylistItem,
  mapVideo,
  mapVideoStatistics,
  parseIsoDuration,
  toCount,
  uploadsPlaylistId,
} from './map.ts';
import channelStats from './fixtures/channels.statistics.json' with { type: 'json' };
import channelDetails from './fixtures/channels.contentDetails.json' with { type: 'json' };
import videoDetails from './fixtures/videos.details.json' with { type: 'json' };
import videoStats from './fixtures/videos.statistics.json' with { type: 'json' };
import playlistPage1 from './fixtures/playlistItems.page1.json' with { type: 'json' };
import analyticsReport from './fixtures/analytics.report.json' with { type: 'json' };
import analyticsLoop from './fixtures/analytics.looping-short.json' with { type: 'json' };
import analyticsEmpty from './fixtures/analytics.empty.json' with { type: 'json' };

Deno.test('parseIsoDuration: saat/dakika/saniye kombinasyonları', () => {
  const cases: [string, number | null][] = [
    ['PT45S', 45],
    ['PT1M5S', 65],
    ['PT2M30S', 150],
    ['PT10M', 600],
    ['PT2H', 7200],
    ['PT1H2M3S', 3723],
    ['PT1H3S', 3603],
    ['P1DT2H', 93_600],
    ['P1W', 604_800],
    ['PT1.5S', 1.5],
    ['PT0S', 0],
    ['P0D', 0],
    ['P', null],
    ['PT', null],
    ['1M5S', null],
    ['PT1M5', null],
    ['', null],
  ];
  for (const [input, expected] of cases) {
    assertEquals(parseIsoDuration(input), expected, input);
  }
  assertEquals(parseIsoDuration(undefined), null);
});

Deno.test('toCount: string sayaçlar, gizli/geçersiz değer null', () => {
  assertEquals(toCount('1234'), 1234);
  assertEquals(toCount(12), 12);
  assertEquals(toCount(''), null);
  assertEquals(toCount('-3'), null);
  assertEquals(toCount('abc'), null);
  assertEquals(toCount(undefined), null);
});

Deno.test('detectShort: süre ≤ 180 sn ve dikey; boyut yoksa ≤ 60 sn', () => {
  const v = { width: 360, height: 640 };
  const h = { width: 640, height: 360 };
  assert(detectShort({ durationS: 45, ...v }));
  assert(detectShort({ durationS: 180, ...v }));
  assert(!detectShort({ durationS: 181, ...v }));
  assert(!detectShort({ durationS: 45, ...h }));
  assert(detectShort({ durationS: 60, width: 500, height: 500 }), 'kare');
  assert(detectShort({ durationS: 60 }), 'boyutsuz 60 sn');
  assert(!detectShort({ durationS: 61 }), 'boyutsuz 61 sn');
  assert(!detectShort({ durationS: null, ...v }));
  assert(!detectShort({ durationS: 0, ...v }));
  assert(!detectShort({ durationS: 30, ...v, live: true }));
  // Eşik config'den gelir.
  assert(
    !detectShort(
      { durationS: 120, ...v },
      { maxDurationS: 60, fallbackDurationS: 60 },
    ),
  );
});

Deno.test('mapChannel: abone, video ve toplam görüntülenme', () => {
  const channel = items(channelStats)[0];
  assertEquals(mapChannel(channel), {
    followers: 8910,
    following: null,
    mediaCount: 42,
    totalViews: 1_234_567,
  });
});

Deno.test('mapChannel: gizli abone sayısı → 0 + uyarı', () => {
  const warnings: string[] = [];
  const out = mapChannel(
    { statistics: { hiddenSubscriberCount: true, videoCount: '3' } },
    (m) => warnings.push(m),
  );
  assertEquals(out.followers, 0);
  assertEquals(out.mediaCount, 3);
  assertEquals(out.totalViews, null);
  assertEquals(warnings.length, 1);
});

Deno.test('uploadsPlaylistId ve playlist öğeleri', () => {
  assertEquals(
    uploadsPlaylistId(items(channelDetails)[0]),
    'UUfixtureChannel000000001',
  );
  assertEquals(uploadsPlaylistId({}), null);
  const mapped = items(playlistPage1).map(mapPlaylistItem);
  assertEquals(mapped[0]?.videoId, 'vidShortV45');
  assertEquals(
    mapped[0]?.publishedAt?.toISOString(),
    '2026-10-21T18:30:00.000Z',
  );
  assertEquals(mapped[1], { videoId: 'vidPrivate01', publishedAt: null });
  assertEquals(mapPlaylistItem({}), null);
});

Deno.test('mapVideo: fixture → posts satırları ve Shorts tespiti', () => {
  const byId = new Map(
    items(videoDetails).map((v) => [String(v.id), mapVideo(v)]),
  );
  const expected: Record<string, { short: boolean; duration: number } | null> =
    {
      vidShortV45: { short: true, duration: 45 },
      vidShort2m30: { short: true, duration: 150 },
      vidLand2m: { short: false, duration: 120 },
      vidLongForm1: { short: false, duration: 3723 },
      vidNoDim50: { short: true, duration: 50 },
      vidNoDim90: { short: false, duration: 90 },
      vidLiveRep: { short: false, duration: 40 },
      vidPrivate01: null,
      vidUpcoming: null,
    };
  for (const [id, exp] of Object.entries(expected)) {
    const post = byId.get(id);
    if (exp === null) {
      assertEquals(post, null, id);
      continue;
    }
    assert(post, id);
    assertEquals(post.isShort, exp.short, `${id} is_short`);
    assertEquals(post.durationS, exp.duration, `${id} duration_s`);
    assertEquals(
      post.url,
      exp.short
        ? `https://www.youtube.com/shorts/${id}`
        : `https://www.youtube.com/watch?v=${id}`,
    );
  }
  const first = byId.get('vidShortV45');
  assertEquals(first?.caption, 'Kısa deneme #shorts\n\nAçıklama satırı');
  assertEquals(first?.publishedAt.toISOString(), '2026-10-21T18:30:00.000Z');
});

Deno.test('captionOf: başlık + açıklama, boş olanlar atlanır', () => {
  assertEquals(captionOf({ title: 'A', description: '' }), 'A');
  assertEquals(captionOf({ title: ' A ', description: ' B ' }), 'A\n\nB');
  assertEquals(captionOf({}), '');
});

Deno.test('mapMetrics: Data API + Analytics, completion_rate 0–1', () => {
  const stats = mapVideoStatistics(items(videoStats)[0]);
  assertEquals(
    { views: stats.views, likes: stats.likes, comments: stats.comments },
    { views: 15230, likes: 1204, comments: 87 },
  );
  const analytics = mapAnalyticsReport(analyticsReport);
  assertEquals(analytics?.averageViewPercentage, 82.4);
  const m = mapMetrics(stats, analytics, 'ok');
  assertEquals(m.views, 15230); // sayaç Data API'den
  assertEquals(m.likes, 1204);
  assertEquals(m.comments, 87);
  assertEquals(m.shares, 56);
  assertEquals(m.avgWatchTimeS, 37);
  assertEquals(m.completionRate, 0.824);
  assertEquals(m.saves, null);
  assertEquals(m.reach, null);
  assertEquals(m.raw.analyticsState, 'ok');
  assertEquals(
    (m.raw.analytics as Record<string, number>).subscribersGained,
    31,
  );
});

Deno.test(
  'mapMetrics: döngüdeki Short %100 üstü → 1, ham değer raw içinde',
  () => {
    const stats = mapVideoStatistics(items(videoStats)[0]);
    const m = mapMetrics(stats, mapAnalyticsReport(analyticsLoop), 'ok');
    assertEquals(m.completionRate, 1);
    assertEquals(
      (m.raw.analytics as Record<string, number>).averageViewPercentage,
      115.6,
    );
  },
);

Deno.test(
  'mapAnalyticsReport: satır yoksa null; mapMetrics Analytics alanlarını null bırakır',
  () => {
    assertEquals(mapAnalyticsReport(analyticsEmpty), null);
    assertEquals(mapAnalyticsReport({ columnHeaders: [], rows: [[]] }), null);
    const stats = mapVideoStatistics({ statistics: { viewCount: '5' } });
    const m = mapMetrics(stats, null, 'empty');
    assertEquals(m.views, 5);
    assertEquals(m.likes, null); // gizli beğeni sayısı → ölçülmedi
    assertEquals(m.avgWatchTimeS, null);
    assertEquals(m.completionRate, null);
    assertEquals(m.shares, null);
  },
);
