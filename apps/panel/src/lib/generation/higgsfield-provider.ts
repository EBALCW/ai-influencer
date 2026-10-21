import { z } from 'zod';
import type { GenerationProvider } from './provider';
import { GenerationError, generationErrorFromStatus } from './errors';
import {
  imageRequestSchema,
  imageToVideoRequestSchema,
  videoToVideoRequestSchema,
  type GenerationJob,
  type GenerationOutput,
  type SubmitOptions,
} from './types';
import { parseRequest } from './validate';

/**
 * Higgsfield REST API adaptörü. Kaynak: https://docs.higgsfield.ai/docs/llms.txt
 * (Quickstart, Requests and lifecycle, Webhooks, Errors, Cancel). Doğrulanan
 * kısımlar: `Authorization: Key <id>:<secret>`, POST /<model-id> ile gönderim,
 * GET /requests/{id}/status, POST /requests/{id}/cancel (202, başlamışsa 400),
 * `hf_webhook` query parametresi, durumlar queued | in_progress | completed |
 * failed | nsfw | canceled. Yanıtta kredi bilgisi yok (credits: null).
 */
export type HiggsfieldConfig = {
  keyId: string;
  keySecret: string;
  baseUrl?: string;
  /** Model kimlikleri hesaba göre değişir (console.higgsfield.ai). */
  models: { image?: string; videoToVideo?: string };
  fetch?: typeof fetch;
  timeoutMs?: number;
};

const higgsfieldStatus = z.enum([
  'queued',
  'in_progress',
  'completed',
  'failed',
  'nsfw',
  'canceled',
]);

const mediaSchema = z.object({
  url: z.string(),
  content_type: z.string().optional(),
});

const responseSchema = z.object({
  request_id: z.string(),
  status: higgsfieldStatus,
  error: z.string().nullish(),
  images: z.array(mediaSchema).nullish(),
  video: mediaSchema.nullish(),
});

const statusMap: Record<
  z.infer<typeof higgsfieldStatus>,
  GenerationJob['status']
> = {
  queued: 'queued',
  in_progress: 'running',
  completed: 'succeeded',
  failed: 'failed',
  nsfw: 'failed',
  canceled: 'cancelled',
};

export class HiggsfieldProvider implements GenerationProvider {
  readonly id = 'higgsfield';
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly config: HiggsfieldConfig) {
    this.baseUrl = (config.baseUrl ?? 'https://api.higgsfield.ai').replace(
      /\/$/,
      '',
    );
    this.fetchImpl = config.fetch ?? fetch;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  async generateImage(request: unknown, options?: SubmitOptions) {
    const r = parseRequest(imageRequestSchema, request);
    // Dokümanda doğrulanan tek ortak alan `prompt`. Modele özgü alanlar
    // (negatif prompt, seed, en-boy oranı...) model sayfasındaki adlarıyla
    // `modelParams` içinde gönderilir; sessizce düşürmemek için reddediyoruz.
    if (r.negativePrompt !== undefined || r.seed !== undefined) {
      throw new GenerationError('invalid_request');
    }
    return this.submit(
      this.config.models.image,
      { ...r.modelParams, prompt: r.prompt },
      options,
    );
  }

  async imageToVideo(request: unknown): Promise<GenerationJob> {
    parseRequest(imageToVideoRequestSchema, request);
    // Image-to-video model alanları henüz resmi dokümandan doğrulanmadı
    // (ADR 0002 açık soru). Doğrulanınca burada eşlenecek.
    throw new GenerationError('not_configured');
  }

  async videoToVideo(request: unknown, options?: SubmitOptions) {
    const r = parseRequest(videoToVideoRequestSchema, request);
    return this.submit(
      this.config.models.videoToVideo,
      {
        ...r.modelParams,
        video_url: r.videoUrl,
        image_urls: r.imageUrls,
        prompt: r.prompt ?? '',
        resolution: r.resolution,
      },
      options,
    );
  }

  async getStatus(providerJobId: string) {
    return this.request(
      'GET',
      `/requests/${encodeURIComponent(providerJobId)}/status`,
    );
  }

  async cancel(providerJobId: string) {
    const path = `/requests/${encodeURIComponent(providerJobId)}/cancel`;
    const res = await this.send('POST', path);
    if (res.status === 400) throw new GenerationError('not_cancelable');
    if (!res.ok) throw generationErrorFromStatus(res.status);
    // 202 gövdesizdir; güncel durumu ayrıca okuyoruz
    return this.getStatus(providerJobId);
  }

  private async submit(
    model: string | undefined,
    body: Record<string, unknown>,
    options?: SubmitOptions,
  ) {
    if (!model) throw new GenerationError('not_configured');
    const query = options?.webhookUrl
      ? `?hf_webhook=${encodeURIComponent(options.webhookUrl)}`
      : '';
    const path = `/${model.replace(/^\//, '')}${query}`;
    return this.request('POST', path, body, options?.idempotencyKey);
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<GenerationJob> {
    const res = await this.send(method, path, body, idempotencyKey);
    if (!res.ok) throw generationErrorFromStatus(res.status);
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw new GenerationError('unavailable');
    }
    const parsed = responseSchema.safeParse(json);
    if (!parsed.success) throw new GenerationError('unavailable');
    return toJob(parsed.data);
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
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GenerationError('timeout');
      }
      throw new GenerationError('unavailable');
    }
  }
}

function toJob(data: z.infer<typeof responseSchema>): GenerationJob {
  const outputs: GenerationOutput[] = [
    ...(data.images ?? []).map((m) => ({
      kind: 'image' as const,
      url: m.url,
      contentType: m.content_type ?? null,
    })),
    ...(data.video
      ? [
          {
            kind: 'video' as const,
            url: data.video.url,
            contentType: data.video.content_type ?? null,
          },
        ]
      : []),
  ];
  const error =
    data.status === 'nsfw'
      ? 'İçerik moderasyonu tarafından reddedildi.'
      : data.status === 'failed'
        ? 'Sağlayıcı üretimi tamamlayamadı.'
        : null;
  return {
    providerJobId: data.request_id,
    status: statusMap[data.status],
    outputs: data.status === 'completed' ? outputs : [],
    error,
    credits: null,
  };
}
