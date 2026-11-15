import { NextResponse } from 'next/server';
import type { Json } from '@ai-influencer/shared';
import { apiError, parseJson, requireApiRole } from '@/lib/auth-api';
import { explainerDbError, refreshExplainers } from '@/lib/explainer/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { topicRequestSchema } from '@/lib/explainer/schemas';

/** Konu isteği açar (`create_topic_request`); öneriler elle ya da (ileride, #217) AI ile eklenir. */
export async function POST(request: Request) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const parsed = await parseJson(request, topicRequestSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('create_topic_request', {
      p_prompt: input.prompt,
      p_suggestions: input.suggestions as Json,
      ...(input.series_id ? { p_series_id: input.series_id } : {}),
      ...(input.kind ? { p_kind: input.kind } : {}),
      ...(input.language ? { p_language: input.language } : {}),
    });
    if (error) return explainerDbError(error);
    refreshExplainers();
    return NextResponse.json({ request: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
