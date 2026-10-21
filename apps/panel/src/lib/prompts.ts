import 'server-only';
import type { Database, Row } from '@ai-influencer/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type ViewRow<Name extends keyof Database['public']['Views']> =
  Database['public']['Views'][Name]['Row'];

export type PromptStats = Pick<
  ViewRow<'prompt_stats'>,
  'total' | 'succeeded' | 'failed' | 'pending' | 'success_rate' | 'avg_credits'
>;

export type PromptLineageItem = ViewRow<'prompt_lineages'> & {
  influencer: { name: string; slug: string } | null;
  stats: PromptStats | null;
};

export type PromptLineageDetail = {
  current: Row<'prompts'>;
  versions: Array<Row<'prompts'> & { stats: PromptStats | null }>;
  influencer: { id: string; name: string; slug: string } | null;
};

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(`Prompt verisi alınamadı: ${error.message}`);
}

async function getStats(
  supabase: Supabase,
  promptIds: string[],
): Promise<Map<string, PromptStats>> {
  const map = new Map<string, PromptStats>();
  if (!promptIds.length) return map;
  const { data, error } = await supabase
    .from('prompt_stats')
    .select('*')
    .in('prompt_id', promptIds);
  throwOnError(error);
  for (const row of data ?? []) if (row.prompt_id) map.set(row.prompt_id, row);
  return map;
}

/**
 * Her prompt soyunun en son versiyonu. `influencerId` verilirse global prompt'lar ve
 * yalnızca o influencer'a özel olanlar döner; başka influencer'ların prompt'ları dönmez.
 */
export async function listPromptLineages(options: {
  influencerId?: string | null;
}): Promise<PromptLineageItem[]> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from('prompt_lineages')
    .select('*')
    .order('category')
    .order('title');
  if (options.influencerId)
    query = query.or(
      `influencer_id.is.null,influencer_id.eq.${options.influencerId}`,
    );
  const { data, error } = await query;
  throwOnError(error);
  const rows = data ?? [];

  const influencerIds = [
    ...new Set(
      rows.map((row) => row.influencer_id).filter((id): id is string => !!id),
    ),
  ];
  const [stats, influencers] = await Promise.all([
    getStats(
      supabase,
      rows.map((row) => row.id).filter((id): id is string => !!id),
    ),
    influencerIds.length
      ? supabase
          .from('influencers')
          .select('id, name, slug')
          .in('id', influencerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  throwOnError(influencers.error);
  const byId = new Map(
    (influencers.data ?? []).map((item) => [item.id, item] as const),
  );

  return rows.map((row) => ({
    ...row,
    influencer: row.influencer_id
      ? (byId.get(row.influencer_id) ?? null)
      : null,
    stats: row.id ? (stats.get(row.id) ?? null) : null,
  }));
}

/** Bir versiyonun bağlı olduğu soydaki tüm versiyonlar (yeniden eskiye). */
export async function getPromptLineage(
  promptId: string,
): Promise<PromptLineageDetail | null> {
  const supabase = await createSupabaseServerClient();
  const { data: current, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('id', promptId)
    .maybeSingle();
  throwOnError(error);
  if (!current) return null;

  let versionsQuery = supabase
    .from('prompts')
    .select('*')
    .eq('category', current.category)
    .eq('key', current.key)
    .order('version', { ascending: false });
  versionsQuery = current.influencer_id
    ? versionsQuery.eq('influencer_id', current.influencer_id)
    : versionsQuery.is('influencer_id', null);

  const [versionsResult, influencerResult] = await Promise.all([
    versionsQuery,
    current.influencer_id
      ? supabase
          .from('influencers')
          .select('id, name, slug')
          .eq('id', current.influencer_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  throwOnError(versionsResult.error);
  throwOnError(influencerResult.error);
  const versions = versionsResult.data ?? [];
  const stats = await getStats(
    supabase,
    versions.map((version) => version.id),
  );

  return {
    current,
    versions: versions.map((version) => ({
      ...version,
      stats: stats.get(version.id) ?? null,
    })),
    influencer: influencerResult.data ?? null,
  };
}

/** `?inf=` seçimini influencer kimliğine çevirir; bulunamazsa `null`. */
export async function resolveInfluencerSlug(
  slug: string | undefined,
): Promise<{ id: string; name: string; slug: string } | null> {
  if (!slug) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('influencers')
    .select('id, name, slug')
    .eq('slug', slug)
    .maybeSingle();
  throwOnError(error);
  return data ?? null;
}

/** Kapsam ve üretim seçicileri için arşivlenmemiş influencer'lar (id + ad). */
export async function listInfluencerChoices(): Promise<
  Array<{ id: string; name: string; slug: string }>
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('influencers')
    .select('id, name, slug')
    .neq('status', 'archived')
    .order('name');
  throwOnError(error);
  return data ?? [];
}
