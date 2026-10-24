import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ai-influencer/shared';

/** Ayarda değer yoksa kullanıcı başına günlük AI isteği üst sınırı. */
export const DEFAULT_AI_DAILY_LIMIT = 200;

/** UTC gün başlangıcı (ISO) ve bir sonraki güne kalan saniye. */
export function utcDay(now: Date): { start: string; secondsLeft: number } {
  const start = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return {
    start: new Date(start).toISOString(),
    secondsLeft: Math.max(
      1,
      Math.ceil((start + 86_400_000 - now.getTime()) / 1000),
    ),
  };
}

/**
 * Kalıcı (veritabanı) günlük sınır. Bellek içi dakika sınırı süreç yeniden başlayınca veya
 * birden çok sunucu örneğinde sıfırlanır; bu sınır bugünkü `ai_api` maliyet kayıtlarını
 * (her sağlayıcı çağrısı bir satır, `created_by` = oturumdaki kullanıcı) sayar.
 * Okuma hatasında istek reddedilir (sınır sessizce atlanmaz).
 */
export async function checkAiDailyCap(
  db: SupabaseClient<Database>,
  userId: string,
  limit: number = DEFAULT_AI_DAILY_LIMIT,
  now: Date = new Date(),
): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const day = utcDay(now);
  const { count, error } = await db
    .from('costs')
    .select('id', { count: 'exact', head: true })
    .eq('category', 'ai_api')
    .eq('created_by', userId)
    .gte('created_at', day.start);
  if (error || count === null) throw new Error('ai_daily_cap_read');
  return count >= limit
    ? { ok: false, retryAfterSeconds: day.secondsLeft }
    : { ok: true };
}
