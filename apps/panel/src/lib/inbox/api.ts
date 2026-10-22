import 'server-only';
import { revalidatePath } from 'next/cache';
import { apiError, jsonError } from '@/lib/auth-api';

/** Yorum/yanıt yazma hataları → HTTP. Mesaja yorum metni veya DB ayrıntısı yazılmaz. */
export function commentDbError(error: { code?: string; message: string }) {
  if (error.code === '42501') return jsonError('Editor yetkisi gerekli.', 403);
  if (error.code === 'PGRST116') return jsonError('Yorum bulunamadı.', 404);
  if (error.code === '23514' || error.code === '22P02')
    return jsonError('Kayıt kurallarına uymuyor.', 422);
  return apiError(new Error(`Yorum verisi yazılamadı: ${error.code ?? ''}`));
}

export function refreshInbox() {
  revalidatePath('/inbox');
}
