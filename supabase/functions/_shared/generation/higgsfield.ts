// Higgsfield REST API adaptörü (ADR 0002). Doğrulanan kısımlar: base URL, `Authorization: Key
// <id>:<secret>`, `POST /<model-id>` + Idempotency-Key, yanıtta request_id/status,
// `GET /requests/{id}/status`, `POST /requests/{id}/cancel` (202; başlamışsa 400), durumlar
// queued | in_progress | completed | failed | nsfw | canceled, çıktı images[].url / video.url,
// motion transfer alanları (video_url, image_urls, prompt, resolution).
//
// VARSAYIMLAR (ADR "Açık sorular"): image-to-video modeli ve alanları (image_url, prompt,
// duration, resolution) doğrulanmadı, model env ile verilmezse not_configured. Yanıtta ilerleme
// ve kredi alanı belgelenmemiş: ilerleme durumdan türetilir, kredi null döner. Negatif prompt ve
// seed modele özgü; yalnız doluysa `negative_prompt` / `seed` adıyla gönderilir.

import {
  type GenerationProvider,
  type PollResult,
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
};

/** Quickstart'taki görsel modeli ve motion transfer sayfasındaki model. */
export const DEFAULT_IMAGE_MODEL = 'higgsfield-ai/soul/v2/standard';
export const DEFAULT_VIDEO_TO_VIDEO_MODEL =
  'higgsfield/genjutsu/motion-transfer/v1.0';

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

type Media = { url?: unknown; content_type?: unknown };

export class HiggsfieldProvider implements GenerationProvider {
  readonly id = 'higgsfield';
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
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
    this.models = {
      image: config.models?.image || DEFAULT_IMAGE_MODEL,
      imageToVideo: config.models?.imageToVideo || undefined,
      videoToVideo: config.models?.videoToVideo || DEFAULT_VIDEO_TO_VIDEO_MODEL,
    };
  }

  async submit(job: SubmitJob): Promise<{ providerJobId: string }> {
    const { model, body } = this.requestFor(job);
    const res = await this.send(
      'POST',
      `/${model.replace(/^\//, '')}`,
      body,
      job.id,
    );
    if (!res.ok) throw providerErrorFromStatus(res.status);
    const data = await readJson(res);
    if (typeof data.request_id !== 'string' || !data.request_id) {
      throw new ProviderError('unavailable');
    }
    return { providerJobId: data.request_id };
  }

  async poll(providerJobId: string): Promise<PollResult> {
    const res = await this.send(
      'GET',
      `/requests/${encodeURIComponent(providerJobId)}/status`,
    );
    if (!res.ok) throw providerErrorFromStatus(res.status);
    const data = await readJson(res);
    const status =
      typeof data.status === 'string' ? statusMap[data.status] : undefined;
    if (!status) throw new ProviderError('unavailable');

    let media: Media | undefined;
    if (status === 'succeeded') {
      const images = Array.isArray(data.images) ? (data.images as Media[]) : [];
      media = (data.video as Media | null | undefined) ?? images[0];
      if (
        !media ||
        typeof media.url !== 'string' ||
        !media.url.startsWith('https://')
      ) {
        throw new ProviderError('unavailable');
      }
    }
    return {
      status,
      progress: progressFor[status],
      resultUrl: media ? (media.url as string) : null,
      contentType:
        media && typeof media.content_type === 'string'
          ? media.content_type
          : null,
      credits: null,
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
    if (res.status === 400) throw new ProviderError('not_cancelable');
    if (!res.ok) throw providerErrorFromStatus(res.status);
  }

  private requestFor(job: SubmitJob): {
    model: string;
    body: Record<string, unknown>;
  } {
    const extra: Record<string, unknown> = { ...job.modelParams };
    if (job.mode === 'text_to_image') {
      if (job.negative) extra.negative_prompt = job.negative;
      if (job.seed !== null) extra.seed = job.seed;
      return {
        model: this.models.image,
        body: { ...extra, prompt: job.prompt },
      };
    }
    if (job.mode === 'video_to_video') {
      if (!job.videoUrl || job.imageUrls.length === 0) {
        throw new ProviderError('invalid_request');
      }
      return {
        model: this.models.videoToVideo,
        body: {
          ...extra,
          video_url: job.videoUrl,
          image_urls: job.imageUrls.slice(0, 8),
          prompt: job.prompt,
          resolution: job.resolution,
        },
      };
    }
    // image_to_video: model ve alanlar doğrulanmadı (varsayım, bkz. dosya başı).
    if (!this.models.imageToVideo) throw new ProviderError('not_configured');
    if (job.imageUrls.length === 0) throw new ProviderError('invalid_request');
    return {
      model: this.models.imageToVideo,
      body: {
        ...extra,
        image_url: job.imageUrls[0],
        prompt: job.prompt,
        duration: job.durationSeconds ?? 5,
        resolution: job.resolution,
      },
    };
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

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    const data = await res.json();
    if (data && typeof data === 'object')
      return data as Record<string, unknown>;
  } catch {
    // aşağıda unavailable
  }
  throw new ProviderError('unavailable');
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
