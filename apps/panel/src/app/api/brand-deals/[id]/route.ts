import { NextResponse } from 'next/server';
import type { Update } from '@ai-influencer/shared';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { brandDbError, idSchema, refreshBrands } from '@/lib/brands/api';
import { dealPatchSchema } from '@/lib/brands/schemas';
import { numericParam } from '@/lib/costs/money';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Context = { params: Promise<{ id: string }> };

/**
 * Deal'i günceller: aşama (pipeline sürükle-bırak), ücret, tarih, brief, teslimatlar.
 * `paid_at` yalnız `paid` aşamasında anlamlıdır; veritabanı trigger'ı paid'e geçişte
 * bugünü yazar, paid'den çıkışta temizler.
 */
export async function PATCH(request: Request, context: Context) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const id = idSchema.safeParse((await context.params).id);
    if (!id.success) return jsonError('Deal bulunamadı.', 404);
    const body = await parseJson(request, dealPatchSchema);
    if (!body.ok) return body.response;
    const input = body.data;
    if (input.paidAt && input.stage && input.stage !== 'paid')
      return jsonError(
        'Ödeme tarihi yalnız "Ödendi" aşamasında girilebilir.',
        400,
      );

    const patch: Update<'brand_deals'> = {};
    if (input.stage !== undefined) patch.stage = input.stage;
    if (input.fee !== undefined)
      patch.fee = input.fee === null ? null : numericParam(input.fee);
    if (input.currency !== undefined) patch.currency = input.currency;
    if (input.dueDate !== undefined) patch.due_date = input.dueDate;
    if (input.paidAt !== undefined) patch.paid_at = input.paidAt;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.deliverables !== undefined)
      patch.deliverables = input.deliverables;
    if (input.brief !== undefined) patch.brief = input.brief;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('brand_deals')
      .update(patch)
      .eq('id', id.data)
      .select('id, stage, paid_at, updated_at')
      .single();
    if (error) return brandDbError(error);
    refreshBrands(id.data);
    return NextResponse.json({ deal: data });
  } catch (error) {
    return apiError(error);
  }
}
