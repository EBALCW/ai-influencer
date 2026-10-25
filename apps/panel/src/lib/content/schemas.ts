import { z } from 'zod';
import { checklistSchema } from './checklist-schema';
import { validTimezone } from './schedule-rules';
import { sourceTypes } from './source-rules';

const id = z.string().uuid();
export const timezoneSchema = z.string().max(100).refine(validTimezone);
export const contentSchema = z.object({
  influencer_id: id,
  title: z.string().trim().min(1).max(200),
  format: z.string().trim().min(1).max(60).default('short_video'),
  hook_type: z.string().trim().max(200).nullable().default(null),
  stage: z
    .enum([
      'idea',
      'script',
      'production',
      'qc',
      'edit',
      'scheduled',
      'published',
    ])
    .default('idea'),
  scheduled_at: z.string().datetime({ offset: true }).nullable().default(null),
  checklist: checklistSchema.default(() => checklistSchema.parse({})),
  source_url: z
    .union([
      z.literal(''),
      z
        .url()
        .max(2000)
        .refine((url) => /^https?:\/\//.test(url)),
    ])
    .default(''),
  source_views: z
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER)
    .nullable()
    .default(null),
  viral_reason: z.string().trim().max(3000).default(''),
  adaptation_score: z.number().int().min(1).max(5).nullable().default(null),
  assignee_id: id.nullable().default(null),
  target_account_id: id.nullable().default(null),
  sort_order: z.number().int().min(0).max(2147483647).default(0),
  notes: z.string().trim().max(10000).default(''),
  timezone: timezoneSchema.default('Europe/Istanbul'),
  // #145: v2v kaynak bilgisi. Kontrol eden/zaman sunucuda yazılır, istemciden alınmaz.
  source_type: z.enum(sourceTypes).nullable().default(null),
  source_owner: z.string().trim().max(200).default(''),
  source_license: z.string().trim().max(500).default(''),
  asset_ids: z
    .array(id)
    .max(50)
    .refine((xs) => new Set(xs).size === xs.length)
    .optional(),
  generation_ids: z
    .array(id)
    .max(50)
    .refine((xs) => new Set(xs).size === xs.length)
    .optional(),
});
// Zod 4 optional alanların içindeki default'ları da uygular. PATCH'te yalnız
// gönderilen alanların değişmesi için oluşturma default'larını kaldırıyoruz.
const fields = contentSchema.shape;
export const contentPatchSchema = z
  .object({
    influencer_id: fields.influencer_id.optional(),
    title: fields.title.optional(),
    format: fields.format.removeDefault().optional(),
    hook_type: fields.hook_type.removeDefault().optional(),
    stage: fields.stage.removeDefault().optional(),
    scheduled_at: fields.scheduled_at.removeDefault().optional(),
    checklist: fields.checklist.removeDefault().optional(),
    source_url: fields.source_url.removeDefault().optional(),
    source_views: fields.source_views.removeDefault().optional(),
    viral_reason: fields.viral_reason.removeDefault().optional(),
    adaptation_score: fields.adaptation_score.removeDefault().optional(),
    assignee_id: fields.assignee_id.removeDefault().optional(),
    target_account_id: fields.target_account_id.removeDefault().optional(),
    sort_order: fields.sort_order.removeDefault().optional(),
    notes: fields.notes.removeDefault().optional(),
    timezone: fields.timezone.removeDefault().optional(),
    source_type: fields.source_type.removeDefault().optional(),
    source_owner: fields.source_owner.removeDefault().optional(),
    source_license: fields.source_license.removeDefault().optional(),
    asset_ids: fields.asset_ids,
    generation_ids: fields.generation_ids,
    expected_updated_at: z.string().datetime({ offset: true }).optional(),
  })
  .strict();
export type ContentInput = z.infer<typeof contentSchema>;
export const slotSchema = z.object({
  account_id: id,
  weekday: z.number().int().min(0).max(6),
  local_time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  timezone: timezoneSchema,
});
export const detailSchema = z.object({
  id,
  warnings: z.array(z.string()),
  asset_ids: z.array(id),
  generation_ids: z.array(id),
  posts: z.array(
    z.object({ id, url: z.string().nullable(), views: z.number().nullable() }),
  ),
  /** İçeriğe video-to-video üretimi (veya onun çıktısı) bağlı. */
  v2v: z.boolean().default(false),
  /** v2v içerikte kaynak türü girilmemiş (#145). */
  source_missing: z.boolean().default(false),
});
export type ContentDetails = z.infer<typeof detailSchema>;

export const workspaceQuerySchema = z.object({
  inf: z
    .string()
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  /** `missing`: yalnız kaynak bilgisi eksik v2v içerikler (aylık kontrol). */
  source: z.enum(['missing']).optional(),
});
export const calendarQuerySchema = workspaceQuerySchema.extend({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(
      (value) =>
        Number.isFinite(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value &&
        value >= '1000-01-01' &&
        value <= '9998-12-31',
    )
    .optional(),
  view: z.enum(['week', 'month']).default('week'),
  tz: timezoneSchema.default('Europe/Istanbul'),
});
