import { z } from 'zod';
import {
  EVIDENCE_LEVELS,
  EXPLAINER_KINDS,
  EXPLAINER_LIMITS,
  SENSITIVITY_FLAGS,
  VISUAL_ROUTES,
} from '@ai-influencer/shared';

/**
 * Anlatım modülü (#216) istek şemaları. Sınırlar ve sözlükler veritabanındaki CHECK'lerle aynıdır
 * (`supabase/migrations/20261115120000_explainer_series.sql`); `explainer-model.test.ts` alan
 * listelerinin RPC'lerin kabul ettiği alanlarla aynı kaldığını denetler. Şemalar bilinmeyen alanı
 * reddeder (`strictObject`): çalışma alanı, onay ya da durum alanı istekle gönderilemez.
 */
const L = EXPLAINER_LIMITS;

const text = (max: number) => z.string().trim().max(max);
const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max);

/** Serbest JSON nesnesi; serileştirilmiş boyutu `maxBytes`'ı geçemez. */
const boundedObject = (maxBytes: number) =>
  z
    .record(z.string(), z.unknown())
    .refine(
      (value) =>
        new TextEncoder().encode(JSON.stringify(value)).length <= maxBytes,
      { message: `En çok ${Math.round(maxBytes / 1024)} KB olabilir.` },
    );

export const explainerKindSchema = z.enum(EXPLAINER_KINDS);
export const visualRouteSchema = z.enum(VISUAL_ROUTES);
export const evidenceLevelSchema = z.enum(EVIDENCE_LEVELS);
export const sensitivityFlagSchema = z.enum(SENSITIVITY_FLAGS);

/** Dil etiketi: `tr`, `en`, `en-US`. */
export const languageSchema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Dil "tr" ya da "en-US" biçiminde olmalı.');
const styleKeySchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_.-]{0,79}$/, 'Geçersiz stil anahtarı.');
const voiceProviderSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_.-]{0,39}$/, 'Geçersiz ses sağlayıcı anahtarı.');
const voiceNameSchema = requiredText(80, 'Ses adı boş olamaz.');
/** Konuşma hızı, edge-tts biçiminde: `+8%`, `-10%`. */
const voiceRateSchema = z
  .string()
  .regex(/^[+-][0-9]{1,3}%$/, 'Hız "+8%" biçiminde olmalı.');

export const captionStyleSchema = boundedObject(8192);
export const paramsSchema = boundedObject(16384);

/** Üretim ayarları: seride varsayılan, bölümde üstüne yazma (null = seriden gelir / temizle). */
const productionSettings = {
  visual_route: visualRouteSchema.nullable(),
  style_key: styleKeySchema.nullable(),
  voice_provider: voiceProviderSchema.nullable(),
  voice_name: voiceNameSchema.nullable(),
  voice_rate: voiceRateSchema.nullable(),
};

/** `create_series(p_name, p_settings)` → `p_settings`. */
export const seriesSettingsSchema = z
  .strictObject({
    theme: text(L.theme),
    kind: explainerKindSchema.nullable(),
    ...productionSettings,
    caption_style: captionStyleSchema,
    language: languageSchema,
    default_params: paramsSchema,
  })
  .partial();
export type SeriesSettingsInput = z.infer<typeof seriesSettingsSchema>;

export const seriesNameSchema = requiredText(
  L.seriesName,
  'Seri adı boş olamaz.',
);

export const seriesCreateSchema = z.strictObject({
  name: seriesNameSchema,
  settings: seriesSettingsSchema.default({}),
});

/** `update_series(p_series_id, p_patch)` → `p_patch`. */
export const seriesPatchSchema = seriesSettingsSchema
  .extend({ name: seriesNameSchema.optional() })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Değişecek en az bir alan gerekli.',
  });

const sourceSchema = z
  .strictObject({
    title: text(300).optional(),
    // Yalnız http(s): adres arayüzde bağlantı olur (veritabanı da aynı kuralı uygular).
    url: z
      .url({ protocol: /^https?$/ })
      .max(2000)
      .optional(),
    primary: z.boolean().optional(),
  })
  .refine((value) => Boolean(value.title) || Boolean(value.url), {
    message: 'Kaynağın adı ya da adresi gerekli.',
  });

