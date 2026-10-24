import { NextResponse } from 'next/server';
import { apiError, requireApiRole } from '@/lib/auth-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Görünen tüm uyarıları oturumdaki kullanıcı için okundu işaretler. */
export async function POST() {
  const auth = await requireApiRole('viewer');
  if (!auth.ok) return auth.response;
  try {
    const db = await createSupabaseServerClient();
    const { data, error } = await db.rpc('mark_alerts_read', {});
    if (error) throw new Error(`Bildirimler işaretlenemedi: ${error.message}`);
    return NextResponse.json({ ok: true, marked: data ?? 0 });
  } catch (error) {
    return apiError(error);
  }
}
