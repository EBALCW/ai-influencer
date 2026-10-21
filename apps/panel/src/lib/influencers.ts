import 'server-only';
import type { InfluencerStatus, Row } from '@ai-influencer/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type InfluencerListItem = Pick<
  Row<'influencers'>,
  'id' | 'name' | 'slug' | 'niche' | 'status' | 'avatar_asset_id'
> & {
  platforms: string[];
  followers: number;
  views7d: number;
};

export type InfluencerDetailData = {
  influencer: Row<'influencers'>;
  listItem: InfluencerListItem;
  accounts: Row<'social_accounts'>[];
  posts: Row<'posts'>[];
  generations: Row<'generations'>[];
  personas: Row<'influencer_personas'>[];
  prompts: Row<'prompts'>[];
  assets: Row<'assets'>[];
  costs: Row<'costs'>[];
};

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(`Influencer verisi alınamadı: ${error.message}`);
}

export async function getInfluencerOptions() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('influencers')
    .select('name, slug')
    .neq('status', 'archived')
    .order('name');
  throwOnError(error);
  return data ?? [];
}

type InfluencerStats = Pick<
  InfluencerListItem,
  'platforms' | 'followers' | 'views7d'
>;

/**
 * Takipçi, platform ve 7 günlük izlenme özetini veritabanında hesaplar
 * (`influencer_list_stats`, security invoker). Snapshot satırlarını çekip JS'te
 * toplamak `max_rows` sınırında sessizce eksik sonuç verirdi.
 */
async function getInfluencerStats(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  influencerIds: string[],
): Promise<Map<string, InfluencerStats>> {
  const stats = new Map<string, InfluencerStats>();
  if (!influencerIds.length) return stats;
  const { data, error } = await supabase.rpc('influencer_list_stats', {
    p_influencer_ids: influencerIds,
  });
  throwOnError(error);
  for (const row of data ?? []) {
    stats.set(row.influencer_id, {
      platforms: row.platforms ?? [],
      followers: Number(row.followers),
      views7d: Number(row.views_7d),
    });
  }
  return stats;
}

const emptyStats: InfluencerStats = { platforms: [], followers: 0, views7d: 0 };

function toListItem(
  influencer: Row<'influencers'>,
  stats: InfluencerStats | undefined,
): InfluencerListItem {
  return {
    id: influencer.id,
    name: influencer.name,
    slug: influencer.slug,
    niche: influencer.niche,
    status: influencer.status as InfluencerStatus,
    avatar_asset_id: influencer.avatar_asset_id,
    ...(stats ?? emptyStats),
  };
}

export async function getInfluencerList(options?: {
  includeArchived?: boolean;
}): Promise<InfluencerListItem[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from('influencers').select('*').order('name');
  if (!options?.includeArchived) query = query.neq('status', 'archived');
  const { data: influencers, error } = await query;
  throwOnError(error);
  const rows = influencers ?? [];
  const stats = await getInfluencerStats(
    supabase,
    rows.map((row) => row.id),
  );
  return rows.map((row) => toListItem(row, stats.get(row.id)));
}

export async function getInfluencerBySlug(
  slug: string,
): Promise<InfluencerDetailData | null> {
  const supabase = await createSupabaseServerClient();
  const { data: influencer, error } = await supabase
    .from('influencers')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  throwOnError(error);
  if (!influencer) return null;

  const [
    stats,
    accountsResult,
    generationsResult,
    personasResult,
    promptsResult,
    assetsResult,
    costsResult,
  ] = await Promise.all([
    getInfluencerStats(supabase, [influencer.id]),
    supabase
      .from('social_accounts')
      .select('*')
      .eq('influencer_id', influencer.id)
      .order('platform'),
    supabase
      .from('generations')
      .select('*')
      .eq('influencer_id', influencer.id)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('influencer_personas')
      .select('*')
      .eq('influencer_id', influencer.id)
      .order('version', { ascending: false }),
    supabase
      .from('prompts')
      .select('*')
      .eq('influencer_id', influencer.id)
      .order('category'),
    supabase
      .from('assets')
      .select('*')
      .eq('influencer_id', influencer.id)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('costs')
      .select('*')
      .eq('influencer_id', influencer.id)
      .order('incurred_on', { ascending: false })
      .limit(10),
  ]);
  for (const result of [
    accountsResult,
    generationsResult,
    personasResult,
    promptsResult,
    assetsResult,
    costsResult,
  ])
    throwOnError(result.error);
  const accounts = accountsResult.data ?? [];
  const accountIds = accounts.map((account) => account.id);
  const { data: posts, error: postsError } = accountIds.length
    ? await supabase
        .from('posts')
        .select('*')
        .in('account_id', accountIds)
        .order('published_at', { ascending: false })
        .limit(5)
    : { data: [], error: null };
  throwOnError(postsError);
  return {
    influencer,
    listItem: toListItem(influencer, stats.get(influencer.id)),
    accounts,
    posts: posts ?? [],
    generations: generationsResult.data ?? [],
    personas: personasResult.data ?? [],
    prompts: promptsResult.data ?? [],
    assets: assetsResult.data ?? [],
    costs: costsResult.data ?? [],
  };
}
