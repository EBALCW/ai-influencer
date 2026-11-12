import { describe, expect, it } from 'vitest';
import {
  analyticsSettingsSchema,
  classifyPost,
  completionApprox,
  defaultAnalyticsSettings,
  dimensionKeyLabel,
  durationBucket,
  earlyViews,
  enrichPosts,
  groupCounts,
  growth24Over1,
  medianSide,
  performanceResultSchema,
  performanceSegments,
  publishSlot,
  settingsFromValue,
  shareRate,
  shareSaveRate,
  type PerformancePost,
} from './performance';

function post(overrides: Partial<PerformancePost> = {}): PerformancePost {
  return {
    id: 'p1',
    caption: 'Test',
    url: null,
    publishedAt: '2026-09-01T10:00:00Z',
    platform: 'instagram',
    handle: '@test',
    durationS: 12,
    soundType: null,
    format: 'short_video',
    hookType: 'soru',
    checklistScore: null,
    publishHour: 13,
    views1: 400,
    views5: 800,
    views24: 2000,
    baselineMedian24: 1000,
    baselineMeasured: 10,
    latest: {
      capturedAt: '2026-09-02T10:00:00Z',
      hours: 24,
      views: 2000,
      reach: null,
      likes: 100,
      comments: 20,
      shares: 30,
      saves: 50,
      avgWatchTimeS: 6,
      completionRate: null,
    },
    ...overrides,
  };
}

const settings = defaultAnalyticsSettings;

describe('eşik ayarları', () => {
  it('varsayılanlar issue #25 önerisi: 5 sa < 300 takıldı, 3× patladı, son 10 video', () => {
    expect(settings).toEqual({
      stuckViews: 300,
      stuckWithinHours: 5,
      viralMultiplier: 3,
      baselinePosts: 10,
    });
  });
  it('geçersiz kayıtta varsayılana döner ve saved=false', () => {
    expect(settingsFromValue(null)).toEqual({ settings, saved: false });
    expect(settingsFromValue({ ...settings, stuckWithinHours: 3 }).saved).toBe(
      false,
    );
    expect(settingsFromValue({ ...settings, stuckViews: 500 })).toEqual({
      settings: { ...settings, stuckViews: 500 },
      saved: true,
    });
  });
  it('sınırları reddeder', () => {
    const bad = [
      { ...settings, stuckViews: 0 },
      { ...settings, stuckViews: 1.5 },
      { ...settings, viralMultiplier: 1 },
      { ...settings, baselinePosts: 2 },
      { ...settings, baselinePosts: 51 },
    ];
    for (const value of bad)
      expect(analyticsSettingsSchema.safeParse(value).success).toBe(false);
  });
});

describe('hesaplanan alanlar', () => {
  it('paylaşım, paylaşım+kayıt oranı ve 24/1 büyüme', () => {
    const p = post();
    expect(shareRate(p)).toBeCloseTo(0.015);
    expect(shareSaveRate(p)).toBeCloseTo(0.04);
    expect(growth24Over1(p)).toBe(5);
  });
  it('ölçüm yoksa veya payda 0 ise null (sıfır uydurulmaz)', () => {
    expect(shareRate(post({ latest: null }))).toBeNull();
    expect(growth24Over1(post({ views1: 0 }))).toBeNull();
    expect(growth24Over1(post({ views24: null }))).toBeNull();
  });
  it('tamamlanma: platform oranı öncelikli, yoksa ort. süre / video süresi', () => {
    expect(completionApprox(post())).toBeCloseTo(0.5);
    expect(
      completionApprox(
        post({ latest: { ...post().latest!, completionRate: 0.7 } }),
      ),
    ).toBe(0.7);
    expect(completionApprox(post({ durationS: null }))).toBeNull();
  });
  it('medyana göre üstünde / altında; kıyas yetersizse bilinmiyor', () => {
    expect(medianSide(post())).toEqual({ side: 'above', score: 2 });
    expect(medianSide(post({ views24: 999 })).side).toBe('below');
    expect(medianSide(post({ views24: 1000 })).side).toBe('above');
    expect(medianSide(post({ baselineMeasured: 2 })).side).toBe('unknown');
    expect(medianSide(post({ views24: null })).side).toBe('unknown');
  });
});

