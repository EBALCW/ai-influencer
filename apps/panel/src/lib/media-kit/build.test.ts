import { describe, expect, it } from 'vitest';
import {
  AI_DISCLOSURE,
  NO_DATA,
  buildMediaKit,
  formatCount,
  formatPercent,
  formatSeconds,
  formatSigned,
  type MediaKitInput,
} from './build';

// supabase/seed.sql ile aynı demo veri (10 post, post başına bir ölçüm, takipçi ölçümü yok)
const IG = '20000000-0000-4000-8000-000000000001';
const YT = '20000000-0000-4000-8000-000000000002';
const seedMetrics: Array<[number, number, number, number, number, number]> = [
  // views, likes, comments, shares, saves, avg_watch_time_s
  [1200, 74, 8, 5, 11, 12.4],
  [980, 62, 6, 3, 4, 13.1],
  [1450, 91, 11, 7, 8, 10.8],
  [760, 39, 4, 2, 3, 14.5],
  [2100, 155, 17, 13, 15, 12.2],
  [3400, 210, 20, 18, 24, 18.2],
  [2850, 178, 15, 10, 18, 17.5],
  [1900, 105, 9, 8, 11, 12.8],
  [3200, 240, 21, 22, 29, 16.4],
  [2300, 165, 13, 12, 16, 15.6],
];
const n = (i: number) => String(i + 1).padStart(2, '0');

function seedInput(overrides: Partial<MediaKitInput> = {}): MediaKitInput {
  return {
    asOf: '2026-10-20T00:00:00Z',
    influencer: {
      name: 'Demo Creator',
      slug: 'demo-creator',
      niche: 'lifestyle',
      bio: null,
    },
    accounts: [
      { id: IG, platform: 'instagram', handle: '@demo.creator' },
      { id: YT, platform: 'youtube', handle: '@democreator' },
    ],
    accountSnapshots: [],
    posts: seedMetrics.map((_, i) => ({
      id: `post-${n(i)}`,
      account_id: i < 5 ? IG : YT,
      caption: `Demo post ${i + 1}`,
      url: `https://example.invalid/${i < 5 ? 'ig' : 'yt'}/${n(i)}`,
      published_at: `2026-10-${n(i)}T10:00:00Z`,
    })),
    metricSnapshots: seedMetrics.map(
      ([views, likes, comments, shares, saves, watch], i) => ({
        post_id: `post-${n(i)}`,
        captured_at: `2026-10-${n(i)}T11:00:00Z`,
        views,
        likes,
        comments,
        shares,
        saves,
        avg_watch_time_s: watch,
      }),
    ),
    ...overrides,
  };
}

describe('buildMediaKit (seed verisi)', () => {
  const kit = buildMediaKit(seedInput());

  it('içerik metrikleri gerçek ölçümlerden hesaplanır', () => {
    expect(kit.content).toEqual({
      postCount: 10,
      measuredPostCount: 10,
      avgViews: 2014, // 20140 / 10
      engagementRate: 8.35, // 1682 / 20140
      avgWatchTimeS: 14.4, // 143.5 / 10
    });
  });

  it('en iyi 3 içerik izlenmeye göre sıralanır', () => {
    expect(
      kit.topPosts.map((p) => [p.caption, p.views, p.engagementRate]),
    ).toEqual([
      ['Demo post 6', 3400, 8],
      ['Demo post 9', 3200, 9.75],
      ['Demo post 7', 2850, 7.75],
    ]);
    expect(kit.topPosts[0]).toMatchObject({
      platform: 'youtube',
      handle: '@democreator',
    });
  });

  it('takipçi ve kitle verisi yoksa uydurulmaz: null → "veri yok"', () => {
    expect(kit.followers.total).toBeNull();
    expect(kit.followers.change).toBeNull();
    expect(kit.followers.accounts.every((a) => a.followers === null)).toBe(
      true,
    );
    expect(kit.audience).toBeNull();
    expect(formatCount(kit.followers.total)).toBe(NO_DATA);
  });

  it('tarih aralığı ve AI açıklaması kitte yer alır', () => {
    expect(kit.period).toEqual({
      from: '2026-09-20T00:00:00.000Z',
      to: '2026-10-20T00:00:00.000Z',
      days: 30,
    });
    expect(kit.aiDisclosure).toBe(AI_DISCLOSURE);
    expect(AI_DISCLOSURE).toMatch(/yapay zekâ/);
  });
});

