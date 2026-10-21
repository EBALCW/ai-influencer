import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import {
  contentDbError,
  contentIdSchema,
  saveContent,
} from '@/lib/content/api';
import { readChecklist } from '@/lib/content/checklist-schema';
import { contentPatchSchema, contentSchema } from '@/lib/content/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = contentIdSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError('İçerik bulunamadı.', 404);
  const parsed = await parseJson(request, contentPatchSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const supabase = await createSupabaseServerClient();
    const { data: current, error } = await supabase
      .from('content_items')
      .select('*')
      .eq('id', id.data)
      .maybeSingle();
    if (error) return contentDbError(error);
    if (!current) return jsonError('İçerik bulunamadı.', 404);
    const { expected_updated_at, ...patch } = parsed.data;
    const input = contentSchema.safeParse({
      ...current,
      checklist: readChecklist(current.checklist),
      ...patch,
    });
    if (!input.success) return jsonError('İstek doğrulanamadı.', 400);
    return await saveContent(
      id.data,
      input.data,
      expected_updated_at ?? current.updated_at,
    );
  } catch (error) {
    return apiError(error);
  }
}
