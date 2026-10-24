// Üretim kuyruğu worker'ı (#47). Veritabanı ve sağlayıcı enjekte edilir; testler sahte
// implementasyonlarla ağ olmadan koşar.

import {
  type GenerationMode,
  type GenerationProvider,
  type InputMedia,
  type PreparedInputs,
  ProviderError,
  type SubmitJob,
} from '../_shared/generation/provider.ts';

export type QueueJob = {
  id: string;
  influencer_id: string;
  tool: string;
  mode: GenerationMode;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  params: Record<string, unknown>;
  input_asset_ids: string[];
  provider_job_id: string | null;
  attempts: number;
  max_attempts: number;
  started_at: string | null;
  cancel_requested_at: string | null;
  /** Gönderimden önce alınan tahmin (USD). PostgREST numeric'i sayı veya metin döndürebilir. */
  estimated_cost_usd?: number | string | null;
};

export type JobPatch = Partial<{
  status: 'queued' | 'running' | 'failed' | 'cancelled';
  provider_job_id: string | null;
  attempts: number;
  progress: number;
  next_run_at: string;
  started_at: string;
  finished_at: string;
  cancel_requested_at: string | null;
  error: string | null;
  credits: number | null;
  params: Record<string, unknown>;
  estimated_cost_usd: number | null;
}>;

export interface QueueStore {
  claim(
    tools: string[],
    limit: number,
    leaseSeconds: number,
  ): Promise<QueueJob[]>;
  /** Sadece hâlâ queued/running olan satırı günceller. */
  update(id: string, patch: JobPatch): Promise<void>;
  /** Referans asset'lerin kısa ömürlü imzalı URL'leri ve MIME türleri (influencer filtresiyle). */
  inputMedia(job: QueueJob): Promise<InputMedia>;
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  complete(
    id: string,
    path: string,
    mimeType: string,
    size: number,
    credits: number | null,
    /** Gerçekleşen tutar (USD); doluysa costs kaydı bundan yazılır. */
    costUsd: number | null,
  ): Promise<void>;
  heartbeat(state: {
    providers: string[];
    claimed: number;
    message: string | null;
  }): Promise<void>;
}

export type WorkerOptions = {
  store: QueueStore;
  providers: GenerationProvider[];
  fetch?: typeof fetch;
  now?: () => Date;
  batchSize?: number;
  leaseSeconds?: number;
  pollIntervalSeconds?: number;
  backoffBaseSeconds?: number;
  backoffMaxSeconds?: number;
  runningTimeoutMinutes?: number;
  maxFileBytes?: number;
};

export type WorkerResult = {
  configured: boolean;
  claimed: number;
  outcomes: Record<string, string>;
};

export const NOT_CONFIGURED_MESSAGE =
  'Üretim sağlayıcısı yapılandırılmamış (HIGGSFIELD_API_KEY_ID / HIGGSFIELD_API_KEY_SECRET). İşler kuyrukta bekliyor.';

const mimeExtension: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const resolutions = new Set(['480p', '720p', '1080p']);
const imageResolutions = new Set(['2K', '4K']);
const aspectRatios = new Set([
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
]);

/** Kuyruk dolu (429) / Retry-After için en uzun bekleme. */
const MAX_RETRY_AFTER_SECONDS = 3600;

/** İçerik türünü belirlemeyen başlıklar (URL uzantısı / mod ile tamamlanır). */
const genericTypes = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
]);

class UnsupportedOutput extends Error {}

/** Denemeye göre üstel geri çekilme (saniye). attempt 1 → base. */
export function backoffSeconds(attempt: number, base = 30, max = 900): number {
  return Math.min(max, base * 2 ** Math.max(0, attempt - 1));
}