describe('buildMediaKit kuralları', () => {
  it('takipçi: hesap başına asOf öncesi son ölçüm; değişim dönem başına göre', () => {
    const kit = buildMediaKit(
      seedInput({
        accountSnapshots: [
          {
            account_id: IG,
            captured_at: '2026-09-15T00:00:00Z',
            followers: 900,
          },
          {
            account_id: IG,
            captured_at: '2026-10-19T00:00:00Z',
            followers: 1000,
          },
          // asOf sonrası: sayılmaz
          {
            account_id: IG,
            captured_at: '2026-10-21T00:00:00Z',
            followers: 99999,
          },
          {
            account_id: YT,
            captured_at: '2026-09-01T00:00:00Z',
            followers: 450,
          },
          {
            account_id: YT,
            captured_at: '2026-10-18T00:00:00Z',
            followers: 500,
          },
        ],
      }),
    );
    expect(kit.followers.total).toBe(1500);
    expect(kit.followers.change).toBe(150);
    expect(kit.followers.accounts[0]).toMatchObject({
      followers: 1000,
      capturedAt: '2026-10-19T00:00:00Z',
    });
  });

  it('bir hesap ölçümsüzse toplam null; başlangıç ölçümü yoksa değişim null', () => {
    const missingAccount = buildMediaKit(
      seedInput({
        accountSnapshots: [
          {
            account_id: IG,
            captured_at: '2026-10-19T00:00:00Z',
            followers: 1000,
          },
        ],
      }),
    );
    expect(missingAccount.followers.total).toBeNull();
    const noBaseline = buildMediaKit(
      seedInput({
        accountSnapshots: [
          {
            account_id: IG,
            captured_at: '2026-10-19T00:00:00Z',
            followers: 1000,
          },
          {
            account_id: YT,
            captured_at: '2026-10-18T00:00:00Z',
            followers: 500,
          },
        ],
      }),
    );
    expect(noBaseline.followers.total).toBe(1500);
    expect(noBaseline.followers.change).toBeNull();
  });

  it('dönem dışı ve ölçümsüz postlar ortalamaya girmez; son ölçüm kullanılır', () => {
    const kit = buildMediaKit(
      seedInput({
        posts: [
          {
            id: 'a',
            account_id: IG,
            caption: 'eski',
            url: null,
            published_at: '2026-08-01T00:00:00Z',
          },
          {
            id: 'b',
            account_id: IG,
            caption: 'yeni',
            url: null,
            published_at: '2026-10-10T00:00:00Z',
          },
          {
            id: 'c',
            account_id: IG,
            caption: 'ölçümsüz',
            url: null,
            published_at: '2026-10-11T00:00:00Z',
          },
          {
            id: 'd',
            account_id: IG,
            caption: 'taslak',
            url: null,
            published_at: null,
          },
        ],
        metricSnapshots: [
          {
            post_id: 'a',
            captured_at: '2026-10-10T00:00:00Z',
            views: 50000,
            likes: 0,
            comments: 0,
            shares: 0,
            saves: 0,
            avg_watch_time_s: null,
          },
          {
            post_id: 'b',
            captured_at: '2026-10-10T12:00:00Z',
            views: 100,
            likes: 10,
            comments: 0,
            shares: 0,
            saves: 0,
            avg_watch_time_s: null,
          },
          {
            post_id: 'b',
            captured_at: '2026-10-12T12:00:00Z',
            views: 400,
            likes: 20,
            comments: 0,
            shares: 0,
            saves: 0,
            avg_watch_time_s: '9.5',
          },
        ],
      }),
    );
    expect(kit.content).toEqual({
      postCount: 2,
      measuredPostCount: 1,
      avgViews: 400,
      engagementRate: 5,
      avgWatchTimeS: 9.5,
    });
  });

  it('hiç veri yoksa her metrik null', () => {
    const kit = buildMediaKit(
      seedInput({ accounts: [], posts: [], metricSnapshots: [] }),
    );
    expect(kit.followers.total).toBeNull();
    expect(kit.content).toMatchObject({
      avgViews: null,
      engagementRate: null,
      avgWatchTimeS: null,
    });
    expect(kit.topPosts).toEqual([]);
  });
});

describe('biçimlendirme', () => {
  it('Türkçe sayı biçimi ve veri yok', () => {
    expect(formatCount(12500)).toBe('12.500');
    expect(formatSigned(150)).toBe('+150');
    expect(formatSigned(-3)).toBe('-3');
    expect(formatPercent(8.35)).toBe('%8,35');
    expect(formatSeconds(14.4)).toBe('14,4 sn');
    expect(formatPercent(null)).toBe(NO_DATA);
  });
});
