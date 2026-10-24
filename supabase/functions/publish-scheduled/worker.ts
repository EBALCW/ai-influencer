// Yayın kuyruğu worker'ı (#58). Veritabanı ve yayıncılar enjekte edilir; testler sahte
// implementasyonlarla ağ olmadan koşar.
//
// Her iş için: yayın anında tekrar doğrula (check-list + AI etiketi, ücretli ortaklık desteği,
// hesap bağlı, final video) → yayıncıyı çağır → sonucu yaz. Hata sınıfına göre:
//   TokenExpiredError → hesap durumu (expired/error) + iş failed (tekrar denenmez, uyarı)
//   RateLimitedError / TransientError / beklenmeyen hata → attempts+1, üstel backoff
//     (Retry-After daha uzunsa o), max_attempts dolunca failed
//   PermanentError → failed
import {
  CollectorError,
  PermanentError,
  RateLimitedError,
  type SocialToken,
  TokenExpiredError,
} from '../_shared/collectors/types.ts';
import {
  aiLabelChecked,
  checklistReady,
} from '../_shared/publishers/checklist.ts';
import {
  DEFAULT_PUBLISH_CONFIG,
  type PublishConfig,
} from '../_shared/publishers/config.ts';
import type {
  PublishCheckpoint,
  Publisher,
  PublishInput,
  PublishOutcome,
  PublishPlatform,
} from '../_shared/publishers/types.ts';
import { redact } from '../_shared/sync/orchestrator.ts';

export type PublishJobStatus =
  | 'queued'
  | 'processing'
  | 'published'
  | 'failed'
  | 'manual_required'
  | 'cancelled';

export interface PublishJob {
  id: string;
  content_item_id: string;
  account_id: string;
  asset_id: string | null;
  platform: 'instagram' | 'youtube' | 'tiktok';
  status: PublishJobStatus;
  title: string;
  caption: string;
  tags: string[];
  paid_partnership: boolean;
  attempts: number;
  max_attempts: number;
  provider_container_id: string | null;
  provider_upload_url: string | null;
  container_created_at: string | null;
}

export interface JobContext {
  checklist: unknown;
  account: {
    id: string;
    externalId: string | null;
    status: string;
    connected: boolean;
  } | null;
  asset: {
    storagePath: string;
    mimeType: string | null;
    sizeBytes: number | null;
    width: number | null;
    height: number | null;
    durationMs: number | null;
  } | null;
}

export type JobPatch = Partial<{
  status: 'processing' | 'failed' | 'manual_required';
  attempts: number;
  next_attempt_at: string;
  provider_container_id: string | null;
  provider_upload_url: string | null;
  container_created_at: string | null;
  error: string | null;
}>;

export interface PublishStore {
  claim(limit: number, leaseSeconds: number): Promise<PublishJob[]>;
  /** İçerik, hesap ve asset (influencer filtresiyle). İçerik yoksa null. */
  context(job: PublishJob): Promise<JobContext | null>;
  readToken(accountId: string): Promise<SocialToken | null>;
  signedUrl(storagePath: string, seconds: number): Promise<string>;
  download(storagePath: string): Promise<Uint8Array<ArrayBuffer>>;
  /** Yalnız hâlâ processing olan satırı günceller. */
  update(id: string, patch: JobPatch): Promise<void>;
  complete(
    id: string,
    result: {
      externalId: string;
      url: string | null;
      publishedAt: Date | null;
      durationS: number | null;
      isShort: boolean;
    },
  ): Promise<void>;
  setAccountStatus(
    accountId: string,
    status: 'expired' | 'error',
  ): Promise<void>;
}

export interface WorkerOptions {
  store: PublishStore;
  publishers: Partial<Record<PublishPlatform, Publisher>>;
  config?: PublishConfig;
  fetch?: typeof fetch;
  now?: () => Date;
  batchSize?: number;
  leaseSeconds?: number;
  backoffBaseSeconds?: number;
  backoffMaxSeconds?: number;
}

export type JobResult =
  'published' | 'pending' | 'retry' | 'failed' | 'manual_required';

export interface WorkerResult {
  claimed: number;
  outcomes: Record<string, JobResult>;
}

