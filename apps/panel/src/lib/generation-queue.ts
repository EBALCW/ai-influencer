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

/** Video-to-video (motion transfer) çözünürlükleri. */
export const resolutions = ['480p', '720p', '1080p'] as const;
/** Görsel (Higgsfield Soul) çözünürlükleri ve en-boy oranları (OpenAPI, 2026-10-24). */
export const imageResolutions = ['2K', '4K'] as const;
export const aspectRatios = [
  '9:16',
  '4:5',
  '3:4',
  '2:3',
  '1:1',
  '5:4',
  '4:3',
  '3:2',
  '16:9',
  '21:9',
] as const;
/**
 * Görselden video süreleri. Kling 5|10 kabul eder; Hailuo 6|10 olduğundan worker 5'i 6'ya
 * yuvarlar. Image-to-video modellerinde çözünürlük alanı yok.
 */
export const videoDurations = [5, 10] as const;

/** Mod başına formda gösterilen alanlar (sağlayıcının desteklemediği alan sunulmaz). */
export const modeFields: Record<
  GenerationMode,
  { resolution: boolean; image: boolean; duration: boolean }
> = {
  text_to_image: { resolution: false, image: true, duration: false },
  image_to_video: { resolution: false, image: false, duration: true },
  video_to_video: { resolution: true, image: false, duration: false },
};

/** Test modunda zorlanan değerler (form etiketi de bunu gösterir). */
export const testModeLabel: Record<GenerationMode, string> = {
  text_to_image: '2K',
  image_to_video: '5 sn',
  video_to_video: '480p',
};

export const isActiveStatus = (status: GenerationStatus) =>
  status === 'queued' || status === 'running';

const emptyToUndefined = (value: unknown) =>
  value === '' || value === null ? undefined : value;

/**
 * Üretim formundaki parametreler. Test modu varsayılan olarak açıktır (görsel 2K, video 5 sn,
 * video-to-video 480p). Seed yok: Higgsfield Soul ve image-to-video şemalarında seed alanı yok.
 */
export const generationOptionsSchema = z.object({
  resolution: z.enum(resolutions).default('720p'),
  imageResolution: z.enum(imageResolutions).default('2K'),
  aspectRatio: z.enum(aspectRatios).default('9:16'),
  durationSeconds: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number()
      .refine((value) => (videoDurations as readonly number[]).includes(value))
      .optional(),
  ),
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

/**
 * generations.params: worker bu alanları okur. Sadece modun desteklediği alanlar yazılır:
 * görsel → image_resolution + aspect_ratio, görselden video → duration_seconds,
 * video-to-video → resolution. Negatif prompt saklanır; worker yalnız destekleyen modele
 * (ör. Kling image-to-video) gönderir.
 */
export function buildGenerationParams(input: {
  mode: GenerationMode;
  prompt: string;
  negative: string;
  variables: Record<string, string>;
  promptVersion: number;
  options: GenerationOptions;
}) {
  const { options, mode } = input;
  const test = options.testMode;
  return {
    prompt: input.prompt,
    negative: input.negative,
    variables: input.variables,
    prompt_version: input.promptVersion,
    test_mode: test,
    ...(mode === 'text_to_image' && {
      image_resolution: test ? '2K' : options.imageResolution,
      aspect_ratio: options.aspectRatio,
    }),
    ...(mode === 'image_to_video' && {
      duration_seconds: test ? 5 : (options.durationSeconds ?? 5),
    }),
    ...(mode === 'video_to_video' && {
      resolution: test ? '480p' : options.resolution,
    }),
  };
}

/**
 * Üretim maliyeti etiketi (USD). Gerçek tutar varsa o, yoksa gönderimdeki tahmin. Sağlayıcı
 * başarısız/iptal edilen işi ücretlendirmez; bu durumda tahmin gösterilmez.
 */
export function costLabel(item: {
  status: GenerationStatus;
  cost_usd: number | string | null;
  estimated_cost_usd: number | string | null;
}): string | null {
  const usd = (value: number | string | null) => {
    const n = value === null ? NaN : Number(value);
    return Number.isFinite(n) ? `$${n.toFixed(n < 1 ? 3 : 2)}` : null;
  };
  const actual = usd(item.cost_usd);
  if (actual) return actual;
  if (item.status === 'failed' || item.status === 'cancelled') return null;
  const estimate = usd(item.estimated_cost_usd);
  return estimate ? `≈ ${estimate} (tahmini)` : null;
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
