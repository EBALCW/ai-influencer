import 'server-only';
import type { createSupabaseServerClient } from '@/lib/supabase/server';
import type { AlertItem } from './format';

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type AlertList = { alerts: AlertItem[]; unread: number };

/**
 * Son uyarılar ve oturumdaki kullanıcının okunmamış sayısı. RLS uygulanır:
 * `alert_reads` gömülü kaydı yalnız kullanıcının kendi okundu kaydını döndürür.
 */
export async function listAlerts(
  db: Supabase,
  limit: number,
): Promise<AlertList> {
  const [list, unread] = await Promise.all([
    db
      .from('alerts')
      .select(
        'id, type, payload, created_at, influencers(name, slug), alert_reads(read_at)',
      )
      .order('created_at', { ascending: false })
      .limit(limit),
    db.rpc('unread_alert_count'),
  ]);
  if (list.error || unread.error) {
    throw new Error(
      `Bildirimler okunamadı: ${(list.error ?? unread.error)?.message}`,
    );
  }
  return {
    unread: unread.data ?? 0,
    alerts: (list.data ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      payload:
        row.payload &&
        typeof row.payload === 'object' &&
        !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {},
      createdAt: row.created_at,
      read: (row.alert_reads ?? []).length > 0,
      influencer: row.influencers
        ? { name: row.influencers.name, slug: row.influencers.slug }
        : null,
    })),
  };
}
