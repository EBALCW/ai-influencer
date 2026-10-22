import { NextResponse } from 'next/server';
import { apiError, parseJson, requireApiRole } from '@/lib/auth-api';
import { brandDbError, refreshBrands } from '@/lib/brands/api';
import { dealCreateSchema } from '@/lib/brands/schemas';
import { numericParam } from '@/lib/costs/money';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/** Yeni deal açar (varsayılan aşama Lead). En az editor. */
export async function POST(request: Request) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const body = await parseJson(request, dealCreateSchema);
    if (!body.ok) return body.response;
    const deal = body.data;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('brand_deals')
      .insert({
        brand_id: deal.brandId,
        influencer_id: deal.influencerId,
        stage: deal.stage,
        // Tutar float'a çevrilmeden string olarak gider (numeric)
        fee: deal.fee ? numericParam(deal.fee) : null,
        currency: deal.currency,
        due_date: deal.dueDate ?? null,
        notes: deal.notes,
      })
      .select('id')
      .single();
    if (error) return brandDbError(error);
    refreshBrands();
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
