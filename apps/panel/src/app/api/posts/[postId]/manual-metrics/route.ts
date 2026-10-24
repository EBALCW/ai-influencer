import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import {
  manualMetricsResultSchema,
  manualMetricsSchema,
  toManualMetricsArgs,
} from '@/lib/analytics/manual-metrics';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const MESSAGES = {
  created: 'Elle girilen metrik kaydedildi.',
  updated: 'Elle girilen metrik güncellendi.',
  conflict:
    'Bu kontrol noktası API’den ölçülmüş; elle girilen değer üzerine yazılmaz.',
} as const;

/**
 * Elle metrik girişi (#52). En az editor. `record_manual_metrics` RPC'si
 * `metric_snapshots`'a `source = 'manual'` satırı yazar. UNIQUE (post_id, target_hours)
 * çakışmasında: önceki elle giriş düzeltilir (200), API ölçümü ezilmez (409).
 * Kontrol noktası verilmezse (null) şimdiki zamana ad-hoc ölçüm eklenir (201).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const postId = z.uuid().safeParse((await context.params).postId);
    if (!postId.success) return jsonError('Post bulunamadı.', 404);
    const body = await parseJson(request, manualMetricsSchema);
    if (!body.ok) return body.response;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      'record_manual_metrics',
      toManualMetricsArgs(postId.data, body.data),
    );
    if (error) {
      if (error.code === '42501')
        return jsonError('Bu işlem için yetkin yok.', 403);
      if (error.code === 'P0002') return jsonError('Post bulunamadı.', 404);
      if (error.code === '22023')
        return jsonError(error.message || 'Geçersiz kontrol noktası.', 422);
      if (error.code === '23514')
        return jsonError('Metrik değerleri geçersiz.', 400);
      if (error.code === '23505')
        return jsonError('Aynı anda kaydedilmiş bir ölçüm var.', 409);
      throw new Error(`Elle metrik kaydedilemedi: ${error.message}`);
    }
    const result = manualMetricsResultSchema.safeParse(data);
    if (!result.success)
      throw new Error('Elle metrik kaydı beklenmeyen yanıt döndürdü.');
    const { status, id } = result.data;
    return NextResponse.json(
      { result: status, id, message: MESSAGES[status] },
      {
        status: status === 'created' ? 201 : status === 'updated' ? 200 : 409,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
