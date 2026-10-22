import { NextResponse } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { commentDbError, refreshInbox } from '@/lib/inbox/api';
import {
  canReplyOn,
  commentIdSchema,
  replyRequestSchema,
} from '@/lib/inbox/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Yanıtı gönderim kuyruğuna alır (#61). Gönderimi `comments-dispatch` Edge Function yapar;
 * token panele hiç gelmez. Her yanıt bir insanın tıklamasıyla gider; toplu/otomatik yanıt yok.
 *
 * Idempotent: yorum başına tek etkin yanıt (veritabanında kısmi UNIQUE). Aynı yoruma ikinci
 * istek (çift tıklama) yeni satır açmaz, mevcut yanıtı 200 ile döner.
 *   202 → kuyruğa alındı · 200 → zaten kuyrukta/gönderildi · 422 → platform desteklenmiyor
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const id = commentIdSchema.safeParse((await params).id);
    if (!id.success) return jsonError('Geçersiz yorum.', 400);
    const body = await parseJson(request, replyRequestSchema);
    if (!body.ok) return body.response;

    const db = await createSupabaseServerClient();
    const comment = await db
      .from('comments')
      .select('id, platform, status')
      .eq('id', id.data)
      .maybeSingle();
    if (comment.error) return commentDbError(comment.error);
    if (!comment.data) return jsonError('Yorum bulunamadı.', 404);
    if (!canReplyOn(comment.data.platform))
      return jsonError('Bu platformda panelden yanıt desteklenmiyor.', 422);

    const inserted = await db
      .from('comment_replies')
      .insert({ comment_id: id.data, body: body.data.body })
      .select('id, status')
      .single();
    if (inserted.error) {
      if (inserted.error.code !== '23505')
        return commentDbError(inserted.error);
      const existing = await db
        .from('comment_replies')
        .select('id, status')
        .eq('comment_id', id.data)
        .neq('status', 'failed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing.error) return commentDbError(existing.error);
      if (!existing.data)
        return jsonError('Yanıt durumu okunamadı, tekrar deneyin.', 409);
      return NextResponse.json({ ...existing.data, duplicate: true });
    }

    // Okunmadı ise okundu say (yanıt gidince veritabanı "yanıtlandı" yapar).
    if (comment.data.status === 'new') {
      const read = await db
        .from('comments')
        .update({ status: 'read' })
        .eq('id', id.data)
        .eq('status', 'new');
      if (read.error) console.warn('[inbox] okundu işareti yazılamadı');
    }
    refreshInbox();
    return NextResponse.json(inserted.data, { status: 202 });
  } catch (error) {
    return apiError(error);
  }
}
