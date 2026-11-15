import 'server-only';
import { clipStatusLabels } from '@/lib/clips/schemas';
import { modeLabels, statusLabels } from '@/lib/generation-queue';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  episodeActivity,
  mergeActivity,
  summarizeMachines,
  type ActivityItem,
  type MachineSummary,
} from './activity';

export type HomeData = {
  counts: {
    series: number;
    episodes: number;
    clipSources: number;
    clips: number;
    influencers: number;
  };
  activity: ActivityItem[];
  machines: MachineSummary;
};

const PER_MODULE = 6;

/**
 * Ana ekranın verisi (#200). Kullanıcı oturumuyla okunur: RLS yalnız üyenin çalışma alanını
 * döndürür, viewer da okuyabilir. Yazma yok.
 */
export async function getHomeData(): Promise<HomeData> {
  const db = await createSupabaseServerClient();
  const count = { count: 'exact', head: true } as const;
  const [
    series,
    episodeCount,
    clipSources,
    clipCount,
    influencers,
    episodes,
    clips,
    generations,
    workers,
  ] = await Promise.all([
    db.from('series').select('id', count).eq('status', 'active'),
    db.from('episodes').select('id', count).is('archived_at', null),
    db.from('clip_sources').select('id', count),
    db.from('clips').select('id', count),
    db.from('influencers').select('id', count).neq('status', 'archived'),
    db
      .from('episodes')
      .select('id, title, status, episode_number, updated_at, series(name)')
      .order('updated_at', { ascending: false })
      .limit(PER_MODULE),
    db
      .from('clips')
      .select('id, title, status, created_at, source:clip_sources(title)')
      .order('created_at', { ascending: false })
      .limit(PER_MODULE),
    db
      .from('generations')
      .select(
        'id, mode, status, created_at, influencer:influencers(name, slug)',
      )
      .order('created_at', { ascending: false })
      .limit(PER_MODULE),
    db.from('production_workers').select('last_seen_at, revoked_at'),
  ]);
  for (const result of [
    series,
    episodeCount,
    clipSources,
    clipCount,
    influencers,
    episodes,
    clips,
    generations,
    workers,
  ])
    if (result.error) throw new Error('Ana ekran verisi alınamadı.');

  const clipItems: ActivityItem[] = (clips.data ?? []).map((row) => ({
    id: `clip:${row.id}`,
    module: 'clip',
    title: row.title,
    detail: row.source?.title ?? 'Yayıncı klibi',
    status: clipStatusLabels[row.status as keyof typeof clipStatusLabels],
    href: '/clips',
    at: row.created_at,
  }));
  const generationItems: ActivityItem[] = (generations.data ?? []).map(
    (row) => ({
      id: `generation:${row.id}`,
      module: 'influencer',
      title: `${modeLabels[row.mode as keyof typeof modeLabels] ?? 'Üretim'} üretimi`,
      detail: row.influencer?.name ?? 'AI influencer',
      status: statusLabels[row.status],
      href: row.influencer
        ? `/production?inf=${encodeURIComponent(row.influencer.slug)}`
        : '/production',
      at: row.created_at,
    }),
  );

  return {
    counts: {
      series: series.count ?? 0,
      episodes: episodeCount.count ?? 0,
      clipSources: clipSources.count ?? 0,
      clips: clipCount.count ?? 0,
      influencers: influencers.count ?? 0,
    },
    activity: mergeActivity([
      (episodes.data ?? []).map(episodeActivity),
      clipItems,
      generationItems,
    ]),
    machines: summarizeMachines(workers.data ?? [], new Date()),
  };
}
