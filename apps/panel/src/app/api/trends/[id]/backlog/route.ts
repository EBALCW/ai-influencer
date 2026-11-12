import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { refreshResearch, trendDbError } from '@/lib/research/api';
import { backlogSchema } from '@/lib/research/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const idSchema = z.string().uuid();

/**
 * "Backlog'a aktar" (#10 → #57): trendden `idea` aşamasında içerik kartı açar,
 * trendi `used` yapar ve kartı trende bağlar (`push_trend_to_backlog`, tek
 * transaction). Global trend için hedef influencer gövdede verilir.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = idSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError('Trend bulunamadı.', 404);
  const parsed = await parseJson(request, backlogSchema);
  if (!parsed.ok) return parsed.response;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('push_trend_to_backlog', {
      p_trend_id: id.data,
      ...(parsed.data.influencer_id
        ? { p_influencer_id: parsed.data.influencer_id }
        : {}),
      ...(parsed.data.title ? { p_title: parsed.data.title } : {}),
    });
    if (error) return trendDbError(error);
    refreshResearch();
    return NextResponse.json({ content_item_id: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
