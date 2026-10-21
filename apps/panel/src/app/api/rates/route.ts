import { NextResponse, type NextRequest } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { numericParam } from '@/lib/costs/money';
import { rateSchema } from '@/lib/costs/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Kur (exchange) veya kredi fiyatı (credit) ekler. Sadece owner. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole('owner');
    if (!auth.ok) return auth.response;

    const body = await parseJson(request, rateSchema);
    if (!body.ok) return body.response;
    const input = body.data;

    const supabase = await createSupabaseServerClient();
    let result;
    if (input.kind === 'exchange') {
      if (input.currency === input.baseCurrency)
        return jsonError('Kaynak ve hedef para birimi farklı olmalı.', 400);
      result = await supabase
        .from('exchange_rates')
        .insert({
          currency: input.currency,
          base_currency: input.baseCurrency,
          rate: numericParam(input.rate),
          valid_on: input.validOn,
        })
        .select('id')
        .single();
    } else {
      result = await supabase
        .from('credit_rates')
        .insert({
          tool: input.tool,
          currency: input.currency,
          rate_per_credit: numericParam(input.rate),
          valid_from: input.validFrom,
        })
        .select('id')
        .single();
    }
    if (result.error) {
      if (result.error.code === '42501')
        return jsonError('Sadece owner oran ekleyebilir.', 403);
      if (result.error.code === '23505')
        return jsonError('Bu tarih için oran zaten var.', 409);
      throw new Error(`Oran kaydedilemedi: ${result.error.message}`);
    }
    return NextResponse.json({ id: result.data.id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
