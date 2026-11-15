import { NextResponse } from 'next/server';
import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import {
  explainerDbError,
  parseId,
  refreshExplainers,
} from '@/lib/explainer/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Context = { params: Promise<{ id: string; jobId: string }> };

/**
 * Bölümün üretim işini iptal eder (`request_cancel_job`, #201). Sıradaki iş anında iptal olur;
 * çalışan işte makine bir sonraki ilerleme çağrısında durur. İş bu bölüme ait olmalı.
 */
export async function POST(_request: Request, context: Context) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const params = await context.params;
  const id = parseId(params.id);
  const jobId = parseId(params.jobId);
  if (!id || !jobId) return jsonError('İş bulunamadı.', 404);
  try {
    const supabase = await createSupabaseServerClient();
    const { data: job, error: readError } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .eq('episode_id', id)
      .maybeSingle();
    if (readError) return explainerDbError(readError);
    if (!job) return jsonError('İş bulunamadı.', 404);
    const { data, error } = await supabase.rpc('request_cancel_job', {
      p_job_id: jobId,
    });
    if (error) return explainerDbError(error);
    refreshExplainers();
    return NextResponse.json({ job: data });
  } catch (error) {
    return apiError(error);
  }
}
