import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import { csvFileName } from '@/lib/reports/csv';
import {
  buildExportCsv,
  ExportTooLargeError,
  exportDatasetSchema,
  exportQuerySchema,
} from '@/lib/reports/exports';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * CSV dışa aktarma: GET /api/exports/{posts|metrics|costs}?inf=<slug>&from=&to=
 * Okuma işlemi (viewer yeterli). Sorgu kullanıcının oturumuyla yapılır, RLS geçerli;
 * service role kullanılmaz. `inf` verilirse sadece o influencer'ın satırları döner.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ dataset: string }> },
) {
  const auth = await requireApiRole('viewer');
  if (!auth.ok) return auth.response;

  const dataset = exportDatasetSchema.safeParse((await context.params).dataset);
  if (!dataset.success)
    return jsonError(
      'Geçersiz veri seti. posts, metrics veya costs olmalı.',
      400,
    );

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = exportQuerySchema.safeParse(params);
  if (!query.success)
    return jsonError(
      'Geçersiz filtre: from/to (YYYY-MM-DD) ve inf kontrol edin.',
      400,
    );

  try {
    const db = await createSupabaseServerClient();
    let influencerId: string | undefined;
    if (query.data.inf) {
      const { data, error } = await db
        .from('influencers')
        .select('id')
        .eq('slug', query.data.inf)
        .maybeSingle();
      if (error) throw new Error(`Influencer okunamadı: ${error.message}`);
      if (!data) return jsonError('Influencer bulunamadı.', 404);
      influencerId = data.id;
    }

    const csv = await buildExportCsv(db, dataset.data, {
      influencerId,
      from: query.data.from,
      to: query.data.to,
    });
    const fileName = csvFileName([
      dataset.data,
      query.data.inf ?? 'tum-influencerlar',
      query.data.from,
      query.data.to,
    ]);
    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof ExportTooLargeError)
      return jsonError(error.message, 413);
    return apiError(error);
  }
}
