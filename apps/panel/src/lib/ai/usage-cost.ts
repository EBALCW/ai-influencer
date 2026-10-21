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
};

const MILLION = 1_000_000n;

/**
 * Token kullanımının maliyeti, 4 ondalık basamakta (numeric(14,4)) string.
 * Hesap bigint ile yapılır; float yuvarlama hatası yok.
 * Not: inputTokens, cache'ten okunan token'ları içermez (Anthropic usage alanları ayrıdır).
 */
export function estimateAiCost(usage: AiUsage, pricing: AiPricing): string {
  const part = (tokens: number, perMTok: Decimal | undefined) => {
    if (!Number.isInteger(tokens) || tokens < 0)
      throw new RangeError('Token sayısı negatif olmayan tamsayı olmalı');
    if (!perMTok || tokens === 0) return 0n;
    // (tokens * fiyat) / 1M, yarım-yukarı yuvarlama
    return (BigInt(tokens) * toMinor(perMTok) + MILLION / 2n) / MILLION;
  };
  return fromMinor(
    part(usage.inputTokens, pricing.inputPerMTok) +
      part(usage.outputTokens, pricing.outputPerMTok) +
      part(usage.cacheReadInputTokens, pricing.cacheReadPerMTok),
  );
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
  if (error) throw new Error(`AI maliyeti kaydedilemedi: ${error.message}`);
  return { id: data.id, amount };
}
