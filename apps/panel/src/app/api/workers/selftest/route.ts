import { NextResponse, type NextRequest } from 'next/server';
import { JOB_KINDS, jobKindCapability } from '@ai-influencer/shared';
import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import { isSameOrigin } from '@/lib/same-origin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const KIND = 'clip.selftest';

/**
 * Deneme işi açar (#211): gerçek render yapmayan üç aşamalı sahte iş. Makine oturumu iş açamaz;
 * işi panelden oturumu açık bir owner/editor açar. Yetki ve alan `enqueue_job` çekirdeğindedir.
 * İş yalnız bu türün işleyicisi olan makineye verilir (`kind:clip.selftest` yeteneği).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    if (!isSameOrigin(request))
      return jsonError('Geçersiz istek kaynağı.', 403);

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('enqueue_job', {
      p_module: JOB_KINDS[KIND].module,
      p_kind: KIND,
      p_stages: JOB_KINDS[KIND].stages.map((stage) => ({ ...stage })),
      p_params: { steps: 5, stepMs: 400, note: 'Panelden deneme işi' },
      p_required_capabilities: [jobKindCapability(KIND)],
    });
    if (error?.code === '42501')
      return jsonError('editor yetkisi gerekli.', 403);
    if (error || !data) throw new Error('Deneme işi açılamadı.');
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
