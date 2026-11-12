import 'server-only';
import type { Row } from '@ai-influencer/shared';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function throwOnError(error: { message: string } | null) {
  if (error) throw new Error(`Üretim verisi alınamadı: ${error.message}`);
}

const kindLabels: Record<Row<'assets'>['kind'], string> = {
  reference: 'Referans',
  generated: 'Üretilen',
  final_video: 'Final video',
  thumbnail: 'Kapak',
};

/** Üretim formunda referans olarak seçilebilecek görsel/video dosyaları. */
export async function listReferenceAssets(
  supabase: Supabase,
  influencerIds: string[],
) {
  if (!influencerIds.length) return [];
  const { data, error } = await supabase
    .from('assets')
    .select('id, influencer_id, kind, storage_path, mime_type, version_tag')
    .in('influencer_id', influencerIds)
    .or('mime_type.like.image/%,mime_type.like.video/%')
    .order('created_at', { ascending: false })
    .limit(300);
  throwOnError(error);
  return (data ?? []).map((asset) => ({
    id: asset.id,
    influencerId: asset.influencer_id ?? '',
    mimeType: asset.mime_type ?? '',
    label: `${kindLabels[asset.kind]} · ${
      asset.version_tag || asset.storage_path.split('/').pop()
    }`,
  }));
}

export type QueueItem = Pick<
  Row<'generations'>,
  | 'id'
  | 'influencer_id'
  | 'prompt_id'
  | 'mode'
  | 'status'
  | 'progress'
  | 'error'
  | 'attempts'
  | 'max_attempts'
  | 'credits'
  | 'cost_usd'
  | 'estimated_cost_usd'
  | 'created_at'
  | 'finished_at'
  | 'output_asset_id'
  | 'retry_of'
  | 'cancel_requested_at'
> & {
  influencer: { name: string; slug: string } | null;
  promptTitle: string | null;
};

/** Son üretimler (en yeni önce). `influencerId` verilirse sadece o influencer. */
export async function listQueue(
  supabase: Supabase,
  influencerId: string | null,
  limit = 100,
): Promise<QueueItem[]> {
  let query = supabase
    .from('generations')
    .select(
      'id, influencer_id, prompt_id, mode, status, progress, error, attempts, max_attempts, credits, cost_usd, estimated_cost_usd, created_at, finished_at, output_asset_id, retry_of, cancel_requested_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);
  if (influencerId) query = query.eq('influencer_id', influencerId);
  const { data, error } = await query;
  throwOnError(error);
  const rows = data ?? [];

  const influencerIds = [...new Set(rows.map((row) => row.influencer_id))];
  const promptIds = [
    ...new Set(rows.flatMap((row) => (row.prompt_id ? [row.prompt_id] : []))),
  ];
  const [influencers, prompts] = await Promise.all([
    influencerIds.length
      ? supabase
          .from('influencers')
          .select('id, name, slug')
          .in('id', influencerIds)
      : Promise.resolve({ data: [], error: null }),
    promptIds.length
      ? supabase.from('prompts').select('id, title').in('id', promptIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  throwOnError(influencers.error);
  throwOnError(prompts.error);
  const infMap = new Map((influencers.data ?? []).map((row) => [row.id, row]));
  const promptMap = new Map((prompts.data ?? []).map((row) => [row.id, row]));

  return rows.map((row) => {
    const inf = infMap.get(row.influencer_id);
    return {
      ...row,
      influencer: inf ? { name: inf.name, slug: inf.slug } : null,
      promptTitle: row.prompt_id
        ? (promptMap.get(row.prompt_id)?.title ?? null)
        : null,
    };
  });
}

export async function getWorkerStatus(supabase: Supabase) {
  const { data, error } = await supabase
    .from('generation_worker_status')
    .select('last_run_at, providers, message')
    .maybeSingle();
  throwOnError(error);
  return data ?? null;
}
