import 'server-only';
import type { Row, SocialPlatform } from '@ai-influencer/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { CheckpointHours } from './metrics';
import {
  postAnalyticsSchema,
  segmentsResultSchema,
  type PostAnalytics,
  type SegmentsResult,
} from './schemas';

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what} alınamadı: ${error.message}`);
}

export type Learning = Pick<
  Row<'learnings'>,
  'id' | 'body' | 'tags' | 'created_at' | 'post_id' | 'influencer_id'
>;

/** Post detayı; post yoksa veya kullanıcı göremiyorsa (RLS) null. */
export async function getPostAnalytics(
  postId: string,
  supabase?: Supabase,
): Promise<PostAnalytics | null> {
  const client = supabase ?? (await createSupabaseServerClient());
  const { data, error } = await client.rpc('post_analytics', {
    p_post_id: postId,
  });
  check(error, 'Post analitiği');
  if (data === null) return null;
  return postAnalyticsSchema.parse(data);
}

/** Layout'ta 404 kararı için hafif varlık kontrolü (stream başlamadan). */
export async function postExists(postId: string) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('posts')
    .select('id')
    .eq('id', postId)
    .maybeSingle();
  check(error, 'Post');
  return data !== null;
}

export async function getPostsForCompare(ids: readonly string[]) {
  const supabase = await createSupabaseServerClient();
  return Promise.all(ids.map((id) => getPostAnalytics(id, supabase)));
}

export async function getLearnings(filter: {
  postId?: string;
  influencerId?: string;
}): Promise<Learning[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from('learnings')
    .select('id, body, tags, created_at, post_id, influencer_id')
    .order('created_at', { ascending: false })
    .limit(50);
  if (filter.postId) query = query.eq('post_id', filter.postId);
  else if (filter.influencerId)
    query = query.eq('influencer_id', filter.influencerId);
  const { data, error } = await query;
  check(error, 'Öğrenimler');
  return data ?? [];
}

export type RecentPost = {
  id: string;
  caption: string;
  publishedAt: string | null;
  platform: SocialPlatform;
  handle: string;
  /** Kontrol noktası saati -> izlenme */
  views: Partial<Record<number, number>>;
};

export type AnalyticsOverview = {
  influencer: Pick<Row<'influencers'>, 'id' | 'name' | 'slug'> | null;
  validInfluencer: boolean;
  targetHours: CheckpointHours;
  segments: SegmentsResult;
  recent: RecentPost[];
  learnings: Learning[];
};

const RECENT_LIMIT = 50;

export async function getAnalyticsOverview(input: {
  slug?: string;
  targetHours: CheckpointHours;
}): Promise<AnalyticsOverview> {
  const supabase = await createSupabaseServerClient();
  let influencer: AnalyticsOverview['influencer'] = null;
  if (input.slug) {
    const { data, error } = await supabase
      .from('influencers')
      .select('id, name, slug')
      .eq('slug', input.slug)
      .maybeSingle();
    check(error, 'Influencer');
    influencer = data;
  }
  const validInfluencer = !input.slug || influencer !== null;

  const segmentsCall = supabase.rpc('post_segments', {
    p_influencer_slug: input.slug ?? undefined,
    p_target_hours: input.targetHours,
  });
  let postsQuery = supabase
    .from('posts')
    .select(
      'id, caption, published_at, social_accounts!inner(platform, handle, influencer_id)',
    )
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(RECENT_LIMIT);
  if (influencer)
    postsQuery = postsQuery.eq('social_accounts.influencer_id', influencer.id);

  const [segments, posts] = await Promise.all([segmentsCall, postsQuery]);
  check(segments.error, 'Segment analizi');
  check(posts.error, 'Postlar');
  const rows = validInfluencer ? (posts.data ?? []) : [];

  const views = new Map<string, Partial<Record<number, number>>>();
  if (rows.length) {
    const { data, error } = await supabase.rpc('post_checkpoint_views', {
      p_post_ids: rows.map((row) => row.id),
    });
    check(error, 'Kontrol noktaları');
    for (const item of data ?? []) {
      const entry = views.get(item.post_id) ?? {};
      entry[item.target_hours] = item.views;
      views.set(item.post_id, entry);
    }
  }

  return {
    influencer,
    validInfluencer,
    targetHours: input.targetHours,
    segments: segmentsResultSchema.parse(segments.data),
    recent: rows.map((row) => ({
      id: row.id,
      caption: row.caption,
      publishedAt: row.published_at,
      platform: row.social_accounts.platform,
      handle: row.social_accounts.handle,
      views: views.get(row.id) ?? {},
    })),
    learnings: validInfluencer
      ? await getLearnings({ influencerId: influencer?.id })
      : [],
  };
}
