import { NextResponse } from 'next/server';
import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import {
  explainerDbError,
  parseId,
  refreshExplainers,
} from '@/lib/explainer/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Context = { params: Promise<{ id: string }> };

/** Öneriyi bölüme çevirir (`pick_topic_suggestion`); serideyse sıradaki numarayı alır. */
export async function POST(_request: Request, context: Context) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = parseId((await context.params).id);
  if (!id) return jsonError('Öneri bulunamadı.', 404);
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('pick_topic_suggestion', {
      p_suggestion_id: id,
    });
    if (error) return explainerDbError(error);
    refreshExplainers();
    return NextResponse.json({ episode: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
