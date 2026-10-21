import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import {
  contentDbError,
  contentIdSchema,
  refreshContent,
} from '@/lib/content/api';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = contentIdSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError('İçerik bulunamadı.', 404);
  const parsed = await parseJson(
    request,
    z.object({ post_id: z.string().uuid() }),
  );
  if (!parsed.ok) return parsed.response;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('link_content_post', {
      p_content_id: id.data,
      p_post_id: parsed.data.post_id,
    });
    if (error) return contentDbError(error);
    refreshContent();
    return NextResponse.json({ item: data });
  } catch (error) {
    return apiError(error);
  }
}
