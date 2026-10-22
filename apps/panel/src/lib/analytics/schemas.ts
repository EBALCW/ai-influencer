import { z } from 'zod';
import { CHECKPOINT_HOURS, isCheckpointHours } from './metrics';

// Postgres numeric/bigint JSON'da sayı olarak gelir; percentile_cont double döner.
const num = z.number();
const nullableNum = z.number().nullable();

const snapshotSchema = z.object({
  capturedAt: z.string(),
  hours: nullableNum,
  views: num,
  reach: nullableNum,
  likes: num,
  comments: num,
  shares: num,
  saves: num,
  avgWatchTimeS: nullableNum,
  completionRate: nullableNum,
});
export type Snapshot = z.infer<typeof snapshotSchema>;

const checkpointSchema = z.object({
  hours: num,
  views: nullableNum,
  median: nullableNum,
  average: nullableNum,
  measured: num,
});

export const postAnalyticsSchema = z.object({
  post: z.object({
    id: z.string(),
    caption: z.string(),
    url: z.string().nullable(),
    publishedAt: z.string().nullable(),
    durationS: nullableNum,
    isShort: z.boolean(),
    externalId: z.string().nullable(),
    accountId: z.string(),
    platform: z.enum(['instagram', 'youtube', 'tiktok']),
    handle: z.string(),
  }),
  influencer: z.object({ id: z.string(), slug: z.string(), name: z.string() }),
  content: z
    .object({
      id: z.string(),
      title: z.string(),
      format: z.string(),
      hookType: z.string().nullable(),
      stage: z.string(),
    })
    .nullable(),
  prompts: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      version: num,
      category: z.string(),
    }),
  ),
  snapshots: z.array(snapshotSchema),
  baselinePosts: num,
  checkpoints: z.array(checkpointSchema),
});
export type PostAnalytics = z.infer<typeof postAnalyticsSchema>;

const segmentSchema = z.object({
  dimension: z.string(),
  key: z.string(),
  posts: num,
  measured: num,
  median: nullableNum,
  average: nullableNum,
});

export const segmentsResultSchema = z.object({
  validInfluencer: z.boolean(),
  targetHours: num,
  overall: z.object({
    posts: num,
    measured: num,
    median: nullableNum,
    average: nullableNum,
  }),
  segments: z.array(segmentSchema),
});
export type SegmentsResult = z.infer<typeof segmentsResultSchema>;

/** `?h=` kontrol noktası; geçersiz veya eksikse 24 sa. */
export function parseTargetHours(value: string | string[] | undefined) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return isCheckpointHours(n) ? n : 24;
}
export const targetHourOptions = CHECKPOINT_HOURS;

/** `?ids=a,b,c`: 2–4 farklı post kimliği. */
export const compareIdsSchema = z
  .string({ error: 'Karşılaştırmak için post seçin.' })
  .transform((value) =>
    value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )
  .pipe(
    z
      .array(z.uuid({ error: 'Geçersiz post kimliği.' }))
      .min(2, { error: 'Karşılaştırma için en az 2 post seçin.' })
      .max(4, { error: 'En fazla 4 post karşılaştırılabilir.' })
      .refine((ids) => new Set(ids).size === ids.length, {
        error: 'Aynı post birden fazla kez seçilmiş.',
      }),
  );

export function parseCompareIds(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value.join(',') : value;
  const parsed = compareIdsSchema.safeParse(raw);
  return parsed.success
    ? ({ ok: true, ids: parsed.data } as const)
    : ({
        ok: false,
        error: parsed.error.issues[0]?.message ?? 'Geçersiz seçim.',
      } as const);
}

export const learningInputSchema = z
  .object({
    body: z.string().trim().min(1).max(2000),
    postId: z.uuid().optional(),
    influencerId: z.uuid().optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  })
  .refine((value) => value.postId || value.influencerId, {
    error: 'Öğrenim bir posta veya influencer’a bağlanmalı.',
  });
export type LearningInput = z.infer<typeof learningInputSchema>;
