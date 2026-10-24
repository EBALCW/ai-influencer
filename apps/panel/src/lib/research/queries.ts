import 'server-only';
import type { Row } from '@ai-influencer/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ResearchQuery } from './schemas';

type Db = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const RESEARCH_PAGE_LIMIT = 500;

export type TrendItem = Row<'trends'> & {
  influencer: { name: string; slug: string } | null;
};
export type ResearchInfluencer = Pick<
  Row<'influencers'>,
  'id' | 'name' | 'slug'
>;
export type ResearchWorkspace = {
  trends: TrendItem[];
  /** Filtreden bağımsız arşiv sayıları. */
  totals: { all: number; strong: number; shortlisted: number; used: number };
  influencers: ResearchInfluencer[];
  selected: ResearchInfluencer | null;
  truncated: boolean;
};

/**
 * Filtrelenmiş trend sorgusu (sayfa + CSV dışa aktarma ortak). `inf` seçiliyse
 * global trendler + o influencer'a özel olanlar. Sıralama: puan (boşlar sonda),
 * kayıt tarihi veya izlenme.
 */
export function trendQuery(
  db: Db,
  filter: ResearchQuery,
  influencerId: string | null,
) {
  let query = db.from('trends').select('*, influencer:influencers(name, slug)');
  if (influencerId)
    query = query.or(`influencer_id.is.null,influencer_id.eq.${influencerId}`);
  if (filter.scope === 'global') query = query.is('influencer_id', null);
  if (filter.scope === 'specific')
    query = query.not('influencer_id', 'is', null);
  if (filter.status) query = query.eq('status', filter.status);
  if (filter.platform) query = query.eq('platform', filter.platform);
  if (filter.format) query = query.eq('format', filter.format);
  if (filter.min) query = query.gte('adaptation_score', filter.min);
  if (filter.sort === 'views')
    query = query.order('views', { ascending: false, nullsFirst: false });
  else if (filter.sort === 'recent')
    query = query.order('captured_on', { ascending: false });
  else
    query = query
      .order('adaptation_score', { ascending: false, nullsFirst: false })
      .order('views', { ascending: false, nullsFirst: false });
  return query.order('created_at', { ascending: false }).order('id');
}

export async function getResearchWorkspace(
  filter: ResearchQuery,
): Promise<ResearchWorkspace | null> {
  const db = await createSupabaseServerClient();
  const influencers = await db
    .from('influencers')
    .select('id, name, slug')
    .neq('status', 'archived')
    .order('name');
  if (influencers.error) throw new Error('Influencer listesi alınamadı.');
  const list = influencers.data ?? [];
  let selected: ResearchInfluencer | null = null;
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
  const counted = (status?: string, strong?: boolean) => {
    let query = db.from('trends').select('id', { count: 'exact', head: true });
    if (selected)
      query = query.or(`influencer_id.is.null,influencer_id.eq.${selected.id}`);
    if (status) query = query.eq('status', status);
    if (strong) query = query.gte('adaptation_score', 4);
    return query;
  };
  const [rows, all, strong, shortlisted, used] = await Promise.all([
    trendQuery(db, filter, selected?.id ?? null).limit(RESEARCH_PAGE_LIMIT + 1),
    counted(),
    counted(undefined, true),
    counted('shortlisted'),
    counted('used'),
  ]);
  for (const result of [rows, all, strong, shortlisted, used])
    if (result.error) throw new Error('Trend arşivi alınamadı.');
  const trends = (rows.data ?? []) as TrendItem[];
  return {
    trends: trends.slice(0, RESEARCH_PAGE_LIMIT),
    truncated: trends.length > RESEARCH_PAGE_LIMIT,
    totals: {
      all: all.count ?? 0,
      strong: strong.count ?? 0,
      shortlisted: shortlisted.count ?? 0,
      used: used.count ?? 0,
    },
    influencers: list,
    selected,
  };
}
