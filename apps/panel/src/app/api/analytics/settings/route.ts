import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { analyticsSettingsSchema } from '@/lib/analytics/performance';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Performans eşikleri (#25): "takıldı" eşiği, "patladı" çarpanı ve kıyas grubu.
 * Yalnız owner yazar (RLS `app_settings_owner_write` ile aynı kural). Değer şekli
 * veritabanında da `valid_analytics_settings()` CHECK'i ile denetlenir.
 */
export async function PUT(request: Request) {
  const auth = await requireApiRole('owner');
  if (!auth.ok) return auth.response;
  const body = await parseJson(request, analyticsSettingsSchema);
  if (!body.ok) return body.response;
  try {
    const db = await createSupabaseServerClient();
    const { error } = await db
      .from('app_settings')
      .upsert({ key: 'analytics', value: body.data }, { onConflict: 'key' });
    if (error) {
      if (error.code === '23514')
        return jsonError('Eşik değerleri geçersiz.', 400);
      if (error.code === '42501')
        return jsonError('owner yetkisi gerekli.', 403);
      return apiError(error);
    }
    revalidatePath('/analytics/performance');
    return NextResponse.json({ ok: true, settings: body.data });
  } catch (error) {
    return apiError(error);
  }
}
