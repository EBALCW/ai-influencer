// Bir işi aşama aşama yürütür: aşamayı başlatır, işleyiciyi çalıştırır, ilerlemeyi yazar, kirayı
// uzatır, iptal isteğini görünce işleyiciyi durdurur ve sonucu bildirir.
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import {
  AbortedError,
  PermanentError,
  TransientError,
  classifyRpcFailure,
  isRetryableApiFailure,
  isRetryableStageError,
} from './errors.ts';
import type { Logger } from './log.ts';
import { safeErrorMessage } from './redact.ts';
import {
  isJobAssetRole,
  isSafeFileName,
  validateStageOutput,
  type Registry,
  type StageContext,
} from './registry.ts';
import { runProcess } from './spawn.ts';
import {
  backoffMs,
  clampProgress,
  leaseExpired,
  leaseRenewIntervalMs,
} from './timing.ts';
import type { JobRow, WorkerApi } from './worker-api.ts';

/**
 * İşin bu makinedeki sonu:
 *  - advanced: iş bitti ya da onay bekliyor
 *  - released: iş kuyruğa döndü (geçici hata ya da kapanış)
 *  - failed / cancelled: son durum
 *  - lease_lost: iş artık bu makinede değil (kira doldu ya da başka yerde ilerledi)
 *  - revoked: makinenin yetkisi kaldırıldı; program durmalı
 */
export type JobOutcome =
  'advanced' | 'released' | 'failed' | 'cancelled' | 'lease_lost' | 'revoked';

export interface RunnerDeps {
  api: WorkerApi;
  registry: Registry;
  log: Logger;
  workerId: string;
  leaseSeconds: number;
  workDir: string;
  /** Program kapanırken tetiklenir. */
  shutdown: AbortSignal;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** İlerleme çağrıları arasındaki en kısa süre. */
  progressThrottleMs?: number;
  /** Kira yenileme aralığı (varsayılan: kira süresinin üçte biri). */
  renewIntervalMs?: number;
  /** Tek dosya yükleme sınırı (büyük dosyalar #215). */
  maxUploadBytes?: number;
}

export const SHUTDOWN_MESSAGE = 'Makine kapatıldı; iş kuyruğa döndü.';
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const UPLOAD_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/json',
  'text/plain',
  'text/vtt',
  'application/x-subrip',
]);

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Geçici hatada yeniden dener; kalıcı sonuçları sınıflandırıp döndürür. */
async function settle<T>(
  call: () => Promise<T>,
  deps: Pick<RunnerDeps, 'sleep'>,
  attempts = 4,
): Promise<
  | { ok: true; value: T }
  | {
      ok: false;
      failure: ReturnType<typeof classifyRpcFailure>;
      error: unknown;
    }
> {
  const sleep = deps.sleep ?? defaultSleep;
  for (let attempt = 1; ; attempt++) {
    try {
      return { ok: true, value: await call() };
    } catch (error) {
      const failure = classifyRpcFailure(error);
      if (failure !== 'retry' || attempt >= attempts)
        return { ok: false, failure, error };
      await sleep(backoffMs(attempt, { baseMs: 500, maxMs: 8000 }));
    }
  }
}

function finalOutcome(job: JobRow): JobOutcome {
  if (job.status === 'failed') return 'failed';
  if (job.status === 'cancelled') return 'cancelled';
  if (job.status === 'queued') return 'released';
  return 'advanced';
}

