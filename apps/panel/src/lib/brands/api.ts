import 'server-only';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { apiError, jsonError } from '@/lib/auth-api';

export const idSchema = z.uuid();

/**
 * Marka/deal yazma hatalarını anlamlı HTTP durumlarına çevirir. Hata mesajına
 * veritabanı ayrıntısı veya iletişim bilgisi yazılmaz.
 */
export function brandDbError(error: { code?: string; message: string }) {
  if (error.code === '42501') return jsonError('Editor yetkisi gerekli.', 403);
  if (error.code === 'PGRST116') return jsonError('Kayıt bulunamadı.', 404);
  if (error.code === '23505')
    return jsonError('Bu kayıt zaten var (marka adı benzersiz olmalı).', 409);
  if (error.code === '23503')
    return jsonError(
      'Bağlı marka, influencer veya içerik bulunamadı ya da marka deal’lerde kullanılıyor.',
      409,
    );
  if (error.code === '23514' || error.code === '22P02')
    return jsonError(
      'Kayıt kurallarına uymuyor (ör. içerik başka influencer’a ait).',
      422,
    );
  return apiError(new Error(`Marka verisi yazılamadı: ${error.code ?? ''}`));
}

export function refreshBrands(dealId?: string) {
  revalidatePath('/brands');
  if (dealId) revalidatePath(`/brands/${dealId}`);
}
