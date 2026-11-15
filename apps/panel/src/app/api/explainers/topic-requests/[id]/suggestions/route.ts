import { NextResponse } from 'next/server';
import type { Json } from '@ai-influencer/shared';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import {
  explainerDbError,
  parseId,
  refreshExplainers,
} from '@/lib/explainer/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { suggestionsAddSchema } from '@/lib/explainer/schemas';

type Context = { params: Promise<{ id: string }> };

/** İsteğe öneri ekler (`add_topic_suggestions`; istek başına en çok 20). Bütün turu döndürür. */
export async function POST(request: Request, context: Context) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = parseId((await context.params).id);
  if (!id) return jsonError('İstek bulunamadı.', 404);
  const parsed = await parseJson(request, suggestionsAddSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('add_topic_suggestions', {
      p_request_id: id,
      p_suggestions: input.suggestions as Json,
    });
    if (error) return explainerDbError(error);
    refreshExplainers();
    return NextResponse.json({ suggestions: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
