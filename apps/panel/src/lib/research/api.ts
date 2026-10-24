import 'server-only';
import { revalidatePath } from 'next/cache';
import { apiError, jsonError } from '@/lib/auth-api';

export function trendDbError(error: { code?: string; message: string }) {
  if (error.code === '42501') return jsonError('Editor yetkisi gerekli.', 403);
  if (error.code === 'P0002') return jsonError('Kayıt bulunamadı.', 404);
  if (error.code === '23505')
    return jsonError(
      error.message.includes('backlog')
        ? error.message
        : 'Bu link bu kapsamda zaten arşivde.',
      409,
    );
  if (error.code === '23503') return jsonError('Influencer bulunamadı.', 400);
  if (error.code === '23514' || error.code === '22023')
    return jsonError(
      error.message && !error.message.includes('violates')
        ? error.message
        : 'Kayıt kurallara uymuyor.',
      422,
    );
  return apiError(error);
}

export function refreshResearch() {
  revalidatePath('/research');
  revalidatePath('/content');
}
