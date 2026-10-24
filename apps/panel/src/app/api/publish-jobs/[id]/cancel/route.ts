import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import { contentDbError, refreshContent } from '@/lib/content/api';
import { publishBlocker } from '@/lib/content/publish';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Kuyruktaki (henüz işlenmeye başlamamış) yayın işini iptal eder (#58). */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success) return jsonError('Yayın işi bulunamadı.', 404);
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc('cancel_publish_job', {
      p_id: id.data,
    });
    if (error) {
      const blocked = publishBlocker(error);
      if (blocked) return jsonError(blocked.message, blocked.status);
      return contentDbError(error);
    }
    refreshContent();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
