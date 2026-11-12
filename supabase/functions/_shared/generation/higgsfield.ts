// Higgsfield REST API adaptörü (ADR 0002, #150). Kaynak: https://docs.higgsfield.ai/docs/llms.txt
// ve bağlı OpenAPI (erişim 2026-10-24).
//
// Doğrulanan kısımlar: base URL, `Authorization: Key <id>:<secret>`, `POST /<model-id>` +
// Idempotency-Key, `POST /estimate/<model-id>` → `{ usd }` (gönderimle aynı gövde),
// `GET /requests/{id}/status` (çıktı `images[]`, `video`, `audio`, `audios[]`; her biri sadece
// `url`; bitmiş istekte `expires_at`), `POST /requests/{id}/cancel` (202; başlamışsa 400),
// `POST /files/generate-upload-url` → `upload_url` + `upload_headers` + `public_url`,
// hata kodları (400 kalıcı, 429 `Retry-After`, 503 geçici) ve her yanıttaki `X-Correlation-ID`.
//
// Model alanları (ek OpenAPI): `higgsfield-ai/soul/standard` → prompt, num_images, resolution
// (2K/4K), aspect_ratio; seed/negative_prompt YOK. `kling-video/v2.5-turbo/*/image-to-video` →
// prompt, image_url, duration (5|10), cfg_scale, negative_prompt. `minimax/hailuo-2.3/standard/
// image-to-video` → prompt, image_url, duration (6|10), prompt_optimizer. Image-to-video
// modellerinde `resolution` yok. Diğer modeller için sadece prompt + model_params gönderilir.

import {
  type GenerationProvider,
  type InputFile,
  type InputMedia,
  type PollResult,
  type PreparedInputs,
  ProviderError,
  providerErrorFromStatus,
  type SubmitJob,
} from './provider.ts';

export type HiggsfieldConfig = {
  keyId: string;
  keySecret: string;
  baseUrl?: string;
  models?: { image?: string; imageToVideo?: string; videoToVideo?: string };
  fetch?: typeof fetch;
  timeoutMs?: number;
  /** Referans dosya üst sınırı (bayt). */
  maxInputBytes?: number;
};

/** Ek OpenAPI'de şeması olan Soul modeli ve motion transfer sayfasındaki model. */
export const DEFAULT_IMAGE_MODEL = 'higgsfield-ai/soul/standard';
export const DEFAULT_VIDEO_TO_VIDEO_MODEL =
  'higgsfield/genjutsu/motion-transfer/v1.0';
/** Şeması OpenAPI'de olan image-to-video modelleri (HIGGSFIELD_IMAGE_TO_VIDEO_MODEL). */
export const IMAGE_TO_VIDEO_MODELS = [
  'kling-video/v2.5-turbo/pro/image-to-video',
  'kling-video/v2.5-turbo/standard/image-to-video',
  'minimax/hailuo-2.3/standard/image-to-video',
] as const;

/** Soul `aspect_ratio` enum'u. */
export const SOUL_ASPECT_RATIOS = [
  '1:1',
  '4:3',
  '3:4',
  '3:2',
  '2:3',
  '5:4',
  '4:5',
  '16:9',
  '9:16',
  '21:9',
] as const;
export const SOUL_RESOLUTIONS = ['2K', '4K'] as const;

/** `POST /files/generate-upload-url` için desteklenen türler (File uploads). */
const UPLOAD_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
]);

const statusMap: Record<string, PollResult['status']> = {
  queued: 'queued',
  in_progress: 'running',
  completed: 'succeeded',
  failed: 'failed',
  nsfw: 'failed',
  canceled: 'cancelled',
};

const progressFor: Record<PollResult['status'], number> = {
  queued: 10,
  running: 50,
  succeeded: 100,
  failed: 0,
  cancelled: 0,
};

/** Çıktı URL uzantısı → MIME. MediaOutput'ta content_type yok, sadece url var. */
const extensionTypes: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  zip: 'application/zip',
};

/** URL yolunun uzantısından MIME türü; bilinmiyorsa null. */
export function contentTypeFromUrl(url: string): string | null {
  try {
    const ext = new URL(url).pathname.split('.').pop()?.toLowerCase() ?? '';
    return extensionTypes[ext] ?? null;
  } catch {
    return null;
  }
}

/** `Retry-After`: saniye veya HTTP tarihi → 1–3600 sn. Geçersizse null. */
export function parseRetryAfter(
  value: string | null,
  now = Date.now(),
): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  let seconds: number;
  if (/^\d+$/.test(trimmed)) seconds = Number(trimmed);
  else {
    const at = Date.parse(trimmed);
    if (Number.isNaN(at)) return null;
    seconds = Math.ceil((at - now) / 1000);
  }
  return Math.min(3600, Math.max(1, seconds));
}

