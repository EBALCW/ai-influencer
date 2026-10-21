import 'server-only';
import type { InfluencerStatus, Row } from '@ai-influencer/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sumSevenDayViews, type ViewSnapshot } from './influencer-metrics';

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

export async function getInfluencerList(options?: {
  includeArchived?: boolean;
}): Promise<InfluencerListItem[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase.from('influencers').select('*').order('name');
  if (!options?.includeArchived) query = query.neq('status', 'archived');
  const { data: influencers, error } = await query;
  throwOnError(error);
  const rows = influencers ?? [];
  if (!rows.length) return [];

  const influencerIds = rows.map((row) => row.id);
  const { data: accounts, error: accountsError } = await supabase
    .from('social_accounts')
    .select('*')
    .in('influencer_id', influencerIds);
  throwOnError(accountsError);
  const accountRows = accounts ?? [];
  const accountIds = accountRows.map((row) => row.id);
  const { data: accountSnapshots, error: snapshotsError } = accountIds.length
    ? await supabase
        .from('account_snapshots')
        .select('account_id, followers, captured_at')
        .in('account_id', accountIds)
        .order('captured_at', { ascending: false })
    : { data: [], error: null };
  throwOnError(snapshotsError);

  const { data: posts, error: postsError } = accountIds.length
    ? await supabase
        .from('posts')
        .select('id, account_id')
        .in('account_id', accountIds)
    : { data: [], error: null };
  throwOnError(postsError);
  const postRows = posts ?? [];
  const postIds = postRows.map((post) => post.id);
  const { data: metrics, error: metricsError } = postIds.length
    ? await supabase
        .from('metric_snapshots')
        .select('post_id, captured_at, views')
        .in('post_id', postIds)
    : { data: [], error: null };
  throwOnError(metricsError);

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return rows.map((influencer) => {
    const relatedAccounts = accountRows.filter(
      (account) => account.influencer_id === influencer.id,
    );
    const ids = new Set(relatedAccounts.map((account) => account.id));
    const latestFollowers = new Map<string, number>();
    for (const snapshot of accountSnapshots ?? []) {
      if (
        ids.has(snapshot.account_id) &&
        !latestFollowers.has(snapshot.account_id)
      ) {
        latestFollowers.set(snapshot.account_id, Number(snapshot.followers));
      }
    }
    const postIdsForInfluencer = new Set(
      postRows
        .filter((post) => ids.has(post.account_id))
        .map((post) => post.id),
    );
    const snapshotsByPost = new Map<string, ViewSnapshot[]>();
    for (const metric of metrics ?? []) {
      if (!postIdsForInfluencer.has(metric.post_id)) continue;
      const snapshots = snapshotsByPost.get(metric.post_id) ?? [];
      snapshots.push({
        captured_at: metric.captured_at,
        views: Number(metric.views),
      });
      snapshotsByPost.set(metric.post_id, snapshots);
    }
    return {
      id: influencer.id,
      name: influencer.name,
      slug: influencer.slug,
      niche: influencer.niche,
      status: influencer.status,
      avatar_asset_id: influencer.avatar_asset_id,
      platforms: [
        ...new Set(relatedAccounts.map((account) => account.platform)),
      ],
      followers: [...latestFollowers.values()].reduce(
        (sum, value) => sum + value,
        0,
      ),
      views7d: sumSevenDayViews(snapshotsByPost, since),
    };
  });
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
    list,
    accountsResult,
    generationsResult,
    personasResult,
    promptsResult,
    assetsResult,
    costsResult,
  ] = await Promise.all([
    getInfluencerList({ includeArchived: true }),
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
    listItem: list.find((item) => item.id === influencer.id) ?? {
      id: influencer.id,
      name: influencer.name,
      slug: influencer.slug,
      niche: influencer.niche,
      status: influencer.status as InfluencerStatus,
      avatar_asset_id: influencer.avatar_asset_id,
      platforms: accounts.map((account) => account.platform),
      followers: 0,
      views7d: 0,
    },
    accounts,
    posts: posts ?? [],
    generations: generationsResult.data ?? [],
    personas: personasResult.data ?? [],
    prompts: promptsResult.data ?? [],
    assets: assetsResult.data ?? [],
    costs: costsResult.data ?? [],
  };
}
