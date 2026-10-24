import { apiError, jsonError, requireApiRole } from '@/lib/auth-api';
import { csvFileName, toCsv } from '@/lib/reports/csv';
import { trendCsvColumns, type TrendCsvSource } from '@/lib/research/csv';
import { trendQuery } from '@/lib/research/queries';
import { researchQuerySchema } from '@/lib/research/schemas';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const MAX_EXPORT_TRENDS = 10_000;

/**
 * Trend arşivini `research/trends.csv` biçiminde indirir (#10). Viewer yeterli;
 * `/research` sayfasıyla aynı filtreler. Kullanıcı oturumu (RLS) ile sorgulanır.
 */
export async function GET(request: Request) {
  const auth = await requireApiRole('viewer');
  if (!auth.ok) return auth.response;
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const filter = researchQuerySchema.safeParse(params);
  if (!filter.success) return jsonError('Geçersiz filtre.', 400);
  try {
    const db = await createSupabaseServerClient();
    let influencerId: string | null = null;
    if (filter.data.inf) {
      const { data, error } = await db
        .from('influencers')
        .select('id')
        .eq('slug', filter.data.inf)
        .maybeSingle();
      if (error) throw new Error(`Influencer okunamadı: ${error.message}`);
      if (!data) return jsonError('Influencer bulunamadı.', 404);
      influencerId = data.id;
    }
    const rows: TrendCsvSource[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await trendQuery(
        db,
        filter.data,
        influencerId,
      ).range(from, from + 999);
      if (error) throw new Error(`Trendler okunamadı: ${error.message}`);
      for (const row of data ?? [])
        rows.push({
          ...row,
          influencer_slug:
            (row.influencer as { slug: string } | null)?.slug ?? null,
        });
      if ((data?.length ?? 0) < 1000) break;
      if (rows.length >= MAX_EXPORT_TRENDS)
        return jsonError('Dışa aktarılacak kayıt çok fazla.', 413);
    }
    const fileName = csvFileName(['trends', filter.data.inf ?? 'tum']);
    return new Response(toCsv(trendCsvColumns, rows), {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