/** `X-Correlation-ID` sadece güvenli karakterlerle (log/hata mesajına yazılır). */
export function correlationIdOf(res: Response): string | null {
  const value = res.headers.get('x-correlation-id')?.trim() ?? '';
  return /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : null;
}

type Media = { url?: unknown };

const isSoul = (model: string) => model.startsWith('higgsfield-ai/soul/');
const isKling = (model: string) => model.startsWith('kling-video/');
const isHailuo = (model: string) => model.startsWith('minimax/hailuo');

export class HiggsfieldProvider implements GenerationProvider {
  readonly id = 'higgsfield';
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxInputBytes: number;
  private readonly models: {
    image: string;
    imageToVideo: string | undefined;
    videoToVideo: string;
  };

  constructor(private readonly config: HiggsfieldConfig) {
    this.baseUrl = (config.baseUrl ?? 'https://api.higgsfield.ai').replace(
      /\/$/,
      '',
    );
    this.fetchImpl = config.fetch ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.maxInputBytes = config.maxInputBytes ?? 100 * 1024 * 1024;
    this.models = {
      image: config.models?.image || DEFAULT_IMAGE_MODEL,
      imageToVideo: config.models?.imageToVideo || undefined,
      videoToVideo: config.models?.videoToVideo || DEFAULT_VIDEO_TO_VIDEO_MODEL,
    };
  }

  /**
   * Referans dosyaları Higgsfield'e yükler. Doküman sadece herkese açık HTTPS URL'leri kabul
   * ettiğini söylüyor; üçüncü taraf imzalı URL'ler (Supabase Storage) garanti değil. Bu yüzden
   * her dosya `POST /files/generate-upload-url` ile alınan adrese PUT edilir ve `public_url`
   * kullanılır. Higgsfield anahtarı imzalı yükleme adresine gönderilmez.
   */
  async prepareInputs(media: InputMedia): Promise<PreparedInputs> {
    const imageUrls: string[] = [];
    for (const image of media.images.slice(0, 8)) {
      imageUrls.push(await this.upload(image));
    }
    const videoUrl = media.video ? await this.upload(media.video) : null;
    return { imageUrls, videoUrl };
  }

  /** `POST /estimate/<model-id>` → USD. Yanıtta geçerli tutar yoksa null. */
  async estimate(job: SubmitJob): Promise<number | null> {
    const { model, body } = this.requestFor(job);
    const res = await this.send('POST', `/estimate/${model}`, body);
    if (!res.ok) throw this.failure(res, 'estimate');
    const data = await readJson(res);
    const usd = typeof data.usd === 'string' ? Number(data.usd) : data.usd;
    return typeof usd === 'number' && Number.isFinite(usd) && usd >= 0
      ? usd
      : null;
  }

  async submit(job: SubmitJob): Promise<{ providerJobId: string }> {
    const { model, body } = this.requestFor(job);
    const res = await this.send('POST', `/${model}`, body, job.id);
    if (!res.ok) throw this.failure(res, 'submit');
    const data = await readJson(res);
    if (typeof data.request_id !== 'string' || !data.request_id) {
      throw new ProviderError('unavailable', {
        correlationId: correlationIdOf(res),
      });
    }
    return { providerJobId: data.request_id };
  }

  async poll(providerJobId: string): Promise<PollResult> {
    const res = await this.send(
      'GET',
      `/requests/${encodeURIComponent(providerJobId)}/status`,
    );
    if (!res.ok) throw this.failure(res, 'status');
    const data = await readJson(res);
    const status =
      typeof data.status === 'string' ? statusMap[data.status] : undefined;
    if (!status)
      throw new ProviderError('unavailable', {
        correlationId: correlationIdOf(res),
      });

    let output: { url: string; contentType: string | null } | null = null;
    if (status === 'succeeded') {
      output = pickOutput(data);
      if (!output)
        throw new ProviderError('unavailable', {
          detail: 'Tamamlanan istekte çıktı URL’i yok.',
          correlationId: correlationIdOf(res),
        });
    }
    const expires =
      typeof data.expires_at === 'string' ? Date.parse(data.expires_at) : NaN;
    return {
      status,
      progress: progressFor[status],
      resultUrl: output?.url ?? null,
      contentType: output?.contentType ?? null,
      credits: null,
      expiresAt: Number.isNaN(expires) ? null : new Date(expires).toISOString(),
      error:
        data.status === 'nsfw'
          ? 'İçerik moderasyonu tarafından reddedildi.'
          : status === 'failed'
            ? 'Sağlayıcı üretimi tamamlayamadı.'
            : null,
    };
  }

