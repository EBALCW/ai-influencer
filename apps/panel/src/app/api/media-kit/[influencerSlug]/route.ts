import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import { buildMediaKit } from '@/lib/media-kit/build';
import { loadMediaKitFonts } from '@/lib/media-kit/fonts';
import { renderMediaKitPdf } from '@/lib/media-kit/pdf';
import { loadMediaKitInput } from '@/lib/media-kit/queries';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Güncel metriklerle medya kiti PDF'i (tek tık). Ekip üyesi olan herkes (viewer dahil)
 * indirebilir; oturum yoksa 401, ekip dışıysa 403. Veriler RLS ile okunur.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ influencerSlug: string }> },
) {
  try {
    const auth = await requireApiRole('viewer');
    if (!auth.ok) return auth.response;
    const { influencerSlug } = await context.params;
    if (!SLUG.test(influencerSlug) || influencerSlug.length > 100)
      return jsonError('Influencer bulunamadı.', 404);

    const now = new Date();
    const input = await loadMediaKitInput(influencerSlug, now);
    if (!input) return jsonError('Influencer bulunamadı.', 404);
    const pdf = await renderMediaKitPdf(
      buildMediaKit(input),
      await loadMediaKitFonts(),
      now,
    );
    const day = now.toISOString().slice(0, 10);
    return new Response(Buffer.from(pdf), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="medya-kiti-${influencerSlug}-${day}.pdf"`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
