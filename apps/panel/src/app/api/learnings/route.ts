import { NextResponse, type NextRequest } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { learningInputSchema } from '@/lib/analytics/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Tarihli öğrenim notu ekler (#55). En az editor. Post'a bağlı notun
 * influencer'ı ve `created_by` veritabanında (trigger) belirlenir.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;

    const body = await parseJson(request, learningInputSchema);
    if (!body.ok) return body.response;
    const input = body.data;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('learnings')
      .insert({
        body: input.body,
        post_id: input.postId ?? null,
        influencer_id: input.influencerId ?? null,
        tags: input.tags,
      })
      .select('id, body, tags, created_at, post_id, influencer_id')
      .single();
    if (error) {
      if (error.code === '42501')
        return jsonError('Bu işlem için yetkin yok.', 403);
      if (error.code === '23503')
        return jsonError('Post veya influencer bulunamadı.', 400);
      if (error.code === '23514')
        return jsonError('Öğrenim ve post aynı influencer’a ait olmalı.', 422);
      throw new Error(`Öğrenim kaydedilemedi: ${error.message}`);
    }
    return NextResponse.json({ learning: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
