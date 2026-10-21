import { NextResponse } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import {
  contentDbError,
  contentIdSchema,
  refreshContent,
} from '@/lib/content/api';
import { slotSchema } from '@/lib/content/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = contentIdSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError('Yayın slotu bulunamadı.', 404);
  const parsed = await parseJson(request, slotSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('posting_slots')
      .update(parsed.data)
      .eq('id', id.data)
      .select('*')
      .maybeSingle();
    if (error) return contentDbError(error);
    if (!data) return jsonError('Yayın slotu bulunamadı.', 404);
    refreshContent();
    return NextResponse.json({ slot: data });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = contentIdSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError('Yayın slotu bulunamadı.', 404);
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('posting_slots')
      .delete()
      .eq('id', id.data)
      .select('id');
    if (error) return contentDbError(error);
    if (!data.length) return jsonError('Yayın slotu bulunamadı.', 404);
    refreshContent();
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
