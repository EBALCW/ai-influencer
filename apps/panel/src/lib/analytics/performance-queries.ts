import 'server-only';
import type { Row } from '@ai-influencer/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  enrichPosts,
  performanceResultSchema,
  settingsFromValue,
  type AnalyticsSettings,
  type EnrichedPost,
} from './performance';

function check(error: { message: string } | null, what: string) {
  if (error) throw new Error(`${what} alınamadı: ${error.message}`);
}

/** Kayıtlı eşikler; kayıt yoksa issue #25 varsayılanları. */
export async function readAnalyticsSettings() {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from('app_settings')
    .select('value')
    .eq('key', 'analytics')
    .maybeSingle();
  check(error, 'Analitik eşikleri');
  return settingsFromValue(data?.value);
}

export const PERFORMANCE_POST_LIMIT = 200;

export type PerformanceOverview = {
  influencer: Pick<Row<'influencers'>, 'id' | 'name' | 'slug'> | null;
  validInfluencer: boolean;
  settings: AnalyticsSettings;
  settingsSaved: boolean;
  totalPosts: number;
  posts: EnrichedPost[];
};

export async function getPerformanceOverview(input: {
  slug?: string;
}): Promise<PerformanceOverview> {
  const db = await createSupabaseServerClient();
  const [{ settings, saved }, influencerResult] = await Promise.all([
    readAnalyticsSettings(),
    input.slug
      ? db
          .from('influencers')
          .select('id, name, slug')
          .eq('slug', input.slug)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  check(influencerResult.error, 'Influencer');
  const { data, error } = await db.rpc('post_performance', {
    p_influencer_slug: input.slug ?? undefined,
    p_baseline_posts: settings.baselinePosts,
    p_limit: PERFORMANCE_POST_LIMIT,
  });
  check(error, 'Performans verisi');
  const result = performanceResultSchema.parse(data);
  return {
    influencer: influencerResult.data,
    validInfluencer: result.validInfluencer,
    settings,
    settingsSaved: saved,
    totalPosts: result.totalPosts,
    posts: enrichPosts(result.posts, settings),
  };
}

/** Post detayındaki ses türü alanı için. */
export async function getPostSoundType(postId: string) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db
    .from('posts')
    .select('sound_type')
    .eq('id', postId)
    .maybeSingle();
  check(error, 'Ses türü');
  const value = data?.sound_type;
  return value === 'trend' || value === 'original' ? value : null;
}
