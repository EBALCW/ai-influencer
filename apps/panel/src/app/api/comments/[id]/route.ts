import { NextResponse } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { commentDbError, refreshInbox } from '@/lib/inbox/api';
import { commentIdSchema, commentPatchSchema } from '@/lib/inbox/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Yorum durumu (#61): okundu / okunmadı / gizli. En az editor; viewer 403.
 * Gizleme yalnız paneldedir, platformda yorumu gizlemez. Yanıtlanmış yorum gizlemesi
 * kaldırılınca veritabanı onu yine "yanıtlandı" yapar.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const id = commentIdSchema.safeParse((await params).id);
    if (!id.success) return jsonError('Geçersiz yorum.', 400);
    const body = await parseJson(request, commentPatchSchema);
    if (!body.ok) return body.response;

    const db = await createSupabaseServerClient();
    const { data, error } = await db
      .from('comments')
      .update({ status: body.data.status })
      .eq('id', id.data)
      .select('id, status')
      .maybeSingle();
    if (error) return commentDbError(error);
    if (!data) return jsonError('Yorum bulunamadı.', 404);
    refreshInbox();
    return NextResponse.json(data);
  } catch (error) {
    return apiError(error);
  }
}