export async function runJob(
  deps: RunnerDeps,
  claimed: JobRow,
): Promise<JobOutcome> {
  const { api, registry, workerId, leaseSeconds } = deps;
  const now = deps.now ?? Date.now;
  const throttleMs = deps.progressThrottleMs ?? 2000;
  const renewMs = deps.renewIntervalMs ?? leaseRenewIntervalMs(leaseSeconds);
  const log = deps.log.child({ is: claimed.id, tur: claimed.kind });
  // İş kimliği veritabanından gelir; yine de klasör adı olarak kullanılmadan önce denetlenir
  if (
    !/^[0-9a-f-]{36}$/i.test(claimed.id) ||
    !/^[0-9a-f-]{36}$/i.test(claimed.workspace_id)
  ) {
    log.error('İş kimliği beklenen biçimde değil; iş bırakıldı.');
    return 'lease_lost';
  }
  const jobDir = path.join(deps.workDir, claimed.id);
  let job = claimed;

  const failWith = async (
    stage: string,
    message: string,
    retryable: boolean,
  ): Promise<JobOutcome> => {
    const result = await settle(
      () => api.failStage(workerId, job.id, stage, message, retryable),
      deps,
    );
    if (result.ok) return finalOutcome(result.value);
    if (result.failure === 'revoked') return 'revoked';
    log.warn('Hata bildirilemedi; iş kirası dolunca kuyruğa dönecek.', {
      hata: result.error,
    });
    return 'lease_lost';
  };
  const acknowledge = async (): Promise<JobOutcome> => {
    const result = await settle(
      () => api.acknowledgeCancel(workerId, job.id),
      deps,
    );
    if (result.ok) return 'cancelled';
    if (result.failure === 'revoked') return 'revoked';
    return 'lease_lost';
  };

  try {
    await mkdir(jobDir, { recursive: true });
    for (;;) {
      const stage = job.current_stage;
      if (!stage || job.status !== 'running') return finalOutcome(job);
      const stageLog = log.child({ asama: stage });

      // 1) Aşamayı başlat
      const started = await settle(
        () => api.startStage(workerId, job.id, stage, leaseSeconds),
        deps,
      );
      if (!started.ok) {
        if (started.failure === 'cancel_requested') {
          stageLog.info('İptal istendi; iş kapatılıyor.');
          return await acknowledge();
        }
        if (started.failure === 'revoked') return 'revoked';
        stageLog.warn('Aşama başlatılamadı; iş bırakıldı.', {
          hata: started.error,
        });
        return 'lease_lost';
      }
      job = started.value;

      // 2) Kapanış istenmişse işi hemen kuyruğa bırak
      if (deps.shutdown.aborted)
        return await failWith(stage, SHUTDOWN_MESSAGE, true);

      // 3) İşleyiciyi ve parametreleri bul
      const entry = registry.find(job.kind, stage);
      if (!entry) {
        stageLog.error('Bu aşamanın işleyicisi bu makinede yok.');
        return await failWith(
          stage,
          'Bu makinede bu aşamanın işleyicisi yok.',
          true,
        );
      }
      const parsed = entry.parse(job.params);
      if (!parsed.ok) {
        stageLog.error('İş parametreleri şemaya uymuyor.', {
          sorunlar: parsed.issues,
        });
        return await failWith(
          stage,
          `İş parametreleri geçersiz: ${parsed.issues.join('; ')}`,
          false,
        );
      }

      // 4) İlerleme, kira ve iptal
      const controller = new AbortController();
      const onShutdown = () => controller.abort();
      deps.shutdown.addEventListener('abort', onShutdown, { once: true });
      let stop: 'cancel' | 'lease_lost' | 'revoked' | null = null;
      let latest: { progress: number | null; detail: string | null } = {
        progress: null,
        detail: null,
      };
      let dirty = false;
      let lastSentAt = 0;
      let sending: Promise<void> | null = null;
      let leaseUntil = job.lease_expires_at;

      const send = (): Promise<void> => {
        sending ??= (async () => {
          const payload = latest;
          dirty = false;
          lastSentAt = now();
          try {
            const updated = await api.reportProgress(
              workerId,
              job.id,
              payload.progress,
              payload.detail,
              leaseSeconds,
            );
            leaseUntil = updated.lease_expires_at;
            if (updated.cancel_requested_at && !stop) {
              stop = 'cancel';
              stageLog.info('İptal istendi; aşama durduruluyor.');
              controller.abort();
            }
          } catch (error) {
            const failure = classifyRpcFailure(error);
            if (failure === 'revoked') stop ??= 'revoked';
            else if (failure === 'lease_lost' || failure === 'cancel_requested')
              stop ??= 'lease_lost';
            else if (leaseExpired(leaseUntil, now(), 2000))
              stop ??= 'lease_lost';
            else {
              dirty = true;
              stageLog.warn('İlerleme yazılamadı; yeniden denenecek.', {
                hata: error,
              });
            }
            if (stop) controller.abort();
          } finally {
            sending = null;
          }
        })();
        return sending;
      };
      const tick = setInterval(() => {
        void send();
      }, renewMs);
      const flush = setInterval(
        () => {
          if (dirty && now() - lastSentAt >= throttleMs) void send();
        },
        Math.max(50, Math.min(throttleMs, 500)),
      );

      const context: StageContext<unknown> = {
        jobId: job.id,
        kind: entry.kind,
        stage,
        params: parsed.value,
        workDir: jobDir,
        signal: controller.signal,
        log: stageLog,
        progress(percent, detail) {
          latest = {
            progress: clampProgress(percent),
            detail:
              typeof detail === 'string' ? detail.slice(0, 500) : latest.detail,
          };
          dirty = true;
          if (now() - lastSentAt >= throttleMs) void send();
        },
        run(file, args, options) {
          return runProcess(file, args, {
            ...options,
            cwd: options.cwd ?? jobDir,
            signal: controller.signal,
          });
        },
        maxUploadBytes: deps.maxUploadBytes ?? MAX_UPLOAD_BYTES,
        async loadScript() {
          const episodeId = job.episode_id;
          const version = job.episode_script_version;
          if (!episodeId || !version)
            throw new PermanentError('Bu iş bir bölüme bağlı değil.');
          let row: unknown;
          try {
            row = await api.fetchScriptVersion(episodeId, version);
          } catch (error) {
            // Ağ ve sunucu hataları geçicidir; yetki ya da biçim hatası değildir
            if (isRetryableApiFailure(error))
              throw new TransientError('Senaryo okunamadı (ağ).');
            throw error;
          }
          if (!row) throw new PermanentError('İşin senaryo sürümü bulunamadı.');
          return row;
        },
        async attach(output) {
          if (controller.signal.aborted)
            throw new AbortedError('İş durduruldu.');
          if (!isSafeFileName(output.fileName))
            throw new PermanentError('Çıktı dosyasının adı geçersiz.');
          if (!isJobAssetRole(output.role))
            throw new PermanentError('Çıktı rolü geçersiz.');
          if (!UPLOAD_TYPES.has(output.contentType))
            throw new PermanentError('Çıktı dosyasının türü desteklenmiyor.');
          if (
            output.body.byteLength > (deps.maxUploadBytes ?? MAX_UPLOAD_BYTES)
          )
            throw new PermanentError(
              'Çıktı dosyası bu sürümün yükleme sınırını aşıyor.',
            );
          await api.uploadOutput({
            workerId,
            job,
            fileName: output.fileName,
            body: output.body,
            contentType: output.contentType,
            role: output.role,
            stage,
          });
        },
      };

      // 5) İşleyiciyi çalıştır
      stageLog.info('Aşama başladı.', { deneme: job.attempts + 1 });
      let output: unknown;
      let failure: unknown = null;
      try {
        output = await entry.handler(context);
      } catch (error) {
        failure = error ?? new Error('Bilinmeyen hata.');
      } finally {
        clearInterval(tick);
        clearInterval(flush);
        deps.shutdown.removeEventListener('abort', onShutdown);
        if (sending) await sending;
        // Seyreltme yüzünden bekleyen son ilerleme kaybolmasın (aşamanın son notu görünsün)
        if (dirty && !stop && !failure) await send();
      }

      // 6) Sonucu bildir
      if (stop === 'revoked') return 'revoked';
      if (stop === 'lease_lost') {
        stageLog.warn(
          'İş artık bu makinede değil (kira doldu ya da iş başka yerde ilerledi).',
        );
        return 'lease_lost';
      }
      if (stop === 'cancel') {
        stageLog.info('Aşama durduruldu; iptal onaylanıyor.');
        return await acknowledge();
      }
      if (deps.shutdown.aborted) {
        stageLog.info('Program kapanıyor; iş kuyruğa bırakılıyor.');
        return await failWith(stage, SHUTDOWN_MESSAGE, true);
      }
      if (failure) {
        const retryable = isRetryableStageError(failure);
        const message = safeErrorMessage(failure);
        stageLog.error(
          retryable
            ? 'Aşama geçici hatayla durdu.'
            : 'Aşama kalıcı hatayla durdu.',
          {
            hata: message,
          },
        );
        return await failWith(stage, message, retryable);
      }
      const summary = validateStageOutput(output);
      if (!summary) {
        stageLog.error(
          'Aşama çıktısı veritabanı sınırına uymuyor (nesne, en çok 8 KB).',
        );
        return await failWith(
          stage,
          'Aşama çıktısı geçersiz ya da çok büyük.',
          false,
        );
      }
      const completed = await settle(
        () => api.completeStage(workerId, job.id, stage, summary),
        deps,
      );
      if (!completed.ok) {
        if (completed.failure === 'revoked') return 'revoked';
        stageLog.warn(
          'Aşama bitti ama bildirilemedi; iş kirası dolunca yeniden denenecek.',
          {
            hata: completed.error,
          },
        );
        return 'lease_lost';
      }
      job = completed.value;
      stageLog.info('Aşama bitti.', { durum: job.status });
      if (job.status !== 'running') return finalOutcome(job);
    }
  } finally {
    // Geçici dosyalar iş bu makineden ayrılınca silinir
    await rm(jobDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
