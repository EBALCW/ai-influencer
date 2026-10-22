import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ai-influencer/shared';

type PostCostRow =
  Database['public']['Functions']['post_cost']['Returns'][number];

/**
 * Bir postun maliyeti (`post_cost()` SQL fonksiyonu, #59).
 * - `direct`: postun içeriğine (content_item_assets) bağlı üretimlerin maliyet toplamı.
 * - `average`: bağlı üretim yok; postun yayın ayındaki influencer ortalaması (video başına).
 * `total` null ise kuru eksik kayıt var (`missingRateCount` > 0) veya dönemde video yok;
 * panel "eksik kur" / "—" göstermeli, 0 yazmamalı.
 */
export type PostCost = {
  postId: string;
  allocation: 'direct' | 'average';
  total: string | null;
  currency: string;
  entryCount: number;
  missingRateCount: number;
  generationCount: number;
};

/** Supabase numeric'i number veya string döndürebilir; gösterim katmanı string bekler. */
const dec = (value: number | string | null | undefined) =>
  value === null || value === undefined ? null : String(value);

export function toPostCost(row: PostCostRow): PostCost {
  if (row.allocation !== 'direct' && row.allocation !== 'average')
    throw new Error(`Bilinmeyen maliyet dağıtımı: ${row.allocation}`);
  return {
    postId: row.post_id,
    allocation: row.allocation,
    total: dec(row.total),
    currency: row.currency,
    entryCount: row.entry_count,
    missingRateCount: row.missing_rate_count,
    generationCount: row.generation_count,
  };
}

/**
 * Post maliyetini kullanıcının oturumuyla (RLS) okur. Post görünmüyorsa
 * (yok veya ekip dışı) `null` döner. Dashboard (#54) ve post detayı (#55) için.
 *
 * @example
 *   const supabase = await createSupabaseServerClient();
 *   const cost = await getPostCost(supabase, postId, 'USD');
 */
export async function getPostCost(
  supabase: SupabaseClient<Database>,
  postId: string,
  currency: string,
): Promise<PostCost | null> {
  const { data, error } = await supabase
    .rpc('post_cost', { p_post_id: postId, p_currency: currency })
    .maybeSingle();
  if (error) throw new Error('Post maliyeti alınamadı.');
  return data ? toPostCost(data) : null;
}
