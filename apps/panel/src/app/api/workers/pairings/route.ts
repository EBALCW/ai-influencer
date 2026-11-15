import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { parsePairingRequest } from '@ai-influencer/shared';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { beginPairing, completePairing } from '@/lib/workers/pairing';

const bodySchema = z.object({ pairing: z.string().min(1).max(2000) });

/**
 * Makine eşlemesini onaylar. Eşleme metni makinenin gösterdiği metindir: cihaz sırrının yalnız
 * özetini, açık anahtarı, makinenin adını ve platformunu taşır. Oturumu açık owner/editor için
 * ayrı bir makine oturumu açılır ve makineye mühürlü olarak teslim edilir. Yanıtta token yoktur.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    if (request.headers.get('origin') !== request.nextUrl.origin)
      return jsonError('Geçersiz istek kaynağı.', 403);
    const body = await parseJson(request, bodySchema);
    if (!body.ok) return body.response;
    const pairing = parsePairingRequest(body.data.pairing);
    if (!pairing) return jsonError('Eşleme metni geçersiz.', 400);

    const supabase = await createSupabaseServerClient();
    const started = await beginPairing(supabase, pairing);
    if (started.status === 'stale')
      return jsonError(
        'Eşleme metninin süresi dolmuş. Makinede pnpm worker:login komutunu yeniden çalıştır.',
        410,
      );
    if (started.status === 'already_used')
      return jsonError(
        'Bu eşleme metni zaten kullanıldı. Makinede pnpm worker:login komutunu yeniden çalıştır.',
        409,
      );
    if (started.status === 'too_many_pending')
      return jsonError(
        'Bekleyen çok fazla eşleme var. Açık eşlemeler 5 dakika içinde kapanır; sonra yeniden deneyin.',
        429,
      );

    const worker = await completePairing({
      pairingId: started.pairingId,
      publicKey: pairing.publicKey,
      user: auth.user,
    });
    return NextResponse.json({
      worker: { id: worker.workerId, name: worker.name },
    });
  } catch (error) {
    return apiError(error);
  }
}
