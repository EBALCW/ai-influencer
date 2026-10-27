import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { reportActionsSchema } from '@/lib/reports/weekly';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const patchSchema = z.strictObject({ actions: reportActionsSchema });

/**
 * Haftalık rapora "gelecek hafta için 1–3 aksiyon" yazar (#24). En az editor.
 * Rapor yeniden üretildiğinde aksiyonlar korunur (generate_weekly_report dokunmaz).
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const id = z.uuid().safeParse((await context.params).id);
    if (!id.success) return jsonError('Rapor bulunamadı.', 404);
    const body = await parseJson(request, patchSchema);
    if (!body.ok) return body.response;

    const db = await createSupabaseServerClient();
    const { data, error } = await db
      .from('reports')
      .update({ actions: body.data.actions })
      .eq('id', id.data)
      .select('id, actions')
      .maybeSingle();
    if (error) {
      if (error.code === '23514')
        return jsonError('En fazla 3 aksiyon, her biri 1–300 karakter.', 400);
      return apiError(error);
    }
    if (!data) return jsonError('Rapor bulunamadı.', 404);
    revalidatePath(`/analytics/reports/${data.id}`);
    return NextResponse.json({ id: data.id, actions: data.actions });
  } catch (error) {
    return apiError(error);
  }
}
