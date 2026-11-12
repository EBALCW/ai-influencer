import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { clipDbError, refreshClips } from '@/lib/clips/api';
import { clipBacklogSchema } from '@/lib/clips/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const idSchema = z.string().uuid();

/**
 * "Backlog'a aktar" (#173 → #57): klipten `idea` aşamasında içerik kartı açar
 * (`push_clip_to_backlog`, tek transaction). Kaynağın izni `granted` değilse
 * veritabanı reddeder (422). Atanmamış klip için hedef influencer gövdede verilir.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError('Klip bulunamadı.', 404);
  const parsed = await parseJson(request, clipBacklogSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('push_clip_to_backlog', {
      p_clip_id: id.data,
      ...(parsed.data.influencer_id
        ? { p_influencer_id: parsed.data.influencer_id }
        : {}),
    });
    if (error) return clipDbError(error);
    refreshClips();
    return NextResponse.json({ content_item_id: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
