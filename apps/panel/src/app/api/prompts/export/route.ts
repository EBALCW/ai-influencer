import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import { buildPromptBundle, promptBundleFileName } from '@/lib/prompt-bundle';
import { promptCategories } from '@/lib/prompt-schemas';
import { listPromptLineages, resolveInfluencerSlug } from '@/lib/prompts';

const querySchema = z.object({
  id: z.array(z.uuid()).max(200),
  inf: z.string().max(100).optional(),
  kategori: z.enum(promptCategories).optional(),
});

/**
 * Prompt'ların son versiyonlarını tek bir JSON paketi olarak indirir (#46).
 * Okuma yetkisi yeterli (viewer da kütüphaneyi görür). `id` verilirse sadece seçilenler,
 * verilmezse `/prompts` listesindeki filtreyle (`inf`, `kategori`) görünenlerin hepsi.
 * Dosya tarayıcıya iner; repo public olduğu için repoya commit'lenmez.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireApiRole('viewer');
    if (!auth.ok) return auth.response;

    const params = request.nextUrl.searchParams;
    const parsed = querySchema.safeParse({
      id: params.getAll('id'),
      inf: params.get('inf') || undefined,
      kategori: params.get('kategori') || undefined,
    });
    if (!parsed.success) return jsonError('Dışa aktarma isteği geçersiz.', 400);
    const { id: ids, inf, kategori } = parsed.data;

    const influencer = await resolveInfluencerSlug(inf);
    if (inf && !influencer) return jsonError('Influencer bulunamadı.', 404);
    const rows = (
      await listPromptLineages({ influencerId: influencer?.id })
    ).filter(
      (row) =>
        (!ids.length || (row.id && ids.includes(row.id))) &&
        (!kategori || row.category === kategori),
    );
    if (!rows.length) return jsonError('Dışa aktarılacak prompt yok.', 404);

    const now = new Date();
    return new NextResponse(
      `${JSON.stringify(buildPromptBundle(rows, now), null, 2)}\n`,
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${promptBundleFileName(now)}"`,
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
