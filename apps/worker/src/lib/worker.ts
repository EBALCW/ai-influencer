// Ana döngü: makineyi kaydeder, kalp atışı gönderir, kuyruğu yoklar, işi yürütür.
import { classifyRpcFailure } from './errors.ts';
import type { Logger } from './log.ts';
import type { Registry } from './registry.ts';
import { runJob, type JobOutcome } from './runner.ts';
import { backoffMs, clampLeaseSeconds } from './timing.ts';
import type { WorkerApi, WorkerRow } from './worker-api.ts';

export type WorkerPhase =
  'starting' | 'idle' | 'working' | 'stopping' | 'stopped';

/** Döngünün bitiş nedeni. */
export type ExitReason = 'stopped' | 'revoked' | 'idle';

export interface WorkerOptions {
  api: WorkerApi;
  registry: Registry;
  log: Logger;
  name: string;
  platform: string;
  version: string;
  /** Yetenek denetimi (doctor) sonucu; işleyici yetenekleri ayrıca eklenir. */
  capabilities: () => Promise<readonly string[]>;
  pollMs: number;
  heartbeatMs: number;
  leaseSeconds: number;
  workDir: string;
  /** Sırada iş kalmayınca çık (duman testi ve tek seferlik çalıştırma). */
  exitWhenIdle?: boolean;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  onRegistered?: (worker: WorkerRow) => void | Promise<void>;
  /** Test: runJob'a geçirilen ek ayarlar. */
  runner?: { progressThrottleMs?: number; renewIntervalMs?: number };
}

export interface Worker {
  run(): Promise<ExitReason>;
  /** Yeni iş almayı bırakır; süren aşama durdurulur ve iş kuyruğa bırakılır. */
  stop(): void;
  state(): {
    phase: WorkerPhase;
    workerId: string | null;
    jobId: string | null;
  };
}

/** İptal edilebilir bekleme. */
export function interruptibleSleep(
  ms: number,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener('abort', done, { once: true });
  });
}

export function createWorker(options: WorkerOptions): Worker {
  const { api, registry, log } = options;
  const sleep = options.sleep ?? interruptibleSleep;
  const leaseSeconds = clampLeaseSeconds(options.leaseSeconds);
  const shutdown = new AbortController();
  let phase: WorkerPhase = 'starting';
  let workerId: string | null = null;
  let jobId: string | null = null;
  let revoked = false;

  const setPhase = (next: WorkerPhase) => {
    // Durdurma başladıktan sonra yalnız "stopped"a geçilir
    if (phase === 'stopped' || (phase === 'stopping' && next !== 'stopped'))
      return;
    phase = next;
  };

  async function register(): Promise<WorkerRow | null> {
    const capabilities = [
      ...new Set([
        ...(await options.capabilities()),
        ...registry.capabilities(),
      ]),
    ].sort();
    for (let attempt = 1; !shutdown.signal.aborted; attempt++) {
      try {
        return await api.registerWorker({
          name: options.name,
          platform: options.platform,
          version: options.version,
          capabilities,
        });
      } catch (error) {
        const failure = classifyRpcFailure(error);
        if (failure === 'revoked') {
          revoked = true;
          return null;
        }
        if (failure !== 'retry') throw error;
        log.warn('Makine kaydedilemedi; yeniden denenecek.', {
          hata: error,
          deneme: attempt,
        });
        await sleep(backoffMs(attempt), shutdown.signal);
      }
    }
    return null;
  }

  return {
    state: () => ({ phase, workerId, jobId }),
    stop() {
      if (phase === 'stopped') return;
      setPhase('stopping');
      shutdown.abort();
    },
    async run() {
      let heartbeat: NodeJS.Timeout | undefined;
      try {
        const worker = await register();
        if (!worker) return revoked ? 'revoked' : 'stopped';
        workerId = worker.id;
        await options.onRegistered?.(worker);
        log.info('Makine hazır; kuyruk izleniyor.', {
          makine: worker.name,
          yetenek: worker.capabilities.length,
        });
        setPhase('idle');

        heartbeat = setInterval(() => {
          api.heartbeat(worker.id).catch((error: unknown) => {
            if (classifyRpcFailure(error) === 'revoked') {
              revoked = true;
              shutdown.abort();
            } else log.warn('Kalp atışı gönderilemedi.', { hata: error });
          });
        }, options.heartbeatMs);

        let failures = 0;
        while (!shutdown.signal.aborted) {
          let job;
          try {
            job = await api.claimJob(worker.id, leaseSeconds);
            failures = 0;
          } catch (error) {
            const failure = classifyRpcFailure(error);
            if (failure === 'revoked') {
              revoked = true;
              break;
            }
            failures += 1;
            log.warn('Kuyruk okunamadı; yeniden denenecek.', {
              hata: error,
              deneme: failures,
            });
            await sleep(
              backoffMs(failures, { baseMs: options.pollMs }),
              shutdown.signal,
            );
            continue;
          }
          if (!job) {
            if (options.exitWhenIdle) return 'idle';
            await sleep(options.pollMs, shutdown.signal);
            continue;
          }

          jobId = job.id;
          setPhase('working');
          log.info('İş alındı.', {
            is: job.id,
            tur: job.kind,
            asama: job.current_stage,
          });
          let outcome: JobOutcome;
          try {
            outcome = await runJob(
              {
                api,
                registry,
                log,
                workerId: worker.id,
                leaseSeconds,
                workDir: options.workDir,
                shutdown: shutdown.signal,
                ...options.runner,
              },
              job,
            );
          } catch (error) {
            // Yürütücünün kendi hatası: iş bırakılır, kirası dolunca kuyruğa döner
            log.error('İş yürütülürken beklenmeyen hata; iş bırakıldı.', {
              is: job.id,
              hata: error,
            });
            outcome = 'lease_lost';
          }
          jobId = null;
          setPhase('idle');
          log.info('İş bu makineden ayrıldı.', { is: job.id, sonuc: outcome });
          if (outcome === 'revoked') {
            revoked = true;
            break;
          }
        }
        return revoked ? 'revoked' : 'stopped';
      } finally {
        clearInterval(heartbeat);
        phase = 'stopped';
      }
    },
  };
}
