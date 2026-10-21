import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ai-influencer/shared';
import type { AiUsage } from './claude';
import {
  fromMinor,
  numericParam,
  toMinor,
  type Decimal,
} from '@/lib/costs/money';

/** Milyon token başına fiyat (sağlayıcının fiyat sayfasından, para birimiyle). */
export type AiPricing = {
  currency: string;
  inputPerMTok: Decimal;
  outputPerMTok: Decimal;
  cacheReadPerMTok?: Decimal;
  cacheWritePerMTok?: Decimal;
  cacheWrite1hPerMTok?: Decimal;
};

const MILLION = 1_000_000n;

/**
 * Token kullanımının maliyeti, 4 ondalık basamakta (numeric(14,4)) string.
 * Hesap bigint ile yapılır; float yuvarlama hatası yok.
 * Not: inputTokens, cache'ten okunan token'ları içermez (Anthropic usage alanları ayrıdır).
 */
export function estimateAiCost(usage: AiUsage, pricing: AiPricing): string {
  const part = (tokens: number, perMTok: Decimal | undefined) => {
    if (!Number.isSafeInteger(tokens) || tokens < 0)
      throw new RangeError('Token sayısı negatif olmayan tamsayı olmalı');
    if (tokens === 0) return 0n;
    if (perMTok === undefined)
      throw new RangeError('Kullanılan token türünün fiyatı eksik');
    const price = toMinor(perMTok);
    if (price < 0n) throw new RangeError('Token fiyatı negatif olamaz');
    return BigInt(tokens) * price;
  };
  const numerator =
    part(usage.inputTokens, pricing.inputPerMTok) +
    part(usage.outputTokens, pricing.outputPerMTok) +
    part(usage.cacheReadInputTokens, pricing.cacheReadPerMTok) +
    part(usage.cacheCreationInputTokens ?? 0, pricing.cacheWritePerMTok) +
    part(usage.cacheCreation1hInputTokens ?? 0, pricing.cacheWrite1hPerMTok);
  // Bileşenleri ayrı yuvarlamak küçük çağrıları fazla/eksik ücretlendirir.
  return fromMinor((numerator + MILLION / 2n) / MILLION);
}

/**
 * AI çağrısının maliyetini `costs` tablosuna `ai_api` kategorisiyle yazar.
 * Çağıran kullanıcının oturumuyla (RLS) yazılır; viewer yazamaz.
 * Bütçe uyarısı veritabanı trigger'ı ile otomatik kontrol edilir.
 */
export async function recordAiUsage(
  supabase: SupabaseClient<Database>,
  input: {
    influencerId: string;
    model: string;
    usage: AiUsage;
    pricing: AiPricing;
    incurredOn: string;
  },
): Promise<{ id: string; amount: string }> {
  const amount = estimateAiCost(input.usage, input.pricing);
  const { data, error } = await supabase
    .from('costs')
    .insert({
      influencer_id: input.influencerId,
      category: 'ai_api',
      description: `${input.model} · ${input.usage.inputTokens} giriş / ${input.usage.outputTokens} çıkış token`,
      amount: numericParam(amount),
      currency: input.pricing.currency,
      incurred_on: input.incurredOn,
    })
    .select('id')
    .single();
  if (error) throw new Error('AI maliyeti kaydedilemedi.');
  return { id: data.id, amount };
}
