import { NextResponse, type NextRequest } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { numericParam } from '@/lib/costs/money';
import { budgetSchema } from '@/lib/costs/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Aylık bütçe tavanını oluşturur veya günceller. Sadece owner.
 * Benzersizlik kısmi indekslerle (influencer başına + toplam) sağlandığı için
 * supabase-js upsert/onConflict kullanılamaz: önce aranır, sonra güncellenir/eklenir.
 */
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireApiRole('owner');
    if (!auth.ok) return auth.response;

    const body = await parseJson(request, budgetSchema);
    if (!body.ok) return body.response;
    const input = body.data;
    const month = `${input.month}-01`;

    const supabase = await createSupabaseServerClient();
    let existing = supabase.from('budgets').select('id').eq('month', month);
    existing = input.influencerId
      ? existing.eq('influencer_id', input.influencerId)
      : existing.is('influencer_id', null);
    const found = await existing.maybeSingle();
    if (found.error) throw new Error(`Bütçe okunamadı: ${found.error.message}`);

    const values = {
      amount: numericParam(input.amount),
      currency: input.currency,
      warn_ratio: numericParam(input.warnRatio),
    };
    const result = found.data
      ? await supabase
          .from('budgets')
          .update(values)
          .eq('id', found.data.id)
          .select('id')
          .single()
      : await supabase
          .from('budgets')
          .insert({ ...values, month, influencer_id: input.influencerId })
          .select('id')
          .single();
    if (result.error) {
      if (result.error.code === '42501')
        return jsonError('Sadece owner bütçe değiştirebilir.', 403);
      if (result.error.code === '23505')
        return jsonError('Bu ay için bütçe zaten var, sayfayı yenile.', 409);
      if (result.error.code === '23503')
        return jsonError('Influencer bulunamadı.', 400);
      throw new Error(`Bütçe kaydedilemedi: ${result.error.message}`);
    }
    return NextResponse.json(
      { id: result.data.id },
      { status: found.data ? 200 : 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
