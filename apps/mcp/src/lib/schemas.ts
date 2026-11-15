// Araç girdilerinin ortak Zod parçaları. Her şema katıdır (bilinmeyen alan reddedilir) ve her
// metin veritabanındaki CHECK sınırıyla aynı ya da daha dar bir üst sınıra sahiptir
// (packages/shared/src/explainer.ts → EXPLAINER_LIMITS, 20261115120000_explainer_series.sql).
import * as z from 'zod';
import {
  EVIDENCE_LEVELS,
  EXPLAINER_KINDS,
  EXPLAINER_LIMITS,
  SENSITIVITY_FLAGS,
  VISUAL_ROUTES,
} from '@ai-influencer/shared/explainer';

/** Postgres metni NUL kabul etmez; diğer denetim karakterleri de (satır sonu ve sekme dışında) girdi değildir. */
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function text(max: number, min = 0) {
  return z
    .string()
    .min(min)
    .max(max)
    .refine((value) => !CONTROL.test(value), {
      message: 'Denetim karakteri içeremez.',
    });
}

/** En az bir görünür karakter içeren metin. */
export function requiredText(max: number) {
  return text(max, 1).refine((value) => value.trim().length > 0, {
    message: 'Boş olamaz.',
  });
}

export const id = z.uuid({ message: 'Geçerli bir kimlik (uuid) olmalı.' });

export const limit = (max: number, fallback: number) =>
  z.number().int().min(1).max(max).default(fallback);

export const explainerKind = z.enum(EXPLAINER_KINDS);
export const visualRoute = z.enum(VISUAL_ROUTES);
export const evidenceLevel = z.enum(EVIDENCE_LEVELS);
export const sensitivityFlag = z.enum(SENSITIVITY_FLAGS);
export const language = z
  .string()
  .regex(
    /^[a-z]{2}(-[A-Z]{2})?$/,
    'Dil kodu "tr" ya da "tr-TR" biçiminde olmalı.',
  );
export const styleKey = z.string().regex(/^[a-z0-9][a-z0-9_.-]{0,79}$/);
export const voiceProvider = z.string().regex(/^[a-z0-9][a-z0-9_.-]{0,39}$/);
export const voiceRate = z
  .string()
  .regex(/^[+-][0-9]{1,3}%$/, 'Hız "+8%" biçiminde olmalı.');

export const httpUrl = z
  .string()
  .max(2000)
  .regex(
    /^https?:\/\/[^\s]+$/,
    'Adres http(s):// ile başlamalı, boşluk içermemeli.',
  );

/** Kaynak: ad ve adresten en az biri dolu. */
export const factSource = z
  .strictObject({
    title: text(300).optional(),
    url: httpUrl.optional(),
    primary: z.boolean().optional(),
  })
  .refine(
    (source) => `${source.title ?? ''}${source.url ?? ''}`.trim().length > 0,
    { message: 'Kaynağın adı ya da adresi olmalı.' },
  );

export function jsonBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

export const factNotes = z
  .array(
    z.strictObject({
      claim: requiredText(EXPLAINER_LIMITS.claim),
      sources: z
        .array(factSource)
        .max(EXPLAINER_LIMITS.sourcesPerClaim)
        .optional(),
      note: text(1000).optional(),
      cautious_wording: text(1000).optional(),
    }),
  )
  .max(EXPLAINER_LIMITS.factNotes)
  .refine((notes) => jsonBytes(notes) <= 60_000, {
    message: 'Kaynak notları toplamda 60 KB sınırını aşıyor.',
  });

/** Kanıt ayrıntısı: düz, küçük bir nesne (izlenme, ortanca, tarih, adres). */
export const evidenceDetail = z
  .record(
    z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
    z.union([text(500), z.number().finite(), z.boolean(), z.null()]),
  )
  .refine((detail) => Object.keys(detail).length <= 20, {
    message: 'En çok 20 alan.',
  })
  .refine((detail) => jsonBytes(detail) <= 4000, {
    message: 'Kanıt ayrıntısı 4 KB sınırını aşıyor.',
  });

export const topicSuggestion = z.strictObject({
  title: requiredText(EXPLAINER_LIMITS.title),
  summary: text(EXPLAINER_LIMITS.summary).optional(),
  hook: text(EXPLAINER_LIMITS.hook).optional(),
  visual_idea: text(EXPLAINER_LIMITS.visualIdea).optional(),
  kind: explainerKind.optional(),
  evidence_level: evidenceLevel.optional(),
  evidence_detail: evidenceDetail.optional(),
  source_candidates: z
    .array(factSource)
    .max(EXPLAINER_LIMITS.sourceCandidates)
    .refine((sources) => jsonBytes(sources) <= 8000, {
      message: 'Kaynak adayları 8 KB sınırını aşıyor.',
    })
    .optional(),
  sensitivity_note: text(500).optional(),
});

export const topicSuggestions = (min: number) =>
  z.array(topicSuggestion).min(min).max(EXPLAINER_LIMITS.suggestionsPerRequest);

/** Seri varsayılanları. Serbest JSON alanları (caption_style, default_params) MCP'ye kapalıdır. */
export const seriesSettings = {
  theme: text(EXPLAINER_LIMITS.theme).optional(),
  kind: explainerKind.nullable().optional(),
  visual_route: visualRoute.nullable().optional(),
  style_key: styleKey.nullable().optional(),
  voice_provider: voiceProvider.nullable().optional(),
  voice_name: requiredText(80).nullable().optional(),
  voice_rate: voiceRate.nullable().optional(),
  language: language.optional(),
} as const;

/** `undefined` alanları atar: RPC'ye yalnız gönderilen alanlar gider. */
export function compact<T extends Record<string, unknown>>(
  value: T,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, inner]) => inner !== undefined),
  ) as Partial<T>;
}
