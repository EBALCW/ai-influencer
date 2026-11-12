import 'server-only';
import { revalidatePath } from 'next/cache';
import { apiError, jsonError } from '@/lib/auth-api';

/** Veritabanı hata kodlarını (migration'daki sözleşme) HTTP yanıtına çevirir. */
export function clipDbError(error: { code?: string; message: string }) {
  if (error.code === '42501') return jsonError('Editor yetkisi gerekli.', 403);
  if (error.code === 'P0002') return jsonError('Kayıt bulunamadı.', 404);
  if (error.code === '23505')
    return jsonError(
      error.message.includes('backlog')
        ? error.message
        : 'Bu video zaten kaynak listesinde.',
      409,
    );
  if (error.code === '23503')
    return jsonError('Kaynak veya influencer bulunamadı.', 400);
  if (error.code === '23514' || error.code === '22023') {
    if (error.message.includes('clip_sources_granted_needs_ref'))
      return jsonError('“İzin verildi” için izin referansı gerekli.', 422);
    if (error.message.includes('clips_range_valid'))
      return jsonError(
        'Bitiş başlangıçtan sonra olmalı ve klip en fazla 180 sn sürebilir.',
        422,
      );
    return jsonError(
      error.message && !error.message.includes('violates')
        ? error.message
        : 'Kayıt kurallara uymuyor.',
      422,
    );
  }
  return apiError(error);
}

export function refreshClips() {
  revalidatePath('/clips');
  revalidatePath('/content');
}