  async cancel(providerJobId: string): Promise<void> {
    const res = await this.send(
      'POST',
      `/requests/${encodeURIComponent(providerJobId)}/cancel`,
    );
    if (res.status === 400)
      throw new ProviderError('not_cancelable', {
        correlationId: correlationIdOf(res),
      });
    if (!res.ok) throw this.failure(res, 'cancel');
  }

  private requestFor(job: SubmitJob): {
    model: string;
    body: Record<string, unknown>;
  } {
    const extra: Record<string, unknown> = { ...job.modelParams };
    if (job.mode === 'text_to_image') {
      const model = this.models.image.replace(/^\//, '');
      if (!isSoul(model))
        return { model, body: { ...extra, prompt: job.prompt } };
      // Soul: seed ve negative_prompt şemada yok; sadece tek görsel saklandığı için num_images 1.
      const body: Record<string, unknown> = {
        ...extra,
        prompt: job.prompt,
        num_images: 1,
        resolution: (SOUL_RESOLUTIONS as readonly string[]).includes(
          job.imageResolution,
        )
          ? job.imageResolution
          : '2K',
      };
      if (
        job.aspectRatio &&
        (SOUL_ASPECT_RATIOS as readonly string[]).includes(job.aspectRatio)
      ) {
        body.aspect_ratio = job.aspectRatio;
      }
      return { model, body };
    }
    if (job.mode === 'video_to_video') {
      if (!job.videoUrl || job.imageUrls.length === 0) {
        throw new ProviderError('invalid_request', {
          detail: 'Referans video ve en az bir görsel gerekli.',
        });
      }
      return {
        model: this.models.videoToVideo.replace(/^\//, ''),
        body: {
          ...extra,
          video_url: job.videoUrl,
          image_urls: job.imageUrls.slice(0, 8),
          prompt: job.prompt,
          resolution: job.resolution,
        },
      };
    }
    // image_to_video: model hesaba göre seçilir (ADR "Açık sorular"); resolution gönderilmez.
    if (!this.models.imageToVideo) throw new ProviderError('not_configured');
    if (job.imageUrls.length === 0)
      throw new ProviderError('invalid_request', {
        detail: 'Referans görsel gerekli.',
      });
    const model = this.models.imageToVideo.replace(/^\//, '');
    const body: Record<string, unknown> = {
      ...extra,
      prompt: job.prompt,
      image_url: job.imageUrls[0],
    };
    const duration = job.durationSeconds;
    if (isKling(model)) {
      body.duration = duration !== null && duration > 5 ? 10 : 5;
      if (job.negative) body.negative_prompt = job.negative;
    } else if (isHailuo(model)) {
      body.duration = duration !== null && duration > 6 ? 10 : 6;
    } else if (duration !== null) {
      body.duration = duration;
    }
    return { model, body };
  }

  private async upload(file: InputFile): Promise<string> {
    const type = normalizeType(file.mimeType);
    if (!type || !UPLOAD_TYPES.has(type)) {
      throw new ProviderError('invalid_request', {
        detail: `Referans dosya türü desteklenmiyor (${type || 'bilinmiyor'}).`,
      });
    }
    const res = await this.send('POST', '/files/generate-upload-url', {
      content_type: type,
    });
    if (!res.ok) throw this.failure(res, 'upload-url');
    const data = await readJson(res);
    const uploadUrl = data.upload_url;
    const publicUrl = data.public_url;
    if (
      typeof uploadUrl !== 'string' ||
      !uploadUrl.startsWith('https://') ||
      typeof publicUrl !== 'string' ||
      !publicUrl.startsWith('https://')
    ) {
      throw new ProviderError('unavailable', {
        correlationId: correlationIdOf(res),
      });
    }
    const headers: Record<string, string> = { 'Content-Type': type };
    if (data.upload_headers && typeof data.upload_headers === 'object') {
      for (const [k, v] of Object.entries(
        data.upload_headers as Record<string, unknown>,
      )) {
        if (typeof v === 'string' && k.toLowerCase() !== 'authorization')
          headers[k] = v;
      }
    }

    const bytes = await this.readSource(file.url);
    let put: Response;
    try {
      put = await this.fetchImpl(uploadUrl, {
        method: 'PUT',
        headers,
        body: bytes,
        signal: AbortSignal.timeout(120_000),
      });
    } catch {
      throw new ProviderError('unavailable', {
        detail: 'Referans dosya sağlayıcıya yüklenemedi.',
      });
    }
    await put.body?.cancel();
    if (!put.ok)
      throw new ProviderError('unavailable', {
        detail: `Referans dosya sağlayıcıya yüklenemedi (HTTP ${put.status}).`,
      });
    return publicUrl;
  }

  /** Referans dosyayı imzalı Storage URL'inden okur (Higgsfield anahtarı gönderilmez). */
  private async readSource(url: string): Promise<Uint8Array<ArrayBuffer>> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, { signal: AbortSignal.timeout(60_000) });
    } catch {
      throw new ProviderError('unavailable', {
        detail: 'Referans dosya Storage’dan okunamadı.',
      });
    }
    if (!res.ok) {
      await res.body?.cancel();
      throw new ProviderError('unavailable', {
        detail: `Referans dosya Storage’dan okunamadı (HTTP ${res.status}).`,
      });
    }
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > this.maxInputBytes) {
      await res.body?.cancel();
      throw new ProviderError('invalid_request', {
        detail: 'Referans dosya çok büyük.',
      });
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > this.maxInputBytes) {
      throw new ProviderError('invalid_request', {
        detail: 'Referans dosya boş veya çok büyük.',
      });
    }
    return bytes;
  }

  /** HTTP hatası → ProviderError; X-Correlation-ID loglanır (gövde/sır değil). */
  private failure(res: Response, operation: string): ProviderError {
    const correlationId = correlationIdOf(res);
    console.warn(
      'Higgsfield isteği başarısız',
      operation,
      res.status,
      correlationId ?? '-',
    );
    return providerErrorFromStatus(res.status, {
      correlationId,
      retryAfterSeconds: parseRetryAfter(res.headers.get('retry-after')),
    });
  }

  private async send(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Key ${this.config.keyId}:${this.config.keySecret}`,
      Accept: 'application/json',
    };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    try {
      return await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new ProviderError('timeout');
      }
      throw new ProviderError('unavailable');
    }
  }
}

function normalizeType(mime: string | null): string {
  const type = (mime ?? '').split(';')[0].trim().toLowerCase();
  return type === 'image/jpg' ? 'image/jpeg' : type;
}

/** Öncelik: video → ilk görsel → ses (worker sesi desteklenmeyen tür olarak reddeder). */
function pickOutput(
  data: Record<string, unknown>,
): { url: string; contentType: string | null } | null {
  const first = (value: unknown): Media | undefined =>
    Array.isArray(value) ? (value[0] as Media | undefined) : undefined;
  const candidates: Array<[Media | undefined, string | null]> = [
    [data.video as Media | undefined, null],
    [first(data.images), null],
    [data.audio as Media | undefined, 'audio/mpeg'],
    [first(data.audios), 'audio/mpeg'],
  ];
  for (const [media, fallback] of candidates) {
    if (
      media &&
      typeof media === 'object' &&
      typeof media.url === 'string' &&
      media.url.startsWith('https://')
    ) {
      return {
        url: media.url,
        contentType: contentTypeFromUrl(media.url) ?? fallback,
      };
    }
  }
  return null;
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const data = await res.json();
    if (data && typeof data === 'object')
      return data as Record<string, unknown>;
  } catch {
    // aşağıda unavailable
  }
  throw new ProviderError('unavailable', {
    correlationId: correlationIdOf(res),
  });
}

type Env = { get(name: string): string | undefined };

/** Anahtarlar tanımlıysa Higgsfield sağlayıcısı, değilse null (worker işleri kuyrukta bırakır). */
export function higgsfieldFromEnv(
  env: Env,
  fetchImpl?: typeof fetch,
): HiggsfieldProvider | null {
  const keyId = env.get('HIGGSFIELD_API_KEY_ID')?.trim();
  const keySecret = env.get('HIGGSFIELD_API_KEY_SECRET')?.trim();
  if (!keyId || !keySecret) return null;
  return new HiggsfieldProvider({
    keyId,
    keySecret,
    fetch: fetchImpl,
    models: {
      image: env.get('HIGGSFIELD_IMAGE_MODEL')?.trim(),
      imageToVideo: env.get('HIGGSFIELD_IMAGE_TO_VIDEO_MODEL')?.trim(),
      videoToVideo: env.get('HIGGSFIELD_VIDEO_TO_VIDEO_MODEL')?.trim(),
    },
  });
}
