import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import { queueError } from '@/lib/generation-queue';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Kuyruktaki/çalışan üretimi iptal eder (`cancel_generation`). Sağlayıcıya gönderilmemiş iş
 * hemen `cancelled` olur; gönderilmiş işi worker sağlayıcıda iptal eder.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success) return jsonError('Geçersiz üretim kimliği.', 400);
  try {
    const db = await createSupabaseServerClient();
    const { data, error } = await db.rpc('cancel_generation', {
      p_id: id.data,
    });
    if (error) {
      const mapped = queueError(error);
      if (mapped.status === 500)
        throw new Error(`Üretim iptal edilemedi: ${error.message}`);
      return jsonError(mapped.message, mapped.status);
    }
    return NextResponse.json({
      ok: true,
      status: data?.status ?? null,
      pending: data?.status !== 'cancelled',
    });
  } catch (error) {
    return apiError(error);
  }
}