/** Denemeye göre üstel geri çekilme (saniye). attempt 1 → base. */
export function backoffSeconds(attempt: number, base = 60, max = 3600): number {
  return Math.min(max, base * 2 ** Math.max(0, attempt - 1));
}

export const MESSAGES = {
  checklist:
    'Yayın anında check-list veya AI etiketi eksik; içerik otomatik yayınlanmadı.',
  paidPartnership:
    'Ücretli ortaklık etiketi bu platformda API ile verilemiyor; uygulamadan elle yayınlayın ve postu eşleştirin.',
  aiLabel:
    'Bu platformda AI etiketi API ile verilemiyor; uygulamadan elle yayınlayın.',
  notConnected:
    'Hesap bağlı değil veya token bulunamadı; hesabı yeniden bağlayın.',
  noVideo: 'Final video bulunamadı.',
  unsupported: 'Bu platform için otomatik yayın yok.',
  tooLarge: 'Final video boyut sınırını aşıyor.',
} as const;

class StopJob extends Error {
  constructor(
    readonly kind: 'failed' | 'manual_required',
    message: string,
  ) {
    super(message);
  }
}

export async function runPublishWorker(
  options: WorkerOptions,
): Promise<WorkerResult> {
  const {
    store,
    publishers,
    config = DEFAULT_PUBLISH_CONFIG,
    fetch: fetchFn = fetch,
    now = () => new Date(),
    batchSize = 5,
    leaseSeconds = 600,
    backoffBaseSeconds = 60,
    backoffMaxSeconds = 3600,
  } = options;

  const jobs = await store.claim(batchSize, leaseSeconds);
  const outcomes: Record<string, JobResult> = {};
  const at = (seconds: number) =>
    new Date(now().getTime() + seconds * 1000).toISOString();

  for (const job of jobs) {
    const secrets: (string | undefined)[] = [];
    try {
      outcomes[job.id] = await processJob(job, secrets);
    } catch (error) {
      try {
        outcomes[job.id] = await handleError(job, error, secrets);
      } catch (e) {
        // Durum yazılamadı: kira bitince iş yeniden alınır.
        console.error(
          'publish-scheduled durum yazılamadı',
          job.id,
          redact(e instanceof Error ? e.message : String(e), secrets),
        );
        outcomes[job.id] = 'retry';
      }
    }
  }
  return { claimed: jobs.length, outcomes };

  async function processJob(
    job: PublishJob,
    secrets: (string | undefined)[],
  ): Promise<JobResult> {
    const ctx = await store.context(job);
    if (!ctx) throw new StopJob('failed', 'İçerik bulunamadı.');
    // İstemcinin "tamam" demesine güvenilmez: aynı kural yayın anında tekrar.
    if (!checklistReady(ctx.checklist) || !aiLabelChecked(ctx.checklist)) {
      throw new StopJob('manual_required', MESSAGES.checklist);
    }
    const publisher =
      job.platform === 'tiktok' ? undefined : publishers[job.platform];
    if (!publisher) throw new StopJob('failed', MESSAGES.unsupported);
    if (!publisher.capabilities.aiLabel) {
      throw new StopJob('manual_required', MESSAGES.aiLabel);
    }
    if (job.paid_partnership && !publisher.capabilities.paidPartnership) {
      throw new StopJob('manual_required', MESSAGES.paidPartnership);
    }
    if (!ctx.account || !ctx.account.connected) {
      throw new StopJob('failed', MESSAGES.notConnected);
    }
    if (!['active', 'error'].includes(ctx.account.status)) {
      throw new StopJob('failed', MESSAGES.notConnected);
    }
    if (!ctx.asset) throw new StopJob('failed', MESSAGES.noVideo);
    if (
      ctx.asset.sizeBytes !== null &&
      ctx.asset.sizeBytes > config.maxVideoBytes
    ) {
      throw new StopJob('failed', MESSAGES.tooLarge);
    }

    const token = await store.readToken(ctx.account.id);
    if (!token) throw new TokenExpiredError('Token kasada bulunamadı', 'error');
    secrets.push(token.accessToken, token.refreshToken);

    const asset = ctx.asset;
    const videoUrl =
      job.platform === 'instagram'
        ? await store.signedUrl(asset.storagePath, config.signedUrlSeconds)
        : '';
    if (videoUrl) secrets.push(videoUrl);

    const input: PublishInput = {
      jobId: job.id,
      account: {
        id: ctx.account.id,
        platform: publisher.platform,
        externalId: ctx.account.externalId,
      },
      title: job.title,
      caption: job.caption,
      tags: job.tags ?? [],
      paidPartnership: job.paid_partnership,
      video: {
        url: videoUrl,
        mimeType: asset.mimeType ?? 'video/mp4',
        sizeBytes: asset.sizeBytes,
        width: asset.width,
        height: asset.height,
        durationMs: asset.durationMs,
      },
      containerId: job.provider_container_id,
      containerCreatedAt: job.container_created_at
        ? new Date(job.container_created_at)
        : null,
      uploadUrl: job.provider_upload_url,
    };

    const outcome: PublishOutcome = await publisher.publish(
      {
        token,
        fetch: fetchFn,
        now: now(),
        loadVideo: async () => {
          const bytes = await store.download(asset.storagePath);
          if (bytes.byteLength > config.maxVideoBytes) {
            throw new StopJob('failed', MESSAGES.tooLarge);
          }
          return bytes;
        },
        checkpoint: async (state: PublishCheckpoint) => {
          const patch: JobPatch = {};
          if ('containerId' in state) {
            patch.provider_container_id = state.containerId ?? null;
          }
          if ('containerCreatedAt' in state) {
            patch.container_created_at = state.containerCreatedAt
              ? state.containerCreatedAt.toISOString()
              : null;
          }
          if ('uploadUrl' in state)
            patch.provider_upload_url = state.uploadUrl ?? null;
          if (state.uploadUrl) secrets.push(state.uploadUrl);
          await store.update(job.id, patch);
        },
        warn: (m) =>
          console.warn('publish-scheduled', job.id, redact(m, secrets)),
      },
      input,
    );

    if (outcome.kind === 'published') {
      await store.complete(job.id, outcome);
      return 'published';
    }
    if (outcome.kind === 'pending') {
      await store.update(job.id, {
        next_attempt_at: at(Math.max(10, outcome.retryAfterSeconds)),
        error: null,
      });
      return 'pending';
    }
    throw new StopJob('manual_required', outcome.reason);
  }

  async function handleError(
    job: PublishJob,
    error: unknown,
    secrets: (string | undefined)[],
  ): Promise<JobResult> {
    if (error instanceof StopJob) {
      await store.update(job.id, { status: error.kind, error: error.message });
      return error.kind;
    }
    const message = redact(
      error instanceof Error ? error.message : 'Beklenmeyen hata',
      secrets,
    );
    if (error instanceof TokenExpiredError) {
      try {
        await store.setAccountStatus(job.account_id, error.accountStatus);
      } catch (e) {
        console.error(
          'publish-scheduled hesap durumu',
          e instanceof Error ? e.message : e,
        );
      }
      await store.update(job.id, {
        status: 'failed',
        error: `Token: ${message}`,
      });
      return 'failed';
    }
    if (error instanceof PermanentError) {
      await store.update(job.id, { status: 'failed', error: message });
      return 'failed';
    }
    if (!(error instanceof CollectorError)) {
      // Beklenmeyen hata (DB, Storage): geçici sayılır, ayrıntı yalnız loga.
      console.error('publish-scheduled', job.id, message);
    }
    const attempts = job.attempts + 1;
    if (attempts >= job.max_attempts) {
      await store.update(job.id, {
        status: 'failed',
        attempts,
        error: `${attempts} denemede yayınlanamadı: ${message}`.slice(0, 500),
      });
      return 'failed';
    }
    let wait = backoffSeconds(attempts, backoffBaseSeconds, backoffMaxSeconds);
    if (error instanceof RateLimitedError && error.retryAfterSeconds !== null) {
      wait = Math.max(wait, error.retryAfterSeconds);
    }
    await store.update(job.id, {
      attempts,
      next_attempt_at: at(wait),
      error: message,
    });
    return 'retry';
  }
}
