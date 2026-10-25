import { NextResponse } from 'next/server';
import { apiError, jsonError, parseJson, requireApiRole } from '@/lib/auth-api';
import { brandDbError, refreshBrands } from '@/lib/brands/api';
import { commentDbError, refreshInbox } from '@/lib/inbox/api';
import { commentIdSchema, leadRequestSchema } from '@/lib/inbox/schemas';
import { platformLabels } from '@/lib/analytics/links';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const likeEscape = (value: string) => value.replace(/[\\%_]/g, '\\$&');

/**
 * Yorumdan marka lead'i (#61 → #60): var olan ya da yeni markaya 'lead' aşamasında deal açar
 * ve yorumu deal'e bağlar. Deal notuna yalnız kaynak (platform, yorum kimliği, tarih, post linki)
 * yazılır; yorum metni ve yazarın adı CRM'e kopyalanmaz (yorumlar 90 günde silinir, deal notu
 * kalıcıdır). Yazar gerekiyorsa deal'e bağlı yorumdan bakılır. Yorum zaten bir deal'e bağlıysa 409.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireApiRole('editor');
    if (!auth.ok) return auth.response;
    const id = commentIdSchema.safeParse((await params).id);
    if (!id.success) return jsonError('Geçersiz yorum.', 400);
    const body = await parseJson(request, leadRequestSchema);
    if (!body.ok) return body.response;

    const db = await createSupabaseServerClient();
    const comment = await db
      .from('comments')
      .select(
        'id, platform, published_at, brand_deal_id, posts(url), social_accounts(influencer_id)',
      )
      .eq('id', id.data)
      .maybeSingle();
    if (comment.error) return commentDbError(comment.error);
    const influencerId = comment.data?.social_accounts?.influencer_id;
    if (!comment.data || !influencerId)
      return jsonError('Yorum bulunamadı.', 404);
    if (comment.data.brand_deal_id)
      return NextResponse.json(
        {
          error: 'Bu yorumdan zaten lead açılmış.',
          dealId: comment.data.brand_deal_id,
        },
        { status: 409 },
      );

    let brandId = body.data.brandId ?? null;
    if (!brandId) {
      const name = body.data.brandName!;
      const find = () =>
        db
          .from('brands')
          .select('id')
          .ilike('name', likeEscape(name))
          .limit(1)
          .maybeSingle();
      const found = await find();
      if (found.error) return brandDbError(found.error);
      brandId = found.data?.id ?? null;
      if (!brandId) {
        const created = await db
          .from('brands')
          .insert({ name })
          .select('id')
          .single();
        if (created.error && created.error.code !== '23505')
          return brandDbError(created.error);
        // Eşzamanlı oluşturma: benzersiz ad (lower(name)) çakıştıysa mevcut marka kullanılır.
        brandId = created.data?.id ?? (await find()).data?.id ?? null;
        if (!brandId) return jsonError('Marka oluşturulamadı.', 409);
      }
    }

    const source = [
      `Kaynak: ${platformLabels[comment.data.platform]} yorumu`,
      `yorum ${comment.data.id}`,
      comment.data.published_at.slice(0, 10),
      comment.data.posts?.url ?? '',
    ]
      .filter(Boolean)
      .join(' · ');
    const deal = await db
      .from('brand_deals')
      .insert({
        brand_id: brandId,
        influencer_id: influencerId,
        stage: 'lead',
        notes: `${source}\nGelen kutusundan oluşturuldu.`,
      })
      .select('id')
      .single();
    if (deal.error) return brandDbError(deal.error);

    const link = await db
      .from('comments')
      .update({ brand_deal_id: deal.data.id })
      .eq('id', id.data)
      .is('brand_deal_id', null)
      .select('id')
      .maybeSingle();
    if (link.error) return commentDbError(link.error);
    refreshInbox();
    refreshBrands(deal.data.id);
    return NextResponse.json({ dealId: deal.data.id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
