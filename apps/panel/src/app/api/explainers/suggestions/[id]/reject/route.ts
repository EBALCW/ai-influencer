import { NextResponse } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import {
  explainerDbError,
  parseId,
  refreshExplainers,
} from '@/lib/explainer/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { suggestionRejectSchema } from '@/lib/explainer/schemas';

type Context = { params: Promise<{ id: string }> };

/** Öneriyi eler (`reject_topic_suggestion`). Satır saklanır; sonradan yine seçilebilir. */
export async function POST(request: Request, context: Context) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = parseId((await context.params).id);
  if (!id) return jsonError('Öneri bulunamadı.', 404);
  const parsed = await parseJson(request, suggestionRejectSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('reject_topic_suggestion', {
      p_suggestion_id: id,
      ...(input.reason ? { p_reason: input.reason } : {}),
    });
    if (error) return explainerDbError(error);
    refreshExplainers();
    return NextResponse.json({ suggestion: data });
  } catch (error) {
    return apiError(error);
  }
}
