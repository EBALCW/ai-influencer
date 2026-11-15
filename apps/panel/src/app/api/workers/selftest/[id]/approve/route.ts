import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import { isSameOrigin } from '@/lib/same-origin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const idSchema = z.string().uuid();

/**
 * Deneme işinin onay aşamasını onaylar. Onayı yalnız insan oturumu verebilir: kural
 * veritabanındadır (`approve_job_stage`; makine oturumu 42501).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    if (!isSameOrigin(request))
      return jsonError('Geçersiz istek kaynağı.', 403);
    const id = idSchema.safeParse((await context.params).id);
    if (!id.success) return jsonError('İş bulunamadı.', 404);

    const supabase = await createSupabaseServerClient();
    // Yalnız deneme işi bu uçtan onaylanır (diğer işlerin onayı kendi ekranlarında, #205)
    const { data: job, error: readError } = await supabase
      .from('jobs')
      .select('id, kind')
      .eq('id', id.data)
      .maybeSingle();
    if (readError) throw new Error('İş okunamadı.');
    if (!job || job.kind !== 'clip.selftest')
      return jsonError('İş bulunamadı.', 404);

    const { error } = await supabase.rpc('approve_job_stage', {
      p_job_id: id.data,
      p_stage_key: 'review',
    });
    if (error?.code === 'P0002') return jsonError('İş bulunamadı.', 404);
    if (error?.code === '42501')
      return jsonError('Onay için editor yetkisi gerekli.', 403);
    if (error?.code === '55000')
      return jsonError('Bu iş şu anda onay beklemiyor.', 409);
    if (error) throw new Error('Aşama onaylanamadı.');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
