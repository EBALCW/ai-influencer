/**
 * Performans takibi (#24) ve ilk test dalgası analizi (#25) için saf hesaplar.
 * Ham değerler `post_performance()` RPC'sinden gelir (kontrol noktası izlenmeleri,
 * son ölçüm, aynı hesabın önceki son k postunun 24 sa medyanı). Burada yalnız oran,
 * grup (takıldı / normal / patladı) ve segment tablosu üretilir.
 */
import { z } from 'zod';
import {
  engagementRate,
  median,
  MIN_BASELINE_POSTS,
  performanceScore,
} from './metrics';

// ---------- Eşikler (app_settings.analytics) ----------

export const analyticsSettingsSchema = z.object({
  /** İlk dalgada bu değerin altı = takıldı */
  stuckViews: z.number().int().min(1).max(100_000_000),
  /** İlk dalga penceresi: 1 sa veya 5 sa kontrol noktası */
  stuckWithinHours: z.union([z.literal(1), z.literal(5)]),
  /** 24 sa izlenme >= hesap medyanı × bu çarpan = patladı */
  viralMultiplier: z.number().min(1.1).max(100),
  /** Kıyas grubu: aynı hesabın önceki son N postu */
  baselinePosts: z.number().int().min(3).max(50),
});
export type AnalyticsSettings = z.infer<typeof analyticsSettingsSchema>;

/** Issue #25 önerisi: ilk 5 saatte < 300 izlenme takıldı, 24 sa ≥ 3× medyan patladı. */
export const defaultAnalyticsSettings: AnalyticsSettings = {
  stuckViews: 300,
  stuckWithinHours: 5,
  viralMultiplier: 3,
  baselinePosts: 10,
};

/** Kayıtlı değer okunamazsa varsayılan döner; `saved` bunu ayırt eder. */
export function settingsFromValue(value: unknown) {
  const parsed = analyticsSettingsSchema.safeParse(value);
  return parsed.success
    ? { settings: parsed.data, saved: true }
    : { settings: defaultAnalyticsSettings, saved: false };
}

// ---------- RPC çıktısı ----------

const nullableNum = z.number().nullable();

export const performancePostSchema = z.object({
  id: z.string(),
  caption: z.string(),
  url: z.string().nullable(),
  publishedAt: z.string(),
  platform: z.enum(['instagram', 'youtube', 'tiktok']),
  handle: z.string(),
  durationS: nullableNum,
  soundType: z.enum(['trend', 'original']).nullable(),
  format: z.string().nullable(),
  hookType: z.string().nullable(),
  checklistScore: nullableNum,
  publishHour: z.number().int().min(0).max(23),
  views1: nullableNum,
  views5: nullableNum,
  views24: nullableNum,
  baselineMedian24: nullableNum,
  baselineMeasured: z.number().int().nonnegative(),
  latest: z
    .object({
      capturedAt: z.string(),
      hours: nullableNum,
      views: z.number(),
      reach: nullableNum,
      likes: z.number(),
      comments: z.number(),
      shares: z.number(),
      saves: z.number(),
      avgWatchTimeS: nullableNum,
      completionRate: nullableNum,
    })
    .nullable(),
});
export type PerformancePost = z.infer<typeof performancePostSchema>;

export const performanceResultSchema = z.object({
  validInfluencer: z.boolean(),
  baselinePosts: z.number().int(),
  totalPosts: z.number().int().nonnegative(),
  posts: z.array(performancePostSchema),
});
export type PerformanceResult = z.infer<typeof performanceResultSchema>;

// ---------- Hesaplanan alanlar ----------

function ratio(
  part: number | null | undefined,
  whole: number | null | undefined,
) {
  if (part == null || whole == null || whole <= 0) return null;
  return part / whole;
}

/** Paylaşım oranı = paylaşım / izlenme. */
export function shareRate(post: Pick<PerformancePost, 'latest'>) {
  return ratio(post.latest?.shares, post.latest?.views);
}

/** Paylaşım + kaydetme oranı (#25 ilk dalga metriği). */
export function shareSaveRate(post: Pick<PerformancePost, 'latest'>) {
  const l = post.latest;
  return l ? ratio(l.shares + l.saves, l.views) : null;
}

/** 24 sa / 1 sa büyüme katsayısı. 1 sa ölçümü 0 veya yoksa null. */
export function growth24Over1(
  post: Pick<PerformancePost, 'views1' | 'views24'>,
) {
  return ratio(post.views24, post.views1);
}

