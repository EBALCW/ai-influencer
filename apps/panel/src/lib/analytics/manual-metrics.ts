import { z } from 'zod';
import { isCheckpointHours } from './metrics';

// Elle metrik girişi (#52). API'si olmayan ya da Display API'nin vermediği metrikler
// (TikTok izlenme süresi, tamamlama, kaydetme, erişim) panelden girilir. Sunucu da
// aynı şemayla doğrular; veritabanı `record_manual_metrics()` RPC'siyle yazar.

const counter = z.number().int().nonnegative().max(1e12);
const optionalCounter = counter.nullable().optional();

export const manualMetricsSchema = z.object({
  /** Kontrol noktası (1, 5, 24, 72, 168 sa); null = şimdiki zamana ad-hoc ölçüm. */
  targetHours: z
    .number()
    .refine(isCheckpointHours, { error: 'Geçersiz kontrol noktası.' })
    .nullable(),
  views: counter,
  likes: counter,
  comments: counter,
  shares: counter,
  saves: optionalCounter,
  reach: optionalCounter,
  /** Ortalama izlenme süresi (sn). */
  avgWatchTimeS: z.number().nonnegative().max(86_400).nullable().optional(),
  /** Tamamlama oranı 0–1 (form yüzdeyi 100'e böler). */
  completionRate: z.number().min(0).max(1).nullable().optional(),
});
export type ManualMetricsInput = z.infer<typeof manualMetricsSchema>;

export const manualMetricsResultSchema = z.object({
  status: z.enum(['created', 'updated', 'conflict']),
  id: z.string().nullable(),
});
export type ManualMetricsResult = z.infer<typeof manualMetricsResultSchema>;

/** RPC argümanları; boş bırakılan isteğe bağlı alanlar gönderilmez (veritabanında NULL). */
export function toManualMetricsArgs(postId: string, input: ManualMetricsInput) {
  const args: {
    p_post_id: string;
    p_views: number;
    p_likes: number;
    p_comments: number;
    p_shares: number;
    p_target_hours?: number;
    p_saves?: number;
    p_reach?: number;
    p_avg_watch_time_s?: number;
    p_completion_rate?: number;
  } = {
    p_post_id: postId,
    p_views: input.views,
    p_likes: input.likes,
    p_comments: input.comments,
    p_shares: input.shares,
  };
  if (input.targetHours !== null) args.p_target_hours = input.targetHours;
  if (input.saves != null) args.p_saves = input.saves;
  if (input.reach != null) args.p_reach = input.reach;
  if (input.avgWatchTimeS != null)
    args.p_avg_watch_time_s = input.avgWatchTimeS;
  if (input.completionRate != null)
    args.p_completion_rate = input.completionRate;
  return args;
}
