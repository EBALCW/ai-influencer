// Üretim kuyruğu worker'ı (#47). Veritabanı ve sağlayıcı enjekte edilir; testler sahte
// implementasyonlarla ağ olmadan koşar.

import {
  type GenerationMode,
  type GenerationProvider,
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
}>;

export interface QueueStore {
  claim(tools: string[], limit: number, leaseSeconds: number): Promise<QueueJob[]>;
  /** Sadece hâlâ queued/running olan satırı günceller. */
  update(id: string, patch: JobPatch): Promise<void>;
  /** Referans asset'lerin kısa ömürlü imzalı URL'leri (influencer filtresiyle). */
  inputMedia(job: QueueJob): Promise<{ imageUrls: string[]; videoUrl: string | null }>;
  upload(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  complete(
    id: string,
    path: string,
    mimeType: string,
    size: number,
    credits: number | null,
  ): Promise<void>;
  heartbeat(state: { providers: string[]; claimed: number; message: string | null }): Promise<void>;
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

/** Denemeye göre üstel geri çekilme (saniye). attempt 1 → base. */
export function backoffSeconds(attempt: number, base = 30, max = 900): number {
  return Math.min(max, base * 2 ** Math.max(0, attempt - 1));
}

/** generations.params → sağlayıcı isteği. Test modu düşük çözünürlük ve kısa süre zorlar. */
export function toSubmitJob(
  job: QueueJob,
  media: { imageUrls: string[]; videoUrl: string | null },
): SubmitJob {
  const p = job.params ?? {};
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const int = (v: unknown) =>
    typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null;
  const testMode = p.test_mode !== false;
  const resolution = testMode
    ? '480p'
    : (resolutions.has(String(p.resolution)) ? String(p.resolution) : '720p');
  const duration = int(p.duration_seconds);
  const modelParams: SubmitJob['modelParams'] = {};
  if (p.model_params && typeof p.model_params === 'object') {
    for (const [k, v] of Object.entries(p.model_params as Record<string, unknown>)) {
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
    durationSeconds: duration === null ? null : testMode ? Math.min(duration, 5) : duration,
    imageUrls: media.imageUrls,
    videoUrl: media.videoUrl,
    modelParams,
  };
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
    await store.heartbeat({ providers: [], claimed: 0, message: NOT_CONFIGURED_MESSAGE });
    return { configured: false, claimed: 0, outcomes: {} };
  }

  const jobs = await store.claim(tools, batchSize, leaseSeconds);
  const outcomes: Record<string, string> = {};
  const at = (seconds: number) => new Date(now().getTime() + seconds * 1000).toISOString();
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
      console.error('Üretim işlenemedi', job.id, error instanceof Error ? error.message : error);
      outcomes[job.id] = 'error';
    }
  }

  await store.heartbeat({ providers: tools, claimed: jobs.length, message: null });
  return { configured: true, claimed: jobs.length, outcomes };

  async function processJob(job: QueueJob, provider: GenerationProvider): Promise<string> {
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
        if (!(error instanceof ProviderError) || error.code !== 'not_cancelable') throw error;
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
        const media = await store.inputMedia(job);
        const { providerJobId } = await provider.submit(toSubmitJob(job, media));
        await store.update(job.id, {
          status: 'running',
          provider_job_id: providerJobId,
          attempts,
          progress: 5,
          started_at: iso(),
          error: null,
          next_run_at: at(pollIntervalSeconds),
        });
        return 'submitted';
      } catch (error) {
        if (!(error instanceof ProviderError)) throw error;
        if (error.retryable && attempts < job.max_attempts) {
          await store.update(job.id, {
            attempts,
            error: error.message,
            next_run_at: at(backoffSeconds(attempts, backoffBaseSeconds, backoffMaxSeconds)),
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
    if (started !== null && now().getTime() - started > runningTimeoutMinutes * 60_000) {
      await fail(job, `Üretim ${runningTimeoutMinutes} dakikada tamamlanmadı (zaman aşımı).`);
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
      await store.update(job.id, { next_run_at: at(pollIntervalSeconds * 2) });
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
      await fail(job, result.error ?? 'Sağlayıcı üretimi tamamlayamadı.', result.credits);
      return 'failed';
    }

    // succeeded → Storage'a indir, asset + üretimi bağla
    if (!result.resultUrl) {
      await fail(job, 'Sağlayıcı sonuç dosyası döndürmedi.', result.credits);
      return 'failed';
    }
    let file: { bytes: Uint8Array; mime: string };
    try {
      file = await download(result.resultUrl, result.contentType, job.mode);
    } catch (error) {
      if (error instanceof Error && error.message === 'unsupported') {
        await fail(job, 'Sonuç dosyası desteklenmeyen türde veya çok büyük.', result.credits);
        return 'failed';
      }
      // Geçici indirme hatası: sağlayıcı çıktıyı en az 7 gün tutar, sonra tekrar denenir.
      await store.update(job.id, { next_run_at: at(pollIntervalSeconds * 2) });
      return 'download_retry';
    }
    const path = `${job.influencer_id}/generated-${job.id}.${mimeExtension[file.mime]}`;
    await store.upload(path, file.bytes, file.mime);
    await store.complete(job.id, path, file.mime, file.bytes.byteLength, result.credits);
    return 'succeeded';
  }

  async function download(
    url: string,
    hinted: string | null,
    mode: GenerationMode,
  ): Promise<{ bytes: Uint8Array; mime: string }> {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`download ${res.status}`);
    const header = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
    const mime = [header, hinted?.toLowerCase() ?? '', mode === 'text_to_image' ? 'image/png' : 'video/mp4']
      .find((m) => m in mimeExtension)!;
    const declared = Number(res.headers.get('content-length') ?? '0');
    if (declared > maxFileBytes) throw new Error('unsupported');
    if (header && !(header in mimeExtension) && header !== 'application/octet-stream') {
      throw new Error('unsupported');
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > maxFileBytes) throw new Error('unsupported');
    return { bytes, mime };
  }
}