/** `episodes.fact_notes` elemanı: iddia → kaynaklar. */
export const factNoteSchema = z.strictObject({
  claim: requiredText(L.claim, 'İddia boş olamaz.'),
  sources: z.array(sourceSchema).max(L.sourcesPerClaim).default([]),
  note: text(1000).optional(),
  cautious_wording: text(1000).optional(),
});
export const factNotesSchema = z.array(factNoteSchema).max(L.factNotes);

/** `create_topic_request` / `add_topic_suggestions` öneri elemanı. */
export const topicSuggestionSchema = z.strictObject({
  title: requiredText(L.title, 'Öneri başlığı boş olamaz.'),
  summary: text(L.summary).optional(),
  hook: text(L.hook).optional(),
  visual_idea: text(L.visualIdea).optional(),
  kind: explainerKindSchema.optional(),
  evidence_level: evidenceLevelSchema.optional(),
  evidence_detail: boundedObject(4096).optional(),
  source_candidates: z.array(sourceSchema).max(L.sourceCandidates).optional(),
  sensitivity_note: text(500).optional(),
});
export const topicSuggestionsSchema = z
  .array(topicSuggestionSchema)
  .max(L.suggestionsPerRequest);

export const topicRequestSchema = z.strictObject({
  prompt: requiredText(L.prompt, 'İstek boş olamaz.'),
  series_id: z.uuid().nullable().optional(),
  kind: explainerKindSchema.nullable().optional(),
  language: languageSchema.nullable().optional(),
  suggestions: topicSuggestionsSchema.default([]),
});

export const episodeCreateSchema = z.strictObject({
  title: requiredText(L.title, 'Başlık boş olamaz.'),
  kind: explainerKindSchema.nullable().optional(),
  series_id: z.uuid().nullable().optional(),
  language: languageSchema.nullable().optional(),
  summary: text(L.summary).optional(),
  hook: text(L.hook).optional(),
});

/**
 * `update_episode(p_episode_id, p_patch)` → `p_patch`. `kind` ve `language` senaryo paketine
 * dahildir: değişirse veritabanı yeni sürüm açar ve senaryo onayını siler.
 */
export const episodePatchSchema = z
  .strictObject({
    title: requiredText(L.title, 'Başlık boş olamaz.'),
    summary: text(L.summary),
    hook: text(L.hook),
    visual_idea: text(L.visualIdea),
    kind: explainerKindSchema,
    language: languageSchema,
    ...productionSettings,
    caption_style: captionStyleSchema.nullable(),
    params: paramsSchema,
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Değişecek en az bir alan gerekli.',
  });

/** `save_episode_script(...)`. Verilmeyen alan olduğu gibi kalır; `script: null` temizler. */
export const scriptSaveSchema = z.strictObject({
  script_text: z.string().max(L.scriptText),
  fact_notes: factNotesSchema.optional(),
  script: boundedObject(131072).nullable().optional(),
  sensitivity_flags: z
    .array(sensitivityFlagSchema)
    .max(SENSITIVITY_FLAGS.length)
    .optional(),
  sensitivity_note: text(L.sensitivityNote).optional(),
  expected_version: z.number().int().min(0).optional(),
});

/** `approve_episode_script(...)`: onaylayan, okuduğu sürümü söyler. */
export const scriptApprovalSchema = z.strictObject({
  script_version: z.number().int().min(1),
  acknowledge_fact_gaps: z.boolean().default(false),
});

/** İşe dondurulan parametreler (`jobs.params`, `episodes.params_snapshot`). */
export const episodeJobParamsSchema = z.object({
  episode: z.object({
    id: z.uuid(),
    number: z.number().int().min(1).nullable(),
    title: z.string(),
    kind: explainerKindSchema,
    language: languageSchema,
    script_version: z.number().int().min(0),
  }),
  series: z
    .object({ id: z.uuid(), name: z.string(), theme: z.string() })
    .nullable(),
  visual_route: visualRouteSchema.nullable(),
  style_key: z.string().nullable(),
  voice: z.object({
    provider: z.string().nullable(),
    name: z.string().nullable(),
    rate: z.string().nullable(),
  }),
  caption_style: z.record(z.string(), z.unknown()),
  params: z.record(z.string(), z.unknown()),
});
