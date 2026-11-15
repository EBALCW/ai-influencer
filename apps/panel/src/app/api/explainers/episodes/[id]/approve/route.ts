import { NextResponse } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import {
  explainerDbError,
  parseId,
  refreshExplainers,
} from '@/lib/explainer/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { scriptApprovalSchema } from '@/lib/explainer/schemas';

type Context = { params: Promise<{ id: string }> };

/** Senaryoyu onaylar (`approve_episode_script`). Onaylayan ve an veritabanında `auth.uid()` / `now()` ile yazılır; istekten alınmaz. Kaynak eksiği varsa `acknowledge_fact_gaps` şarttır. */
export async function POST(request: Request, context: Context) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = parseId((await context.params).id);
  if (!id) return jsonError('Bölüm bulunamadı.', 404);
  const parsed = await parseJson(request, scriptApprovalSchema);
  if (!parsed.ok) return parsed.response;
  const input = parsed.data;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('approve_episode_script', {
      p_episode_id: id,
      p_script_version: input.script_version,
      p_acknowledge_fact_gaps: input.acknowledge_fact_gaps,
    });
    if (error) return explainerDbError(error);
    refreshExplainers();
    return NextResponse.json({ episode: data });
  } catch (error) {
    return apiError(error);
  }
}
