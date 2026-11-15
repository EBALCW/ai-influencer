import { NextResponse } from 'next/server';
import { apiError, parseJson, requireApiRole } from '@/lib/auth-api';
import { explainerDbError, refreshExplainers } from '@/lib/explainer/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { episodeCreateSchema } from '@/lib/explainer/schemas';

/** Önerisiz bölüm açar (`create_episode`): tekil video ya da serinin sıradaki bölümü. */
export async function POST(request: Request) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(request, episodeCreateSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('create_episode', {
      p_title: input.title,
      ...(input.kind ? { p_kind: input.kind } : {}),
      ...(input.series_id ? { p_series_id: input.series_id } : {}),
      ...(input.language ? { p_language: input.language } : {}),
      ...(input.summary ? { p_summary: input.summary } : {}),
      ...(input.hook ? { p_hook: input.hook } : {}),
    });
    if (error) return explainerDbError(error);
    refreshExplainers();
    return NextResponse.json({ episode: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
