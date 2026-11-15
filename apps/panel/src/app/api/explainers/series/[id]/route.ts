import { NextResponse } from 'next/server';
import type { Json } from '@ai-influencer/shared';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import {
  explainerDbError,
  parseId,
  refreshExplainers,
} from '@/lib/explainer/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { seriesPatchSchema } from '@/lib/explainer/schemas';

type Context = { params: Promise<{ id: string }> };

/** Serinin adını ve varsayılanlarını değiştirir (`update_series`): yalnız verilen alanlar. */
export async function PATCH(request: Request, context: Context) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = parseId((await context.params).id);
  if (!id) return jsonError('Seri bulunamadı.', 404);
  const parsed = await parseJson(request, seriesPatchSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('update_series', {
      p_series_id: id,
      p_patch: input as Json,
    });
    if (error) return explainerDbError(error);
    refreshExplainers();
    return NextResponse.json({ series: data });
  } catch (error) {
    return apiError(error);
  }
}
