import 'server-only';
import type { Row } from '@ai-influencer/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ClipsQuery } from './schemas';

export const CLIP_SOURCE_LIMIT = 200;

export type ClipItem = Row<'clips'> & {
  influencer: { name: string; slug: string } | null;
};
export type ClipSourceItem = Row<'clip_sources'> & { clips: ClipItem[] };
export type ClipInfluencer = Pick<Row<'influencers'>, 'id' | 'name' | 'slug'>;
export type ClipsWorkspace = {
  sources: ClipSourceItem[];
  influencers: ClipInfluencer[];
  /** `?inf=` ile seçilen influencer: yeni klip ve aktarımda varsayılan hedef. */
  selected: ClipInfluencer | null;
  truncated: boolean;
};

/** Kaynaklar (yeniden eskiye) ve klipleri (başlangıç saniyesine göre). RLS geçerlidir. */
export async function getClipsWorkspace(
  filter: ClipsQuery,
): Promise<ClipsWorkspace | null> {
  const db = await createSupabaseServerClient();
  const influencers = await db
    .from('influencers')
    .select('id, name, slug')
    .neq('status', 'archived')
    .order('name');
  if (influencers.error) throw new Error('Influencer listesi alınamadı.');
  const list = influencers.data ?? [];
  let selected: ClipInfluencer | null = null;
  if (filter.inf) {
    selected = list.find((item) => item.slug === filter.inf) ?? null;
    if (!selected) {
      // Arşivlenmiş influencer da seçilebilir; hiç yoksa sayfa 404.
      const { data, error } = await db
        .from('influencers')
        .select('id, name, slug')
        .eq('slug', filter.inf)
        .maybeSingle();
      if (error) throw new Error('Influencer okunamadı.');
      if (!data) return null;
      selected = data;
    }
  }
  const { data, error } = await db
    .from('clip_sources')
    .select('*, clips(*, influencer:influencers(name, slug))')
    .order('created_at', { ascending: false })
    .order('id')
    .order('start_seconds', { referencedTable: 'clips' })
    .order('id', { referencedTable: 'clips' })
    .limit(CLIP_SOURCE_LIMIT + 1);
  if (error) throw new Error('Klip kaynakları alınamadı.');
  const sources = (data ?? []) as ClipSourceItem[];
  return {
    sources: sources.slice(0, CLIP_SOURCE_LIMIT),
    truncated: sources.length > CLIP_SOURCE_LIMIT,
    influencers: list,
    selected,
  };
}
