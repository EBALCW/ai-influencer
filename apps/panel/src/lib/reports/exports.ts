import 'server-only';
import { z } from 'zod';
import type { createSupabaseServerClient } from '@/lib/supabase/server';
import { toCsv, type CsvColumn } from './csv';
import { addDays, isIsoDate, periodToUtcRange } from './weekly';

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const exportDatasetSchema = z.enum(['posts', 'metrics', 'costs']);
export type ExportDataset = z.infer<typeof exportDatasetSchema>;

const isoDate = z.string().refine(isIsoDate, 'YYYY-MM-DD bekleniyor');

/** `?inf=<slug>&from=YYYY-MM-DD&to=YYYY-MM-DD` (en fazla 366 gün). */
export const exportQuerySchema = z
  .object({
    inf: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(120)
      .optional(),
    from: isoDate,
    to: isoDate,
  })
  .refine((q) => q.from <= q.to && q.to <= addDays(q.from, 365), {
    message: 'Geçersiz tarih aralığı',
  });

/** PostgREST `max_rows` (1000) sınırı: tüm satırlar sayfa sayfa alınır. */
const PAGE_SIZE = 1000;
export const MAX_EXPORT_ROWS = 50_000;

export class ExportTooLargeError extends Error {
  constructor() {
    super('Dışa aktarılacak kayıt sayısı sınırı aşıyor; dönemi daraltın.');
    this.name = 'ExportTooLargeError';
  }
}

type Page<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}>;

export async function fetchAllPages<T>(
  page: (from: number, to: number) => Page<T>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await page(offset, offset + PAGE_SIZE - 1);
    if (error)
      throw new Error(`Dışa aktarma verisi alınamadı: ${error.message}`);
    rows.push(...(data ?? []));
    if (rows.length > MAX_EXPORT_ROWS) throw new ExportTooLargeError();
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

type Named = { name: string; slug: string } | null;
const one = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? (value[0] ?? null) : (value ?? null);

export type ExportFilter = { influencerId?: string; from: string; to: string };

async function postsCsv(db: Supabase, filter: ExportFilter) {
  const range = periodToUtcRange(filter.from, filter.to);
  const rows = await fetchAllPages((a, b) => {
    let query = db
      .from('posts')
      .select(
        'id, external_id, url, caption, published_at, duration_s, is_short, social_accounts!inner(platform, handle, influencer_id, influencers(name, slug))',
      )
      .gte('published_at', range.start)
      .lt('published_at', range.end);
    if (filter.influencerId)
      query = query.eq('social_accounts.influencer_id', filter.influencerId);
    return query.order('published_at').order('id').range(a, b);
  });
  type PostRow = (typeof rows)[number];
  const account = (row: PostRow) => one(row.social_accounts);
  const influencer = (row: PostRow) =>
    one(account(row)?.influencers as Named | Named[]);
  const columns: CsvColumn<PostRow>[] = [
    { header: 'Yayın zamanı (UTC)', value: (r) => r.published_at },
    { header: 'Influencer', value: (r) => influencer(r)?.name },
    { header: 'Platform', value: (r) => account(r)?.platform },
    { header: 'Hesap', value: (r) => account(r)?.handle },
    { header: 'Post ID', value: (r) => r.id },
    { header: 'Platform post ID', value: (r) => r.external_id },
    { header: 'URL', value: (r) => r.url },
    { header: 'Caption', value: (r) => r.caption },
    { header: 'Süre (sn)', value: (r) => r.duration_s },
    { header: 'Short', value: (r) => r.is_short },
  ];
  return toCsv(columns, rows);
}

async function metricsCsv(db: Supabase, filter: ExportFilter) {
  const range = periodToUtcRange(filter.from, filter.to);
  const rows = await fetchAllPages((a, b) => {
    let query = db
      .from('metric_snapshots')
      .select(
        'id, post_id, captured_at, hours_since_publish, views, reach, likes, comments, shares, saves, avg_watch_time_s, completion_rate, posts!inner(url, social_accounts!inner(platform, handle, influencer_id, influencers(name)))',
      )
      .gte('captured_at', range.start)
      .lt('captured_at', range.end);
    if (filter.influencerId)
      query = query.eq(
        'posts.social_accounts.influencer_id',
        filter.influencerId,
      );
    return query.order('captured_at').order('id').range(a, b);
  });
  type MetricRow = (typeof rows)[number];
  const post = (row: MetricRow) => one(row.posts);
  const account = (row: MetricRow) => one(post(row)?.social_accounts);
  const influencer = (row: MetricRow) =>
    one(
      account(row)?.influencers as { name: string } | { name: string }[] | null,
    );
  const columns: CsvColumn<MetricRow>[] = [
    { header: 'Ölçüm zamanı (UTC)', value: (r) => r.captured_at },
    { header: 'Influencer', value: (r) => influencer(r)?.name },
    { header: 'Platform', value: (r) => account(r)?.platform },
    { header: 'Hesap', value: (r) => account(r)?.handle },
    { header: 'Post ID', value: (r) => r.post_id },
    { header: 'Post URL', value: (r) => post(r)?.url },
    { header: 'Yayından sonra (saat)', value: (r) => r.hours_since_publish },
    { header: 'İzlenme', value: (r) => r.views },
    { header: 'Erişim', value: (r) => r.reach },
    { header: 'Beğeni', value: (r) => r.likes },
    { header: 'Yorum', value: (r) => r.comments },
    { header: 'Paylaşım', value: (r) => r.shares },
    { header: 'Kaydetme', value: (r) => r.saves },
    { header: 'Ort. izlenme süresi (sn)', value: (r) => r.avg_watch_time_s },
    { header: 'Tamamlanma oranı', value: (r) => r.completion_rate },
  ];
  return toCsv(columns, rows);
}

async function costsCsv(db: Supabase, filter: ExportFilter) {
  const rows = await fetchAllPages((a, b) => {
    let query = db
      .from('costs')
      .select(
        'id, incurred_on, category, description, amount, currency, credits, generation_id, influencers(name, slug)',
      )
      .gte('incurred_on', filter.from)
      .lte('incurred_on', filter.to);
    if (filter.influencerId)
      query = query.eq('influencer_id', filter.influencerId);
    return query.order('incurred_on').order('id').range(a, b);
  });
  type CostRow = (typeof rows)[number];
  const columns: CsvColumn<CostRow>[] = [
    { header: 'Tarih', value: (r) => r.incurred_on },
    { header: 'Influencer', value: (r) => one(r.influencers)?.name },
    { header: 'Kategori', value: (r) => r.category },
    { header: 'Açıklama', value: (r) => r.description },
    // numeric: supabase-js string veya number döndürebilir; olduğu gibi yazılır
    { header: 'Tutar', value: (r) => r.amount },
    { header: 'Para birimi', value: (r) => r.currency },
    { header: 'Kredi', value: (r) => r.credits },
    { header: 'Üretim ID', value: (r) => r.generation_id },
  ];
  return toCsv(columns, rows);
}

export function buildExportCsv(
  db: Supabase,
  dataset: ExportDataset,
  filter: ExportFilter,
): Promise<string> {
  if (dataset === 'posts') return postsCsv(db, filter);
  if (dataset === 'metrics') return metricsCsv(db, filter);
  return costsCsv(db, filter);
}
