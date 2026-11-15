import { NextResponse } from 'next/server';
import type { Json } from '@ai-influencer/shared';
import { apiError, parseJson, requireApiRole } from '@/lib/auth-api';
import { explainerDbError, refreshExplainers } from '@/lib/explainer/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { seriesCreateSchema } from '@/lib/explainer/schemas';

/** Seri açar (#216 `create_series`). En az editor; çalışma alanı oturumdan gelir. */
export async function POST(request: Request) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(request, seriesCreateSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('create_series', {
      p_name: input.name,
      p_settings: input.settings as Json,
    });
    if (error) return explainerDbError(error);
    refreshExplainers();
    return NextResponse.json({ series: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
