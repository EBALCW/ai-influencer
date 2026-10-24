import 'server-only';
import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { apiError, jsonError } from '@/lib/auth-api';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { contentSchema, type ContentInput } from './schemas';
import { stageRule } from './stage-rules';
import {
  SCORER_IS_PRODUCER_MESSAGE,
  SOURCE_MISSING_MESSAGE,
  sourceDetailsError,
} from './source-rules';

export const contentIdSchema = z.string().uuid();
/** Migration HINT'i → kullanıcı mesajı (#145, #22). */
const reviewBlockers: Record<string, string> = {
  source_missing: SOURCE_MISSING_MESSAGE,
  scorer_is_producer: SCORER_IS_PRODUCER_MESSAGE,
};
export function contentDbError(error: {
  code?: string;
  message: string;
  hint?: string | null;
}) {
  if (error.code === '23514' && error.hint && reviewBlockers[error.hint])
    return jsonError(reviewBlockers[error.hint]!, 422);
  if (error.code === '42501') return jsonError('Editor yetkisi gerekli.', 403);
  if (error.code === 'P0002') return jsonError('Kayıt bulunamadı.', 404);
  if (error.code === '40001')
    return jsonError(
      'İçerik başka biri tarafından değiştirildi; sayfayı yenileyin.',
      409,
    );
  if (error.code === '23505')
    return jsonError('Bu kayıt zaten var veya başka bir içeriğe bağlı.', 409);
  if (error.code === '23514' || error.code === '23503')
    return jsonError(
      'Yayın kontrollerini, hedef hesabı ve medya bağlantılarını kontrol edin.',
      422,
    );
  return apiError(error);
}
export function refreshContent() {
  revalidatePath('/content');
  revalidatePath('/calendar');
}
export async function saveContent(
  id: string | null,
  input: ContentInput,
  expected?: string,
) {
  const rule = stageRule(input.stage, input.checklist);
  if (!rule.ok) return jsonError(rule.error, 422);
  const sourceError = sourceDetailsError(input);
  if (sourceError) return jsonError(sourceError, 422);
  if (
    ['scheduled', 'published'].includes(rule.stage) &&
    (!input.target_account_id || !input.scheduled_at)
  ) {
    return jsonError('Hedef hesap ve yayın zamanı gerekli.', 422);
  }
  const { asset_ids, generation_ids, ...values } = contentSchema.parse(input);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('save_content_item', {
    p_id: id!,
    p_values: { ...values, stage: rule.stage },
    ...(asset_ids ? { p_asset_ids: asset_ids } : {}),
    ...(generation_ids ? { p_generation_ids: generation_ids } : {}),
    ...(expected ? { p_expected_updated_at: expected } : {}),
  });
  if (error) return contentDbError(error);
  refreshContent();
  return NextResponse.json({ item: data }, { status: id ? 200 : 201 });
}
