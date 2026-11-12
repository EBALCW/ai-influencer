import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { clipDbError, refreshClips } from '@/lib/clips/api';
import { clipSourcePatchSchema } from '@/lib/clips/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const idSchema = z.string().uuid();
type Context = { params: Promise<{ id: string }> };

/**
 * Kaynağı düzenler veya izin durumunu işaretler (#173). En az editor. İzni
 * kimin, ne zaman kaydettiğini veritabanı yazar (`permission_checked_*`).
 */
export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError('Kaynak bulunamadı.', 404);
  const parsed = await parseJson(request, clipSourcePatchSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('clip_sources')
      .update(parsed.data)
      .eq('id', id.data)
      .select('*')
      .maybeSingle();
    if (error) return clipDbError(error);
    if (!data) return jsonError('Kaynak bulunamadı.', 404);
    refreshClips();
    return NextResponse.json({ source: data });
  } catch (error) {
    return apiError(error);
  }
}

/** Kaynağı ve kliplerini siler. Backlog'a aktarılmış içerik kartları silinmez. */
export async function DELETE(_request: Request, context: Context) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError('Kaynak bulunamadı.', 404);
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('clip_sources')
      .delete()
      .eq('id', id.data)
      .select('id');
    if (error) return clipDbError(error);
    if (!data?.length) return jsonError('Kaynak bulunamadı.', 404);
    refreshClips();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
