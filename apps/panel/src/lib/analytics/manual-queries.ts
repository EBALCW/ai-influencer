import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type ManualSnapshot = {
  id: string;
  targetHours: number | null;
  capturedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number | null;
  avgWatchTimeS: number | null;
  completionRate: number | null;
};

/** Postun elle girilmiş ölçümleri (`metric_snapshots.source = 'manual'`, #52). */
export async function getManualSnapshots(
  postId: string,
): Promise<ManualSnapshot[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('metric_snapshots')
    .select(
      'id, target_hours, captured_at, views, likes, comments, shares, saves, reach, avg_watch_time_s, completion_rate',
    )
    .eq('post_id', postId)
    .eq('source', 'manual')
    .order('captured_at', { ascending: true })
    .limit(50);
  if (error)
    throw new Error(`Elle girilen ölçümler alınamadı: ${error.message}`);
  return (data ?? []).map((r) => ({
    id: r.id,
    targetHours: r.target_hours,
    capturedAt: r.captured_at,
    views: r.views,
    likes: r.likes,
    comments: r.comments,
    shares: r.shares,
    saves: r.saves,
    reach: r.reach,
    avgWatchTimeS: r.avg_watch_time_s,
    completionRate: r.completion_rate,
  }));
}
