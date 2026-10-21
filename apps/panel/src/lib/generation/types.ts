import { z } from 'zod';
import { Constants, type GenerationStatus } from '@ai-influencer/shared';

/** DB `generation_status` enum'u ile birebir (queued → running → succeeded | failed | cancelled). */
export const generationStatusSchema = z.enum(
  Constants.public.Enums.generation_status,
);

/** Sağlayıcıya özgü ek parametreler (model ayarları). Sırlar buraya konmaz. */
const modelParamsSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  .optional();

const publicUrl = z.url({ protocol: /^https$/ });
const resolutionSchema = z.enum(['480p', '720p', '1080p']);

export const imageRequestSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  negativePrompt: z.string().trim().max(2000).optional(),
  seed: z.number().int().nonnegative().optional(),
  modelParams: modelParamsSchema,
});

export const imageToVideoRequestSchema = z.object({
  imageUrl: publicUrl,
  prompt: z.string().trim().max(4000).optional(),
  durationSeconds: z.number().int().min(1).max(60),
  resolution: resolutionSchema.default('720p'),
  modelParams: modelParamsSchema,
});

/** Videodaki kişiyi/hareketi referans görsellerle yeniden üretme (motion transfer). */
export const videoToVideoRequestSchema = z.object({
  videoUrl: publicUrl,
  imageUrls: z.array(publicUrl).min(1).max(8),
  prompt: z.string().trim().max(4000).optional(),
  resolution: resolutionSchema.default('720p'),
  modelParams: modelParamsSchema,
});

export type ImageRequest = z.input<typeof imageRequestSchema>;
export type ImageToVideoRequest = z.input<typeof imageToVideoRequestSchema>;
export type VideoToVideoRequest = z.input<typeof videoToVideoRequestSchema>;

export type GenerationOutput = {
  kind: 'image' | 'video';
  url: string;
  contentType: string | null;
};

/** Sağlayıcıdan okunan işin anlık durumu. */
export type GenerationJob = {
  providerJobId: string;
  status: GenerationStatus;
  outputs: GenerationOutput[];
  /** Kullanıcıya gösterilebilir kısa hata; sağlayıcı yanıtının tamamı değil. */
  error: string | null;
  /** Sağlayıcı bildiriyorsa harcanan kredi; bilinmiyorsa null. */
  credits: number | null;
};

export type SubmitOptions = {
  /** Aynı isteğin tekrar gönderilmesinde çift ücretlendirmeyi önler. */
  idempotencyKey?: string;
  /** Tamamlanınca çağrılacak HTTPS adresi (destekleyen sağlayıcılarda). */
  webhookUrl?: string;
};
