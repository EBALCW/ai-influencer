import type { PromptCategory } from '@ai-influencer/shared';
import type { createSupabaseServerClient } from '@/lib/supabase/server';
import type { PromptSource } from './prompts';
import type { AiTask } from './schemas';

/**
 * AI görevi → prompt kütüphanesi soyu (#46 ↔ #48).
 *
 * | Görev     | Kategori     | Anahtar (`key`) |
 * | --------- | ------------ | --------------- |
 * | `persona` | `character`  | `ai-persona`    |
 * | `caption` | `caption`    | `ai-caption`    |
 * | `script`  | `short_film` | `ai-script`     |
 * | `weekly`  | `research`   | `ai-weekly`     |
 *
 * Kategori tek başına yetmez: `character` ve `short_film` kategorilerinde görsel/video
 * üretim şablonları da durur, AI asistanına bunlardan biri talimat olarak gitmemeli.
 * Bu yüzden her görev sabit bir `key` ile eşlenir. Panelde başlık "AI Persona",
 * "AI Caption" … verilirse `toPromptKey` aynı anahtarı üretir.
 *
 * Seçim: influencer'a özel soy globalden önce gelir, soyun en yüksek versiyonu okunur.
 * Kütüphanede eşleşen prompt yoksa `null` döner ve kodaki yerleşik talimat
 * (`builtin:<görev>`) kullanılır. Okuma hatası yutulmaz.
 */
export const aiTaskPromptLineage: Record<
  AiTask,
  { category: PromptCategory; key: string }
> = {
  persona: { category: 'character', key: 'ai-persona' },
  caption: { category: 'caption', key: 'ai-caption' },
  script: { category: 'short_film', key: 'ai-script' },
  weekly: { category: 'research', key: 'ai-weekly' },
};

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export function libraryPromptSource(
  db: Supabase,
  influencerId: string,
): PromptSource {
  return async (task) => {
    const lineage = aiTaskPromptLineage[task];
    const { data, error } = await db
      .from('prompts')
      .select('id,version,body')
      .eq('category', lineage.category)
      .eq('key', lineage.key)
      .or(`influencer_id.eq.${influencerId},influencer_id.is.null`)
      .order('influencer_id', { ascending: true, nullsFirst: false })
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error('prompt_read');
    return data?.body.trim() ? data : null;
  };
}
