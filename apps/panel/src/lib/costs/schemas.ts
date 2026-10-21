import { z } from 'zod';

export const costCategories = [
  'subscription',
  'credits',
  'tool',
  'ai_api',
  'other',
] as const;
export type CostCategory = (typeof costCategories)[number];

export const costCategoryLabels: Record<CostCategory, string> = {
  subscription: 'Abonelik',
  credits: 'Kredi alımı',
  tool: 'Araç',
  ai_api: 'AI API',
  other: 'Diğer',
};

export const supportedCurrencies = ['USD', 'TRY', 'EUR'] as const;

/** numeric(14,4) ile uyumlu, string olarak taşınan tutar (float yok). */
const decimal = (max = 10) =>
  z
    .string()
    .trim()
    .regex(
      new RegExp(`^\\d{1,${max}}(\\.\\d{1,4})?$`),
      'En fazla 4 ondalık basamaklı pozitif bir sayı girin.',
    );
const currency = z.string().regex(/^[A-Z]{3}$/, 'Para birimi 3 harf olmalı.');
const isoDate = z.iso.date();
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export const costEntrySchema = z.object({
  influencerId: z.uuid(),
  category: z.enum(costCategories),
  description: z.string().trim().max(200).default(''),
  amount: decimal(),
  currency,
  credits: decimal().optional(),
  incurredOn: isoDate,
});
export type CostEntryInput = z.infer<typeof costEntrySchema>;

export const budgetSchema = z.object({
  influencerId: z.uuid().nullable(),
  month,
  amount: decimal().refine(
    (v) => Number(v) > 0,
    'Bütçe sıfırdan büyük olmalı.',
  ),
  currency,
  warnRatio: z
    .string()
    .regex(/^(0(\.\d{1,3})?|1(\.0{1,3})?)$/)
    .refine((v) => Number(v) > 0, 'Uyarı oranı 0 ile 1 arasında olmalı.')
    .default('0.8'),
});
export type BudgetInput = z.infer<typeof budgetSchema>;

const rate = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,8})?$/)
  .refine((v) => Number(v) > 0, 'Oran sıfırdan büyük olmalı.');

export const rateSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('exchange'),
    currency,
    baseCurrency: currency,
    rate,
    validOn: isoDate,
  }),
  z.object({
    kind: z.literal('credit'),
    tool: z.string().trim().min(1).max(60),
    currency,
    rate,
    validFrom: isoDate,
  }),
]);
export type RateInput = z.infer<typeof rateSchema>;
