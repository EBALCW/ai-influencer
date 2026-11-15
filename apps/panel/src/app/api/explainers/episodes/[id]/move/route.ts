import { NextResponse } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import {
  explainerDbError,
  parseId,
  refreshExplainers,
} from '@/lib/explainer/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { episodeMoveSchema } from '@/lib/explainer/schemas';

type Context = { params: Promise<{ id: string }> };

/** Bölümü başka seriye ya da seri dışına taşır (`move_episode`); yalnız üretim başlamadan. */
export async function POST(request: Request, context: Context) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = parseId((await context.params).id);
  if (!id) return jsonError('Bölüm bulunamadı.', 404);
  const parsed = await parseJson(request, episodeMoveSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('move_episode', {
      p_episode_id: id,
      ...(input.series_id ? { p_series_id: input.series_id } : {}),
    });
    if (error) return explainerDbError(error);
    refreshExplainers();
    return NextResponse.json({ episode: data });
  } catch (error) {
    return apiError(error);
  }
}
