import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { queueError } from '@/lib/generation-queue';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const bodySchema = z.object({ overrideBudget: z.boolean().default(false) });

/**
 * Başarısız/iptal edilmiş üretimi aynı parametrelerle YENİ bir satır olarak kuyruğa alır
 * (`retry_generation`); eski satır ve maliyet geçmişi değişmez. Bütçe doluysa 402; owner
 * `overrideBudget: true` ile onaylayabilir (yetkiyi veritabanı da denetler).
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiRole('editor');
  if (!auth.ok) return auth.response;
  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success) return jsonError('Geçersiz üretim kimliği.', 400);
  const body = await parseJson(request, bodySchema);
  if (!body.ok) return body.response;
  if (body.data.overrideBudget && auth.role !== 'owner')
    return jsonError('Bütçe onayı sadece owner tarafından verilebilir.', 403);
  try {
    const db = await createSupabaseServerClient();
    const { data, error } = await db.rpc('retry_generation', {
      p_id: id.data,
      p_override_budget: body.data.overrideBudget,
    });
    if (error) {
      const mapped = queueError(error);
      if (mapped.status === 500)
        throw new Error(`Üretim yeniden denenemedi: ${error.message}`);
      return jsonError(mapped.message, mapped.status);
    }
    return NextResponse.json(
      { ok: true, id: data?.id ?? null },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
