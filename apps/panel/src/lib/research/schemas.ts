import { z } from 'zod';

/**
 * Trend arşivi (#10) sözlükleri. Veritabanında ASCII anahtar tutulur
 * (`supabase/migrations/20261024110000_trend_archive.sql` CHECK'leri), arayüz ve
 * CSV Türkçe değerleri kullanır (#10 → `research/trends.csv`).
 */
export const trendPlatforms = [
  'instagram',
  'tiktok',
  'youtube',
  'other',
] as const;
export type TrendPlatform = (typeof trendPlatforms)[number];
export const platformLabels: Record<TrendPlatform, string> = {
  instagram: 'Instagram',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  other: 'Diğer',
};

export const trendFormats = [
  'dance',
  'transformation',
  'short_film',
  'pov',
  'meme',
  'lip_sync',
  'outfit',
  'other',
] as const;
export type TrendFormat = (typeof trendFormats)[number];
/** #10 format sözlüğü; CSV'ye bu değerler yazılır. */
export const formatCsvValues: Record<TrendFormat, string> = {
  dance: 'dans',
  transformation: 'dönüşüm',
  short_film: 'kısa_film',
  pov: 'pov',
  meme: 'meme',
  lip_sync: 'lip_sync',
  outfit: 'outfit',
  other: 'diğer',
};
export const formatLabels: Record<TrendFormat, string> = {
  dance: 'Dans',
  transformation: 'Dönüşüm',
  short_film: 'Kısa film',
  pov: 'POV',
  meme: 'Meme',
  lip_sync: 'Lip sync',
  outfit: 'Outfit',
  other: 'Diğer',
};

export const trendStatuses = [
  'new',
  'shortlisted',
  'used',
  'rejected',
] as const;
export type TrendStatus = (typeof trendStatuses)[number];
/** #10 durum sözlüğü (yeni/seçildi/üretildi/elendi). */
export const statusCsvValues: Record<TrendStatus, string> = {
  new: 'yeni',
  shortlisted: 'seçildi',
  used: 'üretildi',
  rejected: 'elendi',
};
export const statusLabels: Record<TrendStatus, string> = {
  new: 'Yeni',
  shortlisted: 'Seçildi',
  used: 'Backlog’da',
  rejected: 'Elendi',
};

export const costEstimates = ['low', 'medium', 'high'] as const;
export type CostEstimate = (typeof costEstimates)[number];
export const costCsvValues: Record<CostEstimate, string> = {
  low: 'düşük',
  medium: 'orta',
  high: 'yüksek',
};

export const trendSources = ['manual', 'claude'] as const;
export type TrendSource = (typeof trendSources)[number];
export const sourceLabels: Record<TrendSource, string> = {
  manual: 'Elle',
  claude: 'Claude',
};

const platformHosts: Array<[RegExp, TrendPlatform]> = [
  [/(^|\.)instagram\.com$|(^|\.)instagr\.am$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, 'youtube'],
];

/** Linkin alan adından platformu bulur; tanınmayan veya geçersiz link `other`. */
export function detectPlatform(url: string): TrendPlatform {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  return platformHosts.find(([pattern]) => pattern.test(host))?.[1] ?? 'other';
}

export const trendUrlSchema = z
  .string()
  .trim()
  .max(2000, 'Link en fazla 2000 karakter olabilir.')
  .pipe(z.url({ message: 'Geçerli bir link girin (https://…).' }))
  .refine((url) => /^https?:\/\/[^\s/]+/i.test(url), {
    message: 'Link http(s):// ile başlamalı.',
  });

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable();
const text = (max: number) => z.string().trim().max(max);
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    { message: 'Geçerli bir tarih girin (YYYY-AA-GG).' },
  );

export const trendSchema = z
  .object({
    url: trendUrlSchema,
    platform: z.enum(trendPlatforms).optional(),
    influencer_id: z.string().uuid().nullable().default(null),
    captured_on: isoDate.optional(),
    account_handle: text(100).default(''),
    views: count.default(null),
    likes: count.default(null),
    comments: count.default(null),
    duration_s: z.number().int().min(0).max(36000).nullable().default(null),
    format: z.enum(trendFormats).default('other'),
    hook: text(500).default(''),
    sound: text(300).default(''),
    why_viral: text(1000).default(''),
    adaptation_idea: text(2000).default(''),
    adaptation_score: z.number().int().min(1).max(5).nullable().default(null),
    cost_estimate: z.enum(costEstimates).nullable().default(null),
    status: z.enum(trendStatuses).default('new'),
    source: z.enum(trendSources).default('manual'),
    notes: text(3000).default(''),
  })
  .strict()
  // Platform verilmezse linkten bulunur.
  .transform((input) => ({
    ...input,
    platform: input.platform ?? detectPlatform(input.url),
  }));
export type TrendInput = z.output<typeof trendSchema>;

/** PATCH: yalnız gönderilen alanlar değişir. `used` durumu yalnız backlog aktarımıyla gelir. */
export const trendPatchSchema = z
  .object({
    url: trendUrlSchema.optional(),
    platform: z.enum(trendPlatforms).optional(),
    influencer_id: z.string().uuid().nullable().optional(),
    captured_on: isoDate.optional(),
    account_handle: text(100).optional(),
    views: count.optional(),
    likes: count.optional(),
    comments: count.optional(),
    duration_s: z.number().int().min(0).max(36000).nullable().optional(),
    format: z.enum(trendFormats).optional(),
    hook: text(500).optional(),
    sound: text(300).optional(),
    why_viral: text(1000).optional(),
    adaptation_idea: text(2000).optional(),
    adaptation_score: z.number().int().min(1).max(5).nullable().optional(),
    cost_estimate: z.enum(costEstimates).nullable().optional(),
    status: z.enum(['new', 'shortlisted', 'rejected']).optional(),
    source: z.enum(trendSources).optional(),
    notes: text(3000).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Değiştirilecek alan yok.',
  });
export type TrendPatch = z.infer<typeof trendPatchSchema>;

export const backlogSchema = z
  .object({
    influencer_id: z.string().uuid().nullable().default(null),
    title: text(200).default(''),
  })
  .strict();

export const researchSorts = ['score', 'recent', 'views'] as const;
export type ResearchSort = (typeof researchSorts)[number];
export const sortLabels: Record<ResearchSort, string> = {
  score: 'Uyarlama puanı',
  recent: 'Kayıt tarihi',
  views: 'İzlenme',
};

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.literal(''), z.enum(values)])
    .optional()
    .transform((value) => value || undefined);

/** `/research` ve CSV dışa aktarma filtreleri (URL parametreleri). */
export const researchQuerySchema = z.object({
  inf: z
    .string()
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  status: optionalEnum(trendStatuses),
  platform: optionalEnum(trendPlatforms),
  format: optionalEnum(trendFormats),
  scope: optionalEnum(['global', 'specific'] as const),
  min: z
    .union([z.literal(''), z.coerce.number().int().min(1).max(5)])
    .optional()
    .transform((value) => (value === '' ? undefined : value)),
  sort: z.enum(researchSorts).default('score'),
});
export type ResearchQuery = z.infer<typeof researchQuerySchema>;