/** generations.params → sağlayıcı isteği. Test modu düşük çözünürlük ve kısa süre zorlar. */
export function toSubmitJob(job: QueueJob, media: PreparedInputs): SubmitJob {
  const p = job.params ?? {};
  const str = (v: unknown) =>
    typeof v === 'string' && v.trim() ? v.trim() : null;
  const int = (v: unknown) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
  const testMode = p.test_mode !== false;
  const resolution = testMode
    ? '480p'
    : resolutions.has(String(p.resolution))
      ? String(p.resolution)
      : '720p';
  const imageResolution =
    !testMode && imageResolutions.has(String(p.image_resolution))
      ? String(p.image_resolution)
      : '2K';
  const aspectRatio = aspectRatios.has(String(p.aspect_ratio))
    ? String(p.aspect_ratio)
    : null;
  const duration = int(p.duration_seconds);
  const modelParams: SubmitJob['modelParams'] = {};
  if (p.model_params && typeof p.model_params === 'object') {
    for (const [k, v] of Object.entries(
      p.model_params as Record<string, unknown>,
    )) {
      if (['string', 'number', 'boolean'].includes(typeof v)) {
        modelParams[k] = v as string | number | boolean;
      }
    }
  }
  return {
    id: job.id,
    mode: job.mode,
    prompt: str(p.prompt) ?? '',
    negative: str(p.negative),
    seed: int(p.seed),
    resolution,
    imageResolution,
    aspectRatio,
    durationSeconds:
      duration === null ? null : testMode ? Math.min(duration, 5) : duration,
    imageUrls: media.imageUrls,
    videoUrl: media.videoUrl,
    modelParams,
  };
}

/** Bu üretim için daha önce sağlayıcıya yüklenmiş referanslar (aynı Idempotency-Key = aynı gövde). */
function cachedInputs(job: QueueJob): PreparedInputs | null {
  const cached = job.params?.provider_inputs as
    | { generation_id?: unknown; image_urls?: unknown; video_url?: unknown }
    | undefined;
  if (!cached || cached.generation_id !== job.id) return null;
  if (!Array.isArray(cached.image_urls)) return null;
  const imageUrls = cached.image_urls.filter(
    (u): u is string => typeof u === 'string',
  );
  const videoUrl =
    typeof cached.video_url === 'string' ? cached.video_url : null;
  return { imageUrls, videoUrl };
}

function toUsd(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
}