/**
 * Tamamlanma oranı: platform verdiyse o; yoksa ort. izlenme süresi / video süresi
 * (yaklaşık; döngüde 1'i geçebilir).
 */
export function completionApprox(
  post: Pick<PerformancePost, 'latest' | 'durationS'>,
) {
  const l = post.latest;
  if (!l) return null;
  if (l.completionRate != null) return l.completionRate;
  return ratio(l.avgWatchTimeS, post.durationS);
}

function hasBaseline(post: PerformancePost) {
  return (
    post.baselineMedian24 != null &&
    post.baselineMedian24 > 0 &&
    post.baselineMeasured >= MIN_BASELINE_POSTS
  );
}

export type MedianSide = 'above' | 'below' | 'unknown';
export const medianSideLabels: Record<MedianSide, string> = {
  above: 'Üstünde',
  below: 'Altında',
  unknown: 'Kıyas yok',
};

/** 24 sa izlenme, hesabın son k postunun 24 sa medyanının üstünde mi? */
export function medianSide(post: PerformancePost): {
  side: MedianSide;
  score: number | null;
} {
  if (post.views24 == null || !hasBaseline(post))
    return { side: 'unknown', score: null };
  return {
    side: post.views24 >= post.baselineMedian24! ? 'above' : 'below',
    score: performanceScore(post.views24, post.baselineMedian24),
  };
}

// ---------- Gruplama (#25) ----------

export const PERFORMANCE_GROUPS = [
  'stuck',
  'normal',
  'viral',
  'pending',
] as const;
export type PerformanceGroup = (typeof PERFORMANCE_GROUPS)[number];
export const groupLabels: Record<PerformanceGroup, string> = {
  stuck: 'Takıldı',
  normal: 'Normal',
  viral: 'Patladı',
  pending: 'Ölçüm bekliyor',
};

/** Kabul kriteri: tek videodan genelleme yapma, en az 10 video analiz edilsin. */
export const MIN_ANALYZED_POSTS = 10;

/** İlk dalga ölçümü: pencere 5 sa ise 5 sa (yoksa 1 sa), 1 sa ise 1 sa. */
export function earlyViews(post: PerformancePost, settings: AnalyticsSettings) {
  if (settings.stuckWithinHours === 5 && post.views5 != null)
    return { hours: 5, views: post.views5 };
  if (post.views1 != null) return { hours: 1, views: post.views1 };
  return null;
}

/**
 * Patladı: 24 sa izlenme >= kıyas medyanı × çarpan (en az 3 ölçülmüş kıyas postu).
 * Takıldı: ilk dalga izlenmesi eşiğin altında. Patlama takılmaya üstün gelir
 * (geç açılan video). Hiç ölçüm yoksa "ölçüm bekliyor".
 */
export function classifyPost(
  post: PerformancePost,
  settings: AnalyticsSettings,
): PerformanceGroup {
  if (
    post.views24 != null &&
    hasBaseline(post) &&
    post.views24 >= post.baselineMedian24! * settings.viralMultiplier
  )
    return 'viral';
  const early = earlyViews(post, settings);
  if (early && early.views < settings.stuckViews) return 'stuck';
  if (early || post.views24 != null) return 'normal';
  return 'pending';
}

export type EnrichedPost = PerformancePost & {
  group: PerformanceGroup;
  engagementRate: number | null;
  shareRate: number | null;
  shareSaveRate: number | null;
  growth: number | null;
  completion: number | null;
  side: MedianSide;
  score: number | null;
};

export function enrichPosts(
  posts: readonly PerformancePost[],
  settings: AnalyticsSettings,
): EnrichedPost[] {
  return posts.map((post) => {
    const { side, score } = medianSide(post);
    return {
      ...post,
      group: classifyPost(post, settings),
      engagementRate: engagementRate(post.latest),
      shareRate: shareRate(post),
      shareSaveRate: shareSaveRate(post),
      growth: growth24Over1(post),
      completion: completionApprox(post),
      side,
      score,
    };
  });
}

export function groupCounts(posts: readonly { group: PerformanceGroup }[]) {
  const counts = { stuck: 0, normal: 0, viral: 0, pending: 0 };
  for (const post of posts) counts[post.group] += 1;
  return counts;
}

