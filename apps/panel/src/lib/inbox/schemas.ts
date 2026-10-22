import { z } from 'zod';
import { Constants, type SocialPlatform } from '@ai-influencer/shared';
import { REPLY_MAX_LENGTH } from '@/lib/ai/schemas';

/** Gelen kutusu (#61). Durumlar `comments.status` CHECK'iyle aynı. */
export const commentStatuses = ['new', 'read', 'replied', 'hidden'] as const;
export type CommentStatus = (typeof commentStatuses)[number];

export const commentStatusLabels: Record<CommentStatus, string> = {
  new: 'Yeni',
  read: 'Okundu',
  replied: 'Yanıtlandı',
  hidden: 'Gizli',
};

export const replyStatusLabels: Record<string, string> = {
  queued: 'Gönderim sırasında',
  sending: 'Gönderiliyor',
  sent: 'Gönderildi',
  failed: 'Gönderilemedi',
};

/** Panelden yanıt verilebilen platformlar (Edge Function adaptörleri). */
export const replyPlatforms = [
  'instagram',
  'youtube',
] as const satisfies readonly SocialPlatform[];
export const canReplyOn = (platform: string) =>
  (replyPlatforms as readonly string[]).includes(platform);

/** Liste görünümleri: hepsi (gizliler hariç), yanıtlanmamış, iş birliği, gizli. */
export const inboxViews = ['all', 'unanswered', 'brand', 'hidden'] as const;
export type InboxView = (typeof inboxViews)[number];
export const inboxViewLabels: Record<InboxView, string> = {
  all: 'Tümü',
  unanswered: 'Yanıtlanmamış',
  brand: 'İş birliği fırsatı',
  hidden: 'Gizlenenler',
};
export const inboxDays = [7, 30, 90] as const;

const pick = <T extends readonly string[]>(values: T, fallback: T[number]) =>
  z
    .string()
    .optional()
    .transform((v): T[number] =>
      v && (values as readonly string[]).includes(v) ? v : fallback,
    );

/** URL filtreleri: geçersiz değer hata değil, varsayılana düşer. */
export const inboxQuerySchema = z.object({
  inf: z
    .string()
    .optional()
    .transform((v) => (v && v.length <= 120 ? v.trim() : undefined)),
  platform: z
    .string()
    .optional()
    .transform((v) =>
      v &&
      (Constants.public.Enums.social_platform as readonly string[]).includes(v)
        ? (v as SocialPlatform)
        : undefined,
    ),
  view: pick(inboxViews, 'all'),
  days: z
    .string()
    .optional()
    .transform((v) => {
      const n = Number(v);
      return (inboxDays as readonly number[]).includes(n) ? n : 7;
    }),
  post: z
    .string()
    .optional()
    .transform((v) => (v && z.uuid().safeParse(v).success ? v : undefined)),
});
export type InboxQuery = z.infer<typeof inboxQuerySchema>;

export const commentIdSchema = z.uuid();

/** Panelden değiştirilebilen durumlar; 'replied' yalnız gönderilen yanıtla olur. */
export const commentPatchSchema = z
  .object({ status: z.enum(['new', 'read', 'hidden']) })
  .strict();

export const replyRequestSchema = z
  .object({
    body: z
      .string()
      .trim()
      .min(1, 'Yanıt boş olamaz.')
      .max(REPLY_MAX_LENGTH, `Yanıt en fazla ${REPLY_MAX_LENGTH} karakter.`),
  })
  .strict();

/** Yorumdan lead: var olan marka ya da yeni marka adı. */
export const leadRequestSchema = z
  .object({
    brandId: z.uuid().optional(),
    brandName: z.string().trim().min(1).max(120).optional(),
  })
  .strict()
  .refine(
    (v) => Boolean(v.brandId) !== Boolean(v.brandName),
    'Marka seçin ya da yeni marka adı girin.',
  );
