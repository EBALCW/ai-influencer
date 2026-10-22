import { NextResponse } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import {
  contentDbError,
  contentIdSchema,
  refreshContent,
} from '@/lib/content/api';
import { publishBlocker, publishRequestSchema } from '@/lib/content/publish';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * "Şimdi yayınla" / "Planla" (#58). Route yalnız yayın işi açar (`enqueue_publish_job`);
 * sağlayıcı API'sini çağırmaz. Yayını `publish-scheduled` Edge Function'ı yapar.
 * Yayın öncesi zorunlu kontroller (check-list, AI etiketi, bağlı hesap, final video) veritabanında
 * doğrulanır; eksikse 422.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = contentIdSchema.safeParse((await context.params).id);
  if (!id.success) return jsonError('İçerik bulunamadı.', 404);
  const parsed = await parseJson(request, publishRequestSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  if (
    body.mode === 'schedule' &&
    Date.parse(body.scheduled_at!) < Date.now() - 60_000
  ) {
    return jsonError('Yayın zamanı gelecekte olmalı.', 422);
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc('enqueue_publish_job', {
      p_content_id: id.data,
      p_title: body.title,
      p_caption: body.caption,
      p_tags: body.tags,
      ...(body.mode === 'schedule'
        ? { p_scheduled_for: new Date(body.scheduled_at!).toISOString() }
        : {}),
    });
    if (error) {
      const blocked = publishBlocker(error);
      if (blocked) return jsonError(blocked.message, blocked.status);
      return contentDbError(error);
    }
    refreshContent();
    return NextResponse.json({ job_id: data }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
