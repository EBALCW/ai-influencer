import 'server-only';
import { z } from 'zod';
import { jsonError } from './auth-api';

/** Route parametresindeki influencer id'sini doğrular; geçersizse null. */
export async function influencerIdFrom(context: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await context.params;
  return z.uuid().safeParse(id).success ? id : null;
}

/**
 * Persona RPC hatalarını HTTP yanıtına çevirir. Beklenmeyenler null döner
 * (çağıran `apiError` ile loglayıp 500 verir).
 */
export function personaRpcError(error: { code?: string } | null) {
  if (!error) return null;
  if (error.code === '42501')
    return jsonError('Persona düzenlemek için editor yetkisi gerekir.', 403);
  if (error.code === 'P0002')
    return jsonError('Influencer veya versiyon bulunamadı.', 404);
  if (error.code === '23514')
    return jsonError(
      'Persona alanlarından biri izin verilen sınırı aşıyor.',
      400,
    );
  return null;
}
