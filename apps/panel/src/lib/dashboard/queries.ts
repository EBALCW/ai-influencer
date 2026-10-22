import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DashboardFilter } from './metrics';
import { dashboardSchema } from './schema';

export async function getDashboard(filter: DashboardFilter) {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.rpc('dashboard_overview', {
    p_from: filter.from,
    p_to: filter.to,
    p_influencer_slug: filter.inf,
    p_platform: filter.platform === 'all' ? undefined : filter.platform,
  });
  if (error) {
    console.error('dashboard_query_failed', { code: error.code });
    throw new Error('Genel bakış verileri alınamadı.');
  }
  return dashboardSchema.parse(data);
}
