import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { soundTypeSchema } from '@/lib/analytics/performance';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const patchSchema = z.strictObject({ soundType: soundTypeSchema });

/**
 * Postun ekip tarafından girilen alanları (#24): şimdilik ses türü
 * (trend / orijinal / null). En az editor; RLS `can_write_data()` ikinci savunma.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ postId: string }> },
) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const postId = z.uuid().safeParse((await context.params).postId);
    if (!postId.success) return jsonError('Post bulunamadı.', 404);
    const body = await parseJson(request, patchSchema);
    if (!body.ok) return body.response;

    const db = await createSupabaseServerClient();
    const { data, error } = await db
      .from('posts')
      .update({ sound_type: body.data.soundType })
      .eq('id', postId.data)
      .select('id, sound_type')
      .maybeSingle();
    if (error) {
      if (error.code === '23514') return jsonError('Geçersiz ses türü.', 400);
      return apiError(error);
    }
    // Yetkisiz veya olmayan satır güncellemesi hata vermez, 0 satır döner
    if (!data) return jsonError('Post bulunamadı.', 404);
    revalidatePath('/analytics/performance');
    return NextResponse.json({ id: data.id, soundType: data.sound_type });
  } catch (error) {
    return apiError(error);
  }
}