// ---------- Segment tablosu (#25) ----------

export const PERFORMANCE_DIMENSIONS = [
  'format',
  'hook_type',
  'duration',
  'publish_slot',
  'sound_type',
  'checklist_score',
] as const;
export type PerformanceDimension = (typeof PERFORMANCE_DIMENSIONS)[number];

export const performanceDimensionLabels: Record<PerformanceDimension, string> =
  {
    format: 'Format',
    hook_type: 'Kanca türü',
    duration: 'Süre aralığı',
    publish_slot: 'Yayın slotu',
    sound_type: 'Ses türü',
    checklist_score: 'Check-list puanı',
  };

const fixedLabels: Partial<
  Record<PerformanceDimension, Record<string, string>>
> = {
  format: { short_video: 'Kısa video' },
  duration: {
    lt10: '10 sn altı',
    '10to30': '10–30 sn',
    '30to60': '30–60 sn',
    gte60: '60 sn ve üstü',
  },
  publish_slot: {
    night: 'Gece (00–06)',
    morning: 'Sabah (06–12)',
    afternoon: 'Öğleden sonra (12–18)',
    evening: 'Akşam (18–24)',
  },
  sound_type: { trend: 'Trend ses', original: 'Orijinal ses' },
};

/** #25 süre aralıkları: < 10 sn / 10–30 / 30–60 / 60+. */
export function durationBucket(seconds: number | null) {
  if (seconds == null) return '';
  if (seconds < 10) return 'lt10';
  if (seconds < 30) return '10to30';
  if (seconds < 60) return '30to60';
  return 'gte60';
}

export function publishSlot(hour: number) {
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function dimensionKey(
  post: PerformancePost,
  dimension: PerformanceDimension,
) {
  switch (dimension) {
    case 'format':
      return post.format?.trim() ?? '';
    case 'hook_type':
      return post.hookType?.trim() ?? '';
    case 'duration':
      return durationBucket(post.durationS);
    case 'publish_slot':
      return publishSlot(post.publishHour);
    case 'sound_type':
      return post.soundType ?? '';
    case 'checklist_score':
      return post.checklistScore == null ? '' : String(post.checklistScore);
  }
}

export function dimensionKeyLabel(
  dimension: PerformanceDimension,
  key: string,
) {
  if (!key) return 'Belirtilmemiş';
  if (dimension === 'checklist_score') return `${key}/10`;
  return fixedLabels[dimension]?.[key] ?? key;
}

export type PerformanceSegmentRow = {
  key: string;
  label: string;
  posts: number;
  stuck: number;
  normal: number;
  viral: number;
  pending: number;
  median24: number | null;
  avgEngagement: number | null;
  avgShareSave: number | null;
};

function average(values: ReadonlyArray<number | null>) {
  const list = values.filter((v): v is number => v != null);
  return list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
}

/**
 * Boyut başına segment tablosu: grup dağılımı, medyan 24 sa izlenme ve ortalama
 * oranlar. Satırlar medyana göre (büyükten küçüğe, ölçümsüzler sonda) sıralanır.
 */
export function performanceSegments(posts: readonly EnrichedPost[]) {
  return PERFORMANCE_DIMENSIONS.map((dimension) => {
    const buckets = new Map<string, EnrichedPost[]>();
    for (const post of posts) {
      const key = dimensionKey(post, dimension);
      buckets.set(key, [...(buckets.get(key) ?? []), post]);
    }
    const rows: PerformanceSegmentRow[] = [...buckets.entries()]
      .map(([key, list]) => ({
        key,
        label: dimensionKeyLabel(dimension, key),
        posts: list.length,
        ...groupCounts(list),
        median24: median(list.map((p) => p.views24)),
        avgEngagement: average(list.map((p) => p.engagementRate)),
        avgShareSave: average(list.map((p) => p.shareSaveRate)),
      }))
      .sort((a, b) => {
        if (a.median24 === null && b.median24 === null)
          return a.label.localeCompare(b.label, 'tr');
        if (a.median24 === null) return 1;
        if (b.median24 === null) return -1;
        return b.median24 - a.median24 || a.label.localeCompare(b.label, 'tr');
      });
    return {
      dimension,
      label: performanceDimensionLabels[dimension],
      rows,
    };
  });
}

export const soundTypeSchema = z.enum(['trend', 'original']).nullable();
