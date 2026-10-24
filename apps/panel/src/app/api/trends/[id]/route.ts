import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { refreshResearch, trendDbError } from '@/lib/research/api';
import { trendPatchSchema } from '@/lib/research/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const idSchema = z.string().uuid();
type Context = { params: Promise<{ id: string }> };

/** Trend kaydını düzenler (#10). En az editor; yalnız gönderilen alanlar değişir. */
export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError('Trend bulunamadı.', 404);
  const parsed = await parseJson(request, trendPatchSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('trends')
      .update(parsed.data)
      .eq('id', id.data)
      .select('*')
      .maybeSingle();
    if (error) return trendDbError(error);
    if (!data) return jsonError('Trend bulunamadı.', 404);
    refreshResearch();
    return NextResponse.json({ trend: data });
  } catch (error) {
    return apiError(error);
  }
}

/** Trend kaydını siler. Backlog'a aktarılmış içerik kartı silinmez. */
export async function DELETE(_request: Request, context: Context) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError('Trend bulunamadı.', 404);
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('trends')
      .delete()
      .eq('id', id.data)
      .select('id');
    if (error) return trendDbError(error);
    if (!data?.length) return jsonError('Trend bulunamadı.', 404);
    refreshResearch();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
