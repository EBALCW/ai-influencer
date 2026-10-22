import { z } from 'zod';
import type {
  GenerationStatus,
  GenerationType,
  PromptCategory,
} from '@ai-influencer/shared';

// Üretim kuyruğu (#47): istemci ve sunucu ortak tanımlar. Worker: supabase/functions/process-generations.

export const generationModes = [
  'text_to_image',
  'image_to_video',
  'video_to_video',
] as const;
export type GenerationMode = (typeof generationModes)[number];

export const modeLabels: Record<GenerationMode, string> = {
  text_to_image: 'Görsel',
  image_to_video: 'Görselden video',
  video_to_video: 'Video-to-video',
};

export const typeForMode: Record<GenerationMode, GenerationType> = {
  text_to_image: 'image',
  image_to_video: 'video',
  video_to_video: 'video',
};

/** Prompt kategorisinden üretim modu. Caption/araştırma metin görevidir. */
export const modeForCategory: Record<PromptCategory, GenerationMode | null> = {
  character: 'text_to_image',
  video2video: 'video_to_video',
  short_film: 'image_to_video',
  caption: null,
  research: null,
};

export const statusLabels: Record<GenerationStatus, string> = {
  queued: 'Kuyrukta',
  running: 'Üretiliyor',
  succeeded: 'Tamamlandı',
  failed: 'Başarısız',
  cancelled: 'İptal edildi',
};

export const resolutions = ['480p', '720p', '1080p'] as const;

export const isActiveStatus = (status: GenerationStatus) =>
  status === 'queued' || status === 'running';

const optionalInt = (min: number, max: number) =>
  z.preprocess(
    (value) => (value === '' || value === null ? undefined : value),
    z.coerce.number().int().min(min).max(max).optional(),
  );

/** Üretim formundaki parametreler. Test modu varsayılan olarak açıktır (480p, en çok 5 sn). */
export const generationOptionsSchema = z.object({
  resolution: z.enum(resolutions).default('720p'),
  durationSeconds: optionalInt(1, 60),
  seed: optionalInt(0, 2_147_483_647),
  testMode: z.boolean(),
  inputAssetIds: z.array(z.uuid()).max(8),
  overrideBudget: z.boolean(),
});
export type GenerationOptions = z.infer<typeof generationOptionsSchema>;

/** Seçilen referans dosyalar mod için yeterli mi? Hata mesajı veya null. */
export function inputRequirementError(
  mode: GenerationMode,
  mimeTypes: string[],
): string | null {
  const images = mimeTypes.filter((m) => m.startsWith('image/')).length;
  const videos = mimeTypes.filter((m) => m.startsWith('video/')).length;
  if (mode === 'image_to_video' && images === 0)
    return 'Görselden video için en az bir referans görsel seçin.';
  if (mode === 'video_to_video' && (videos !== 1 || images === 0))
    return 'Video-to-video için bir referans video ve en az bir görsel seçin.';
  return null;
}

/** generations.params: worker bu alanları okur (prompt, negative, test_mode, resolution …). */
export function buildGenerationParams(input: {
  prompt: string;
  negative: string;
  variables: Record<string, string>;
  promptVersion: number;
  options: GenerationOptions;
}) {
  const { options } = input;
  return {
    prompt: input.prompt,
    negative: input.negative,
    variables: input.variables,
    prompt_version: input.promptVersion,
    test_mode: options.testMode,
    resolution: options.testMode ? '480p' : options.resolution,
    ...(options.durationSeconds !== undefined && {
      duration_seconds: options.durationSeconds,
    }),
    ...(options.seed !== undefined && { seed: options.seed }),
  };
}

type DbError = { code?: string; message: string; hint?: string | null };

/** Kuyruk RPC hatalarını HTTP durumu + kullanıcı mesajına çevirir. */
export function queueError(error: DbError): {
  status: number;
  message: string;
} {
  if (error.hint === 'budget_exceeded')
    return {
      status: 402,
      message: 'Bu ayın bütçesi doldu. Yeni üretim için owner onayı gerekli.',
    };
  if (error.code === '42501')
    return { status: 403, message: 'Bu işlem için düzenleme yetkisi gerekir.' };
  if (error.code === 'P0002')
    return { status: 404, message: 'Üretim bulunamadı.' };
  if (error.code === '55000')
    return {
      status: 409,
      message: 'Bu üretimin durumu bu işleme izin vermiyor.',
    };
  if (error.code === '23514')
    return {
      status: 400,
      message: 'Üretim isteği geçersiz (referans dosya veya mod uyuşmuyor).',
    };
  return { status: 500, message: 'İşlem tamamlanamadı.' };
}

/** Worker durumu → panel uyarısı. null = sorun yok. */
export function workerNotice(
  status: {
    last_run_at: string;
    providers: string[];
    message: string | null;
  } | null,
  hasActive: boolean,
  now = Date.now(),
): string | null {
  if (!status)
    return hasActive
      ? "Kuyruk worker'ı henüz çalışmadı. İşler worker yapılandırılınca işlenecek."
      : null;
  if (status.providers.length === 0)
    return 'Üretim sağlayıcısı yapılandırılmamış. İşler kuyrukta bekliyor; yönetici Higgsfield anahtarlarını eklemeli.';
  if (hasActive && now - new Date(status.last_run_at).getTime() > 10 * 60_000)
    return "Kuyruk worker'ı 10 dakikadır çalışmadı. Zamanlanmış görev yapılandırmasını kontrol edin.";
  return null;
}
