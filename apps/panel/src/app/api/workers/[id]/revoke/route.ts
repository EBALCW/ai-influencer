import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const idSchema = z.string().uuid();

/**
 * Makinenin yetkisini kaldırır. Kural veritabanındadır (`revoke_worker`): owner her makineyi,
 * editor yalnız kendisininkini kaldırır; makinenin oturumu biter, elindeki iş kuyruğa döner.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    if (request.headers.get('origin') !== request.nextUrl.origin)
      return jsonError('Geçersiz istek kaynağı.', 403);
    const id = idSchema.safeParse((await context.params).id);
    if (!id.success) return jsonError('Makine bulunamadı.', 404);

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.rpc('revoke_worker', {
      p_worker_id: id.data,
    });
    if (error?.code === 'P0002') return jsonError('Makine bulunamadı.', 404);
    if (error?.code === '42501')
      return jsonError('Başkasının makinesini yalnız owner kaldırabilir.', 403);
    if (error) throw new Error('Makinenin yetkisi kaldırılamadı.');
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
