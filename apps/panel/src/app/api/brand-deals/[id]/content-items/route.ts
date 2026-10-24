import { NextResponse } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { brandDbError, idSchema, refreshBrands } from '@/lib/brands/api';
import { contentLinkSchema } from '@/lib/brands/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type Context = { params: Promise<{ id: string }> };

/**
 * Deal'e içerik kartı bağlar. İçeriğin deal ile aynı influencer'a ait olması veritabanı
 * trigger'ında doğrulanır (422). En az editor.
 */
export async function POST(request: Request, context: Context) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const id = idSchema.safeParse((await context.params).id);
    if (!id.success) return jsonError('Deal bulunamadı.', 404);
    const body = await parseJson(request, contentLinkSchema);
    if (!body.ok) return body.response;

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('brand_deal_content_items')
      .insert({
        brand_deal_id: id.data,
        content_item_id: body.data.contentItemId,
      })
      .select('id')
      .single();
    if (error) return brandDbError(error);
    refreshBrands(id.data);
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

/** İçerik bağlantısını kaldırır (içerik kartı silinmez). */
export async function DELETE(request: Request, context: Context) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const id = idSchema.safeParse((await context.params).id);
    if (!id.success) return jsonError('Deal bulunamadı.', 404);
    const body = await parseJson(request, contentLinkSchema);
    if (!body.ok) return body.response;

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from('brand_deal_content_items')
      .delete()
      .eq('brand_deal_id', id.data)
      .eq('content_item_id', body.data.contentItemId)
      .select('id')
      .single();
    if (error) return brandDbError(error);
    refreshBrands(id.data);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error);
  }
}
