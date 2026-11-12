import { z } from 'zod';

/**
 * Rapor dönemi ve özet yardımcıları (#62). Saf fonksiyonlar, istemcide de çalışır.
 *
 * Hafta pazartesi 00:00 – pazar 23:59:59, hedef saat dilimi Europe/Istanbul.
 * Dönem metin tarihleri (YYYY-MM-DD) olarak taşınır; sayıları veritabanındaki
 * `report_summary()` aynı sınırlarla hesaplar. CSV dışa aktarma için tarih
 * aralığı `periodToUtcRange` ile UTC anlarına çevrilir.
 */
export const REPORT_TIMEZONE = 'Europe/Istanbul';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Gerçek bir takvim günü mü (2026-02-30 değil)? */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
}

function toUtcDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const value = toUtcDate(date);
  value.setUTCDate(value.getUTCDate() + days);
  return fromUtcDate(value);
}

/** Bir anın hedef saat dilimindeki takvim günü. */
export function localDate(instant: Date, timeZone = REPORT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Günün ait olduğu haftanın pazartesisi. */
export function weekStart(date: string): string {
  const day = toUtcDate(date).getUTCDay(); // pazar = 0
  return addDays(date, -((day + 6) % 7));
}

/** Türkiye saatine göre biten son hafta (otomatik raporun dönemi). */
export function lastCompletedWeekStart(now = new Date()): string {
  return addDays(weekStart(localDate(now)), -7);
}

export type PeriodKind = 'week' | 'month';
export type ReportPeriod = {
  kind: PeriodKind;
  from: string;
  to: string;
};

/** `?period=week|month&date=YYYY-MM-DD` → dönem. Geçersiz değerlerde bu hafta. */
export function resolvePeriod(
  input: { period?: string; date?: string },
  now = new Date(),
): ReportPeriod {
  const kind: PeriodKind = input.period === 'month' ? 'month' : 'week';
  const date = isIsoDate(input.date) ? input.date : localDate(now);
  if (kind === 'week') {
    const from = weekStart(date);
    return { kind, from, to: addDays(from, 6) };
  }
  const from = `${date.slice(0, 7)}-01`;
  const next = toUtcDate(from);
  next.setUTCMonth(next.getUTCMonth() + 1);
  return { kind, from, to: addDays(fromUtcDate(next), -1) };
}

/** Önceki/sonraki dönemin `date` parametresi. */
export function shiftPeriod(period: ReportPeriod, delta: number): string {
  if (period.kind === 'week') return addDays(period.from, delta * 7);
  const value = toUtcDate(period.from);
  value.setUTCMonth(value.getUTCMonth() + delta);
  return fromUtcDate(value);
}

/** Saat dilimi farkı (ms): yerel duvar saati - UTC. */
function zoneOffset(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const wall = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return wall - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Yerel gece yarısının UTC anı (yaz saati geçişlerinde de doğru). */
export function zonedMidnightUtc(
  date: string,
  timeZone = REPORT_TIMEZONE,
): Date {
  const guess = toUtcDate(date).getTime();
  const first = guess - zoneOffset(new Date(guess), timeZone);
  return new Date(guess - zoneOffset(new Date(first), timeZone));
}

/** [from 00:00, to + 1 gün 00:00) yerel aralığı, UTC ISO metinleri olarak. */
export function periodToUtcRange(
  from: string,
  to: string,
  timeZone = REPORT_TIMEZONE,
): { start: string; end: string } {
  return {
    start: zonedMidnightUtc(from, timeZone).toISOString(),
    end: zonedMidnightUtc(addDays(to, 1), timeZone).toISOString(),
  };
}

export function formatPeriod(period: { from: string; to: string }): string {
  const fmt = new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${fmt.format(toUtcDate(period.from))} – ${fmt.format(toUtcDate(period.to))}`;
}

// ---------- Özet (report_summary() jsonb çıktısı) ----------

const count = z.coerce.number().int().nonnegative();
const nullableNumber = z.coerce.number().nullable().optional();

const reportPostSchema = z.object({
  postId: z.string(),
  platform: z.string(),
  handle: z.string(),
  caption: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  publishedAt: z.string(),
  views: nullableNumber,
  engagement: nullableNumber,
});

export const reportSummarySchema = z.object({
  version: z.literal(1),
  timezone: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  currency: z.string(),
  followers: z.object({
    accounts: count,
    accountsWithBaseline: count,
    start: nullableNumber,
    end: nullableNumber,
    delta: nullableNumber,
  }),
  postsPublished: count,
  views: count,
  engagement: count,
  engagementRate: nullableNumber,
  postsWithoutBaseline: count,
  cost: z.object({
    entryCount: count,
    missingRateCount: count,
    total: nullableNumber,
    perVideo: nullableNumber,
  }),
  topPosts: z.array(reportPostSchema),
  bottomPosts: z.array(reportPostSchema),
  learnings: z
    .object({
      count,
      items: z.array(
        z.object({
          id: z.string(),
          body: z.string(),
          tags: z.array(z.string()),
          postId: z.string().nullable(),
          createdAt: z.string(),
        }),
      ),
    })
    .default({ count: 0, items: [] }),
  nextPeriod: z.object({
    scheduledCount: count,
    items: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        stage: z.string(),
        scheduledAt: z.string(),
      }),
    ),
  }),
});

export type ReportSummary = z.infer<typeof reportSummarySchema>;
export type ReportPost = z.infer<typeof reportPostSchema>;

/** Veritabanı çıktısını doğrular; tanınmayan biçimde null döner (uydurma değer yok). */
export function parseReportSummary(value: unknown): ReportSummary | null {
  const parsed = reportSummarySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Dönemde gösterilecek hiçbir ölçüm yoksa true (EmptyState için). */
export function isEmptySummary(summary: ReportSummary): boolean {
  return (
    summary.postsPublished === 0 &&
    summary.views === 0 &&
    summary.engagement === 0 &&
    summary.followers.end == null &&
    summary.cost.entryCount === 0 &&
    summary.learnings.count === 0 &&
    summary.nextPeriod.scheduledCount === 0
  );
}

export function formatCount(value: number | null | undefined): string {
  return value == null ? '—' : new Intl.NumberFormat('tr-TR').format(value);
}

export function formatSigned(value: number | null | undefined): string {
  if (value == null) return '—';
  const text = formatCount(Math.abs(value));
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text;
}

export function formatRate(value: number | null | undefined): string {
  return value == null ? '—' : `%${(value * 100).toFixed(1)}`;
}

// ---------- Gelecek hafta aksiyonları (#24, reports.actions) ----------

export const MAX_REPORT_ACTIONS = 3;

/** 0–3 aksiyon, her biri 1–300 karakter; boş satırlar atılır. Veritabanı aynı kuralı denetler. */
export const reportActionsSchema = z
  .array(z.string())
  .transform((items) => items.map((item) => item.trim()).filter(Boolean))
  .pipe(z.array(z.string().max(300)).max(MAX_REPORT_ACTIONS));
