import { NextResponse, type NextRequest } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { numericParam } from '@/lib/costs/money';
import { costEntrySchema } from '@/lib/costs/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Manuel maliyet kaydı (abonelik, kredi alımı, araç, diğer). En az editor.
 * Bütçe uyarısı veritabanı trigger'ında üretilir; burada ayrıca bir şey yapılmaz.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;

    const body = await parseJson(request, costEntrySchema);
    if (!body.ok) return body.response;
    const entry = body.data;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('costs')
      .insert({
        influencer_id: entry.influencerId,
        category: entry.category,
        description: entry.description,
        amount: numericParam(entry.amount),
        currency: entry.currency,
        credits: entry.credits ? numericParam(entry.credits) : null,
        incurred_on: entry.incurredOn,
      })
      .select('id')
      .single();
    if (error) {
      if (error.code === '42501')
        return jsonError('Bu işlem için yetkin yok.', 403);
      if (error.code === '23503')
        return jsonError('Influencer bulunamadı.', 400);
      throw new Error(`Maliyet kaydedilemedi: ${error.message}`);
    }
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