export async function runWorker(options: WorkerOptions): Promise<WorkerResult> {
  const {
    store,
    providers,
    fetch: fetchImpl = fetch,
    now = () => new Date(),
    batchSize = 5,
    leaseSeconds = 120,
    pollIntervalSeconds = 15,
    backoffBaseSeconds = 30,
    backoffMaxSeconds = 900,
    runningTimeoutMinutes = 30,
    maxFileBytes = 100 * 1024 * 1024,
  } = options;

  const byTool = new Map(providers.map((p) => [p.id, p]));
  const tools = [...byTool.keys()];
  if (tools.length === 0) {
    await store.heartbeat({
      providers: [],
      claimed: 0,
      message: NOT_CONFIGURED_MESSAGE,
    });
    return { configured: false, claimed: 0, outcomes: {} };
  }

  const jobs = await store.claim(tools, batchSize, leaseSeconds);
  const outcomes: Record<string, string> = {};
  const at = (seconds: number) =>
    new Date(now().getTime() + seconds * 1000).toISOString();
  const iso = () => now().toISOString();

  const fail = (job: QueueJob, error: string, credits: number | null = null) =>
    store.update(job.id, {
      status: 'failed',
      error,
      finished_at: iso(),
      ...(credits !== null ? { credits } : {}),
    });

  for (const job of jobs) {
    const provider = byTool.get(job.tool)!;
    try {
      outcomes[job.id] = await processJob(job, provider);
    } catch (error) {
      // Beklenmeyen hata: iş kira bitince tekrar alınır. Ayrıntı loga, sır/yanıt değil.
      console.error(
        'Üretim işlenemedi',
        job.id,
        error instanceof Error ? error.message : error,
      );
      outcomes[job.id] = 'error';
    }
  }

  await store.heartbeat({
    providers: tools,
    claimed: jobs.length,
    message: null,
  });
  return { configured: true, claimed: jobs.length, outcomes };

  async function processJob(
    job: QueueJob,
    provider: GenerationProvider,
  ): Promise<string> {
    // 1) İptal isteği
    if (job.cancel_requested_at) {
      if (!job.provider_job_id) {
        await store.update(job.id, { status: 'cancelled', finished_at: iso() });
        return 'cancelled';
      }
      try {
        await provider.cancel(job.provider_job_id);
        await store.update(job.id, { status: 'cancelled', finished_at: iso() });
        return 'cancelled';
      } catch (error) {
        if (
          !(error instanceof ProviderError) ||
          error.code !== 'not_cancelable'
        )
          throw error;
        // Başlamış iş iptal edilemez; tamamlanana kadar izlenir (kredisi kaydedilir).
        await store.update(job.id, {
          cancel_requested_at: null,
          error: error.message,
          next_run_at: at(pollIntervalSeconds),
        });
        return 'cancel_refused';
      }
    }

    // 2) Henüz gönderilmemiş iş
    if (!job.provider_job_id) {
      if (job.attempts >= job.max_attempts) {
        await fail(job, 'Deneme hakkı doldu.');
        return 'failed';
      }
      const attempts = job.attempts + 1;
      try {
        const media = await providerInputs(job, provider);
        const submitJob = toSubmitJob(job, media);
        // Maliyet tahmini (USD) gönderimden önce; gerçek tutar başarıda bundan yazılır.
        const estimated = provider.estimate
          ? await provider.estimate(submitJob)
          : null;
        const { providerJobId } = await provider.submit(submitJob);
        await store.update(job.id, {
          status: 'running',
          provider_job_id: providerJobId,
          attempts,
          progress: 5,
          started_at: iso(),
          error: null,
          next_run_at: at(pollIntervalSeconds),
          ...(estimated !== null ? { estimated_cost_usd: estimated } : {}),
        });
        return 'submitted';
      } catch (error) {
        if (!(error instanceof ProviderError)) throw error;
        const backoff = backoffSeconds(
          attempts,
          backoffBaseSeconds,
          backoffMaxSeconds,
        );
        if (error.code === 'rate_limited') {
          // Kuyruk dolu: hiçbir şey oluşturulmadı/ücretlendirilmedi. Deneme hakkı harcanmaz;
          // Retry-After kadar beklenip aynı Idempotency-Key ile tekrar gönderilir.
          await store.update(job.id, {
            error: error.message,
            next_run_at: at(
              Math.min(
                MAX_RETRY_AFTER_SECONDS,
                error.retryAfterSeconds ?? backoff,
              ),
            ),
          });
          return 'rate_limited';
        }
        if (error.retryable && attempts < job.max_attempts) {
          await store.update(job.id, {
            attempts,
            error: error.message,
            next_run_at: at(
              Math.min(
                MAX_RETRY_AFTER_SECONDS,
                Math.max(backoff, error.retryAfterSeconds ?? 0),
              ),
            ),
          });
          return 'retry';
        }
        await store.update(job.id, {
          status: 'failed',
          attempts,
          error: error.message,
          finished_at: iso(),
        });
        return 'failed';
      }
    }

    // 3) Gönderilmiş iş: zaman aşımı, sonra yoklama
    const started = job.started_at ? new Date(job.started_at).getTime() : null;
    if (
      started !== null &&
      now().getTime() - started > runningTimeoutMinutes * 60_000
    ) {
      await fail(
        job,
        `Üretim ${runningTimeoutMinutes} dakikada tamamlanmadı (zaman aşımı).`,
      );
      return 'timeout';
    }

    let result;
    try {
      result = await provider.poll(job.provider_job_id);
    } catch (error) {
      if (!(error instanceof ProviderError)) throw error;
      if (!error.retryable && error.code !== 'auth_failed') {
        await fail(job, error.message);
        return 'failed';
      }
      await store.update(job.id, {
        next_run_at: at(
          Math.min(
            MAX_RETRY_AFTER_SECONDS,
            Math.max(pollIntervalSeconds * 2, error.retryAfterSeconds ?? 0),
          ),
        ),
      });
      return 'poll_retry';
    }

    if (result.status === 'queued' || result.status === 'running') {
      await store.update(job.id, {
        status: 'running',
        progress: Math.min(95, Math.max(5, result.progress ?? 50)),
        next_run_at: at(pollIntervalSeconds),
      });
      return 'running';
    }
    if (result.status === 'cancelled') {
      await store.update(job.id, { status: 'cancelled', finished_at: iso() });
      return 'cancelled';
    }
    if (result.status === 'failed') {
      await fail(
        job,
        result.error ?? 'Sağlayıcı üretimi tamamlayamadı.',
        result.credits,
      );
      return 'failed';
    }

    // succeeded → Storage'a indir, asset + üretimi bağla
    if (!result.resultUrl) {
      await fail(job, 'Sağlayıcı sonuç dosyası döndürmedi.', result.credits);
      return 'failed';
    }
    // Çıktı URL'leri expires_at'ten sonra çalışmaz (Billing and retention). Süre geçtiyse
    // indirmeyi denemeden açık hatayla bitir.
    if (result.expiresAt && now().getTime() >= Date.parse(result.expiresAt)) {
      await fail(
        job,
        `Sağlayıcı çıktısının saklama süresi doldu (expires_at ${result.expiresAt}); dosya indirilemedi.`,
        result.credits,
      );
      return 'expired';
    }
    let file: { bytes: Uint8Array; mime: string };
    try {
      file = await download(result.resultUrl, result.contentType, job.mode);
    } catch (error) {
      if (error instanceof UnsupportedOutput) {
        await fail(job, error.message, result.credits);
        return 'failed';
      }
      // Geçici indirme hatası: expires_at'e kadar tekrar denenir (bir sonraki yoklamada
      // süre geçmişse yukarıdaki kontrol işi bitirir).
      await store.update(job.id, { next_run_at: at(pollIntervalSeconds * 2) });
      return 'download_retry';
    }
    const path = `${job.influencer_id}/generated-${job.id}.${mimeExtension[file.mime]}`;
    await store.upload(path, file.bytes, file.mime);
    // Higgsfield yalnız başarılı isteği ücretlendirir; status'ta tutar yok, tahmin gerçek tutar.
    await store.complete(
      job.id,
      path,
      file.mime,
      file.bytes.byteLength,
      result.credits,
      toUsd(job.estimated_cost_usd),
    );
    return 'succeeded';
  }

  /** Referans dosyalar: önceden yüklenmişse onlar, değilse Storage → (gerekirse) sağlayıcı. */
  async function providerInputs(
    job: QueueJob,
    provider: GenerationProvider,
  ): Promise<PreparedInputs> {
    const cached = cachedInputs(job);
    if (cached) return cached;
    const media = await store.inputMedia(job);
    if (!provider.prepareInputs) {
      return {
        imageUrls: media.images.map((f) => f.url),
        videoUrl: media.video?.url ?? null,
      };
    }
    if (media.images.length === 0 && !media.video)
      return { imageUrls: [], videoUrl: null };
    const prepared = await provider.prepareInputs(media);
    // Tekrar denemede aynı gövde gitsin (aynı Idempotency-Key farklı gövdeyle 422 döner).
    await store.update(job.id, {
      params: {
        ...job.params,
        provider_inputs: {
          generation_id: job.id,
          image_urls: prepared.imageUrls,
          video_url: prepared.videoUrl,
        },
      },
    });
    return prepared;
  }

  /**
   * Sonucu indirir. Tür önceliği: yanıtın Content-Type'ı → URL uzantısı (adaptör) → mod.
   * MediaOutput'ta content_type olmadığı için başlık/uzantı belirleyicidir.
   */
  async function download(
    url: string,
    hinted: string | null,
    mode: GenerationMode,
  ): Promise<{ bytes: Uint8Array; mime: string }> {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      await res.body?.cancel();
      throw new Error(`download ${res.status}`);
    }
    const header =
      res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    const hint = hinted?.toLowerCase() ?? '';
    const mime = !genericTypes.has(header)
      ? header
      : hint || (mode === 'text_to_image' ? 'image/png' : 'video/mp4');
    if (!(mime in mimeExtension)) {
      await res.body?.cancel();
      throw new UnsupportedOutput(
        mime.startsWith('audio/')
          ? `Sağlayıcı yalnız ses çıktısı döndürdü (${mime}); ses dosyaları desteklenmiyor.`
          : `Sonuç dosyası desteklenmeyen türde (${mime}).`,
      );
    }
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > maxFileBytes) {
      await res.body?.cancel();
      throw new UnsupportedOutput('Sonuç dosyası çok büyük.');
    }
    let bytes: Uint8Array;
    try {
      bytes = await readLimited(res, maxFileBytes);
    } catch (err) {
      if (err instanceof Error && err.message === 'unsupported') {
        throw new UnsupportedOutput('Sonuç dosyası çok büyük.');
      }
      throw err;
    }
    if (bytes.byteLength === 0) {
      throw new UnsupportedOutput('Sonuç dosyası boş.');
    }
    return { bytes, mime };
  }
}

/**
 * Yanıt gövdesini en çok `maxBytes` bayta kadar okur. content-length yoksa veya yanlışsa da
 * sınır aşıldığı anda akış iptal edilir ('unsupported'); tüm dosya belleğe alınmaz.
 */
export async function readLimited(
  res: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error('unsupported');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
