import { z } from 'zod';
import type { BrandDealStage } from '@ai-influencer/shared';
import { supportedCurrencies } from '@/lib/costs/schemas';

export type DealStage = BrandDealStage;

/** UI sırası: Lead → Görüşme → Anlaşma → Teslim → Ödendi / Kaybedildi */
export const dealStages = [
  ['lead', 'Lead'],
  ['negotiation', 'Görüşme'],
  ['signed', 'Anlaşma'],
  ['delivered', 'Teslim'],
  ['paid', 'Ödendi'],
  ['lost', 'Kaybedildi'],
] as const satisfies ReadonlyArray<readonly [DealStage, string]>;

export const dealStageKeys = dealStages.map(([key]) => key) as [
  DealStage,
  ...DealStage[],
];
export const dealStageLabels = Object.fromEntries(dealStages) as Record<
  DealStage,
  string
>;

export const dealCurrencies = supportedCurrencies;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

/** numeric(14,2): string olarak taşınır, float yok. */
const fee = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, 'En fazla 2 ondalık basamaklı tutar girin.');
const currency = z.enum(dealCurrencies);
const isoDate = z.iso.date();

export const brandSchema = z.object({
  name: z.string().trim().min(1, 'Marka adı gerekli.').max(120),
  website: z
    .string()
    .trim()
    .max(300)
    .refine(
      (value) => value === '' || /^https?:\/\/[^\s]+$/i.test(value),
      'Web sitesi http(s):// ile başlamalı.',
    )
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
  contactName: optionalText(120),
  contactEmail: z
    .union([z.literal(''), z.email().max(254)])
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
  notes: z.string().trim().max(5000).default(''),
});
export type BrandInput = z.infer<typeof brandSchema>;
// Kısmi güncellemede varsayılan değer (notes: '') gönderilmeyen alanı ezmesin
export const brandPatchSchema = brandSchema
  .extend({ notes: z.string().trim().max(5000) })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Değişiklik yok.');

export const deliverableSchema = z.object({
  title: z.string().trim().min(1).max(200),
  done: z.boolean().default(false),
});
export type Deliverable = z.infer<typeof deliverableSchema>;

/** Brief alanları (#30 / 6.4 şablonu). Hepsi isteğe bağlı serbest metin. */
export const briefFields = [
  ['product', 'Ürün / hizmet'],
  ['goal', 'Kampanya hedefi (bilinirlik / satış / indirme)'],
  ['keyMessage', 'Ana mesaj'],
  ['mustSay', 'Söylenmesi zorunlu ifadeler'],
  ['mustNotSay', 'Yasak ifadeler'],
  ['format', 'Teslim formatı (Reels / Story / carousel, süre, adet, en-boy)'],
  ['schedule', 'Yayın tarihi, saat aralığı ve kalıcılık süresi'],
  ['revisions', 'Revizyon hakkı ve onay süresi'],
  ['usageRights', 'Kullanım hakları (marka hesabı / reklam, süre)'],
  ['payment', 'Ödeme vadesi ve fatura bilgileri'],
  ['reporting', 'Raporlama (hangi metrikler, ne zaman)'],
] as const;
export type BriefKey = (typeof briefFields)[number][0];

export const briefSchema = z
  .object(
    Object.fromEntries(
      briefFields.map(([key]) => [key, z.string().trim().max(4000).optional()]),
    ) as Record<BriefKey, z.ZodOptional<z.ZodString>>,
  )
  .strict();
export type Brief = z.infer<typeof briefSchema>;

/** Veritabanındaki jsonb'yi güvenle okur; bozuk veya bilinmeyen alanlar atlanır. */
export function readBrief(value: unknown): Brief {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: Brief = {};
  for (const [key] of briefFields) {
    const field = (value as Record<string, unknown>)[key];
    if (typeof field === 'string' && field.trim()) result[key] = field;
  }
  return result;
}

export function readDeliverables(value: unknown): Deliverable[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const parsed = deliverableSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export const dealCreateSchema = z.object({
  brandId: z.uuid(),
  influencerId: z.uuid(),
  stage: z.enum(dealStageKeys).default('lead'),
  fee: fee.nullable().optional(),
  currency: currency.default('USD'),
  dueDate: isoDate.nullable().optional(),
  notes: z.string().trim().max(5000).default(''),
});
export type DealCreateInput = z.infer<typeof dealCreateSchema>;

export const dealPatchSchema = z
  .object({
    stage: z.enum(dealStageKeys),
    fee: fee.nullable(),
    currency,
    dueDate: isoDate.nullable(),
    paidAt: isoDate.nullable(),
    notes: z.string().trim().max(5000),
    deliverables: z.array(deliverableSchema).max(50),
    brief: briefSchema,
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Değişiklik yok.');
export type DealPatchInput = z.infer<typeof dealPatchSchema>;

export const contentLinkSchema = z.object({ contentItemId: z.uuid() });