describe('gruplama', () => {
  it('ilk dalga penceresi 5 sa ise 5 sa, yoksa 1 sa ölçümü kullanılır', () => {
    expect(earlyViews(post(), settings)).toEqual({ hours: 5, views: 800 });
    expect(earlyViews(post({ views5: null }), settings)).toEqual({
      hours: 1,
      views: 400,
    });
    expect(earlyViews(post(), { ...settings, stuckWithinHours: 1 })).toEqual({
      hours: 1,
      views: 400,
    });
    expect(
      earlyViews(post({ views1: null, views5: null }), settings),
    ).toBeNull();
  });
  it('24 sa ≥ 3× medyan patladı; eşik dahil', () => {
    expect(classifyPost(post({ views24: 3000 }), settings)).toBe('viral');
    expect(classifyPost(post({ views24: 2999 }), settings)).toBe('normal');
  });
  it('ilk dalga eşiğin altındaysa takıldı', () => {
    expect(classifyPost(post({ views5: 299, views24: 500 }), settings)).toBe(
      'stuck',
    );
    expect(classifyPost(post({ views5: 300, views24: 500 }), settings)).toBe(
      'normal',
    );
  });
  it('geç açılan video patladı sayılır (takılmaya üstün)', () => {
    expect(classifyPost(post({ views5: 100, views24: 5000 }), settings)).toBe(
      'viral',
    );
  });
  it('kıyas en az 3 ölçülmüş post değilse patladı denmez', () => {
    expect(
      classifyPost(post({ views24: 99999, baselineMeasured: 2 }), settings),
    ).toBe('normal');
  });
  it('hiç ölçüm yoksa ölçüm bekliyor', () => {
    expect(
      classifyPost(
        post({ views1: null, views5: null, views24: null }),
        settings,
      ),
    ).toBe('pending');
  });
  it('eşik değişince grup değişir', () => {
    const p = post({ views5: 800, views24: 1500 });
    expect(classifyPost(p, settings)).toBe('normal');
    expect(classifyPost(p, { ...settings, stuckViews: 1000 })).toBe('stuck');
    expect(classifyPost(p, { ...settings, viralMultiplier: 1.5 })).toBe(
      'viral',
    );
  });
});

describe('segment tablosu', () => {
  it('süre aralıkları ve yayın slotu sınırları', () => {
    expect(durationBucket(null)).toBe('');
    expect(durationBucket(9.9)).toBe('lt10');
    expect(durationBucket(10)).toBe('10to30');
    expect(durationBucket(30)).toBe('30to60');
    expect(durationBucket(60)).toBe('gte60');
    expect(publishSlot(5)).toBe('night');
    expect(publishSlot(6)).toBe('morning');
    expect(publishSlot(12)).toBe('afternoon');
    expect(publishSlot(18)).toBe('evening');
  });
  it('etiketler: boş anahtar belirtilmemiş, check-list puanı /10', () => {
    expect(dimensionKeyLabel('sound_type', '')).toBe('Belirtilmemiş');
    expect(dimensionKeyLabel('sound_type', 'trend')).toBe('Trend ses');
    expect(dimensionKeyLabel('checklist_score', '8')).toBe('8/10');
    expect(dimensionKeyLabel('hook_type', 'merak')).toBe('merak');
  });
  it('grup dağılımı, medyan ve ortalamalar; medyana göre sıralı', () => {
    const posts = enrichPosts(
      [
        post({ id: 'a', soundType: 'trend', views24: 3000 }),
        post({ id: 'b', soundType: 'trend', views5: 100, views24: 200 }),
        post({ id: 'c', soundType: 'original', views24: 1500 }),
        post({
          id: 'd',
          soundType: null,
          views1: null,
          views5: null,
          views24: null,
          latest: null,
        }),
      ],
      settings,
    );
    expect(groupCounts(posts)).toEqual({
      stuck: 1,
      normal: 1,
      viral: 1,
      pending: 1,
    });
    const sound = performanceSegments(posts).find(
      (t) => t.dimension === 'sound_type',
    )!;
    expect(sound.label).toBe('Ses türü');
    expect(sound.rows.map((r) => r.key)).toEqual(['trend', 'original', '']);
    expect(sound.rows[0]).toMatchObject({
      posts: 2,
      viral: 1,
      stuck: 1,
      median24: 1600,
    });
    expect(sound.rows[0]!.avgEngagement).toBeCloseTo(0.1);
    expect(sound.rows[2]).toMatchObject({
      label: 'Belirtilmemiş',
      pending: 1,
      median24: null,
      avgEngagement: null,
    });
  });
  it('altı boyutun hepsi listelenir', () => {
    expect(
      performanceSegments(enrichPosts([post()], settings)).map(
        (t) => t.dimension,
      ),
    ).toEqual([
      'format',
      'hook_type',
      'duration',
      'publish_slot',
      'sound_type',
      'checklist_score',
    ]);
  });
});

describe('RPC çıktısı', () => {
  it('post_performance jsonb biçimini doğrular', () => {
    expect(
      performanceResultSchema.safeParse({
        validInfluencer: true,
        baselinePosts: 10,
        totalPosts: 1,
        posts: [post()],
      }).success,
    ).toBe(true);
    expect(
      performanceResultSchema.safeParse({
        validInfluencer: true,
        baselinePosts: 10,
        totalPosts: 1,
        posts: [{ ...post(), soundType: 'viral' }],
      }).success,
    ).toBe(false);
  });
});
