import { z } from 'zod';
import { canonicalVideoUrl, parseYouTubeVideoId } from './youtube';

/**
 * Yayıncı klipleri (#173) sözlükleri ve istek şemaları. Değerler veritabanındaki
 * enum/CHECK'lerle aynıdır (`supabase/migrations/20261112100000_streamer_clips.sql`).
 */
export const permissionStatuses = ['pending', 'granted', 'denied'] as const;
export type PermissionStatus = (typeof permissionStatuses)[number];
export const permissionLabels: Record<PermissionStatus, string> = {
  pending: 'İzin bekleniyor',
  granted: 'İzin verildi',
  denied: 'İzin reddedildi',
};

export const clipStatuses = [
  'candidate',
  'approved',
  'rendered',
  'rejected',
] as const;
export type ClipStatus = (typeof clipStatuses)[number];
export const clipStatusLabels: Record<ClipStatus, string> = {
  candidate: 'Aday',
  approved: 'Onaylandı',
  rendered: 'Kesildi',
  rejected: 'Elendi',
};

export const MAX_CLIP_SECONDS = 180;
export const MAX_VIDEO_SECONDS = 172_800;

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const text = (max: number) => z.string().trim().max(max);
const requiredText = (max: number, message: string) =>
  z.string().trim().min(1, message).max(max);

/** Kısa belge referansı; e-posta/kişisel bilgi yazılmaz (docs/compliance.md). */
export const permissionRefSchema = text(200).refine(
  (value) => !EMAIL.test(value),
  {
    message:
      'İzin referansına e-posta veya kişisel bilgi yazmayın; kısıtlı depodaki belgenin kısa kodunu girin.',
  },
);

const videoUrl = z
  .string()
  .trim()
  .max(500)
  .refine((value) => parseYouTubeVideoId(value) !== null, {
    message: 'Geçerli bir YouTube video linki girin.',
  });
const channelUrl = z
  .union([
    z.literal(''),
    z
      .string()
      .trim()
      .max(300)
      .regex(/^https:\/\/(www\.|m\.)?youtube\.com\/\S+$/, {
        message: 'Kanal linki https://www.youtube.com/… biçiminde olmalı.',
      }),
  ])
  .nullable()
  .transform((value) => value || null);
const duration = z.number().int().min(1).max(MAX_VIDEO_SECONDS).nullable();

/** Yeni kaynak: link kanonik biçime çevrilir, `video_id` linkten çıkarılır. */
export const clipSourceSchema = z
  .object({
    video_url: videoUrl,
    channel_name: requiredText(200, 'Kanal adı gerekli.'),
    channel_url: channelUrl.default(null),
    title: requiredText(300, 'Video başlığı gerekli.'),
    duration_seconds: duration.default(null),
    notes: text(3000).default(''),
  })
  .strict()
  .transform((input) => {
    const video_id = parseYouTubeVideoId(input.video_url)!;
    return {
      ...input,
      platform: 'youtube' as const,
      video_id,
      video_url: canonicalVideoUrl(video_id),
    };
  });
export type ClipSourceInput = z.output<typeof clipSourceSchema>;

/**
 * PATCH: yalnız gönderilen alanlar değişir. İzin `granted` yapılırken referans
 * aynı istekte ve dolu gelmelidir. Video linki değiştirilemez (yeni kaynak eklenir).
 */
export const clipSourcePatchSchema = z
  .object({
    channel_name: requiredText(200, 'Kanal adı gerekli.').optional(),
    channel_url: channelUrl.optional(),
    title: requiredText(300, 'Video başlığı gerekli.').optional(),
    duration_seconds: duration.optional(),
    notes: text(3000).optional(),
    permission_status: z.enum(permissionStatuses).optional(),
    permission_ref: permissionRefSchema.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Değiştirilecek alan yok.',
  })
  .refine(
    (input) => input.permission_status !== 'granted' || !!input.permission_ref,
    {
      message: '“İzin verildi” için izin referansı gerekli.',
      path: ['permission_ref'],
    },
  );
export type ClipSourcePatch = z.infer<typeof clipSourcePatchSchema>;

const seconds = z.number().int().min(0).max(MAX_VIDEO_SECONDS);
const hook = text(500)
  .nullable()
  .transform((value) => value || null);
const rangeMessage = `Bitiş başlangıçtan sonra olmalı ve klip en fazla ${MAX_CLIP_SECONDS} sn sürebilir.`;
const validRange = (start: number, end: number) =>
  end > start && end - start <= MAX_CLIP_SECONDS;

export const clipSchema = z
  .object({
    source_id: z.string().uuid(),
    influencer_id: z.string().uuid().nullable().default(null),
    title: requiredText(200, 'Klip başlığı gerekli.'),
    hook: hook.default(null),
    start_seconds: seconds,
    end_seconds: seconds,
    notes: text(3000).default(''),
  })
  .strict()
  .refine((input) => validRange(input.start_seconds, input.end_seconds), {
    message: rangeMessage,
    path: ['end_seconds'],
  });
export type ClipInput = z.output<typeof clipSchema>;

/** PATCH: başlangıç ve bitiş birlikte gönderilir (aralık bütün olarak denetlenir). */
export const clipPatchSchema = z
  .object({
    influencer_id: z.string().uuid().nullable().optional(),
    title: requiredText(200, 'Klip başlığı gerekli.').optional(),
    hook: hook.optional(),
    start_seconds: seconds.optional(),
    end_seconds: seconds.optional(),
    status: z.enum(clipStatuses).optional(),
    notes: text(3000).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, {
    message: 'Değiştirilecek alan yok.',
  })
  .refine(
    (input) =>
      (input.start_seconds === undefined) === (input.end_seconds === undefined),
    { message: 'Başlangıç ve bitiş birlikte gönderilmeli.' },
  )
  .refine(
    (input) =>
      input.start_seconds === undefined ||
      input.end_seconds === undefined ||
      validRange(input.start_seconds, input.end_seconds),
    { message: rangeMessage, path: ['end_seconds'] },
  );
export type ClipPatch = z.infer<typeof clipPatchSchema>;

export const clipBacklogSchema = z
  .object({ influencer_id: z.string().uuid().nullable().default(null) })
  .strict();

/** `/clips` URL parametreleri. */
export const clipsQuerySchema = z.object({
  inf: z
    .string()
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional(),
});
export type ClipsQuery = z.infer<typeof clipsQuerySchema>;
