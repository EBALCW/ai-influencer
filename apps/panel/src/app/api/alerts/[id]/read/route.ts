import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Uyarıyı oturumdaki kullanıcı için okundu işaretler. Okundu bilgisi kişi başıdır
 * (`alert_reads`), bu yüzden viewer da işaretleyebilir; uyarı satırı değişmez.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole('viewer');
  if (!auth.ok) return auth.response;
  const id = z
    .string()
    .uuid()
    .safeParse((await context.params).id);
  if (!id.success) return jsonError('Geçersiz bildirim kimliği.', 400);
  try {
    const db = await createSupabaseServerClient();
    const { data: alert, error: readError } = await db
      .from('alerts')
      .select('id')
      .eq('id', id.data)
      .maybeSingle();
    if (readError) throw new Error(`Bildirim okunamadı: ${readError.message}`);
    if (!alert) return jsonError('Bildirim bulunamadı.', 404);
    const { data, error } = await db.rpc('mark_alerts_read', {
      p_alert_ids: [id.data],
    });
    if (error) throw new Error(`Bildirim işaretlenemedi: ${error.message}`);
    return NextResponse.json({ ok: true, marked: data ?? 0 });
  } catch (error) {
    return apiError(error);
  }
}
