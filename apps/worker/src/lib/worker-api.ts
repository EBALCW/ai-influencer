// Makine RPC'leri: oturum token'ını ekler, 401'de token'ı bir kez yenileyip yeniden dener.
import type { Http } from './api.ts';
import { ApiError } from './errors.ts';
import type { Session } from './session.ts';

/** `public.jobs` satırının makinenin kullandığı alanları. */
export interface JobRow {
  id: string;
  workspace_id: string;
  module: string;
  kind: string;
  params: unknown;
  status:
    | 'queued'
    | 'running'
    | 'awaiting_approval'
    | 'succeeded'
    | 'failed'
    | 'cancelled';
  current_stage: string | null;
  cancel_requested_at: string | null;
  lease_expires_at: string | null;
  attempts: number;
  max_attempts: number;
  worker_id: string | null;
  /** Anlatım işlerinde sahip bölüm ve işin açıldığı senaryo sürümü (sunucu yazar). */
  episode_id?: string | null;
  episode_script_version?: number | null;
}

export interface WorkerRow {
  id: string;
  workspace_id: string;
  name: string;
  platform: string;
  version: string;
  capabilities: string[];
  last_seen_at: string;
  revoked_at: string | null;
}

export interface WorkerApi {
  registerWorker(input: {
    name: string;
    platform: string;
    version: string;
    capabilities: readonly string[];
  }): Promise<WorkerRow>;
  heartbeat(workerId: string): Promise<WorkerRow>;
  claimJob(workerId: string, leaseSeconds: number): Promise<JobRow | null>;
  startStage(
    workerId: string,
    jobId: string,
    stage: string,
    leaseSeconds: number,
  ): Promise<JobRow>;
  reportProgress(
    workerId: string,
    jobId: string,
    progress: number | null,
    detail: string | null,
    leaseSeconds: number,
  ): Promise<JobRow>;
  completeStage(
    workerId: string,
    jobId: string,
    stage: string,
    output: Record<string, unknown>,
  ): Promise<JobRow>;
  failStage(
    workerId: string,
    jobId: string,
    stage: string,
    error: string,
    retryable: boolean,
  ): Promise<JobRow>;
  acknowledgeCancel(workerId: string, jobId: string): Promise<JobRow>;
  /** Bölümün belirli senaryo sürümünü okur (RLS: ekip üyesi okur); yoksa `null`. */
  fetchScriptVersion(episodeId: string, version: number): Promise<unknown>;
  /** Dosyayı `productions/<alan>/<iş>/<ad>` yoluna yükler ve işe bağlar. */
  uploadOutput(input: {
    workerId: string;
    job: Pick<JobRow, 'id' | 'workspace_id'>;
    fileName: string;
    body: Uint8Array;
    contentType: string;
    role: string;
    stage: string;
  }): Promise<void>;
}

export function createWorkerApi(http: Http, session: Session): WorkerApi {
  async function withToken<T>(call: (token: string) => Promise<T>): Promise<T> {
    try {
      return await call(await session.accessToken());
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        return call(await session.forceRefresh());
      throw error;
    }
  }
  const rpc = <T>(name: string, args: Record<string, unknown>) =>
    withToken((token) => http.rpc<T>(name, args, token));

  return {
    registerWorker: (input) =>
      rpc<WorkerRow>('register_worker', {
        p_name: input.name,
        p_platform: input.platform,
        p_version: input.version,
        p_capabilities: [...input.capabilities],
      }),
    heartbeat: (workerId) =>
      rpc<WorkerRow>('worker_heartbeat', { p_worker_id: workerId }),
    async claimJob(workerId, leaseSeconds) {
      const rows = await rpc<JobRow[] | JobRow | null>('claim_job', {
        p_worker_id: workerId,
        p_lease_seconds: leaseSeconds,
      });
      if (Array.isArray(rows)) return rows[0] ?? null;
      return rows ?? null;
    },
    startStage: (workerId, jobId, stage, leaseSeconds) =>
      rpc<JobRow>('start_stage', {
        p_worker_id: workerId,
        p_job_id: jobId,
        p_stage_key: stage,
        p_lease_seconds: leaseSeconds,
      }),
    reportProgress: (workerId, jobId, progress, detail, leaseSeconds) =>
      rpc<JobRow>('report_progress', {
        p_worker_id: workerId,
        p_job_id: jobId,
        p_progress: progress,
        p_detail: detail,
        p_lease_seconds: leaseSeconds,
      }),
    completeStage: (workerId, jobId, stage, output) =>
      rpc<JobRow>('complete_stage', {
        p_worker_id: workerId,
        p_job_id: jobId,
        p_stage_key: stage,
        p_output: output,
      }),
    failStage: (workerId, jobId, stage, error, retryable) =>
      rpc<JobRow>('fail_stage', {
        p_worker_id: workerId,
        p_job_id: jobId,
        p_stage_key: stage,
        p_error: error,
        p_retryable: retryable,
      }),
    acknowledgeCancel: (workerId, jobId) =>
      rpc<JobRow>('acknowledge_cancel', {
        p_worker_id: workerId,
        p_job_id: jobId,
      }),
    async fetchScriptVersion(episodeId, version) {
      // Değerler sorgu metnine girmeden önce biçimce denetlenir
      if (
        !/^[0-9a-f-]{36}$/i.test(episodeId) ||
        !Number.isInteger(version) ||
        version < 1
      )
        throw new Error('Senaryo sürümü kimliği geçersiz.');
      const rows = await withToken((token) =>
        http.select<unknown>(
          'episode_script_versions',
          `select=version,kind,language,script_text,script,fact_notes,approved_at&episode_id=eq.${episodeId}&version=eq.${version}&limit=1`,
          token,
        ),
      );
      return rows[0] ?? null;
    },
    async uploadOutput(input) {
      await withToken((token) =>
        http.upload(
          `${input.job.workspace_id}/${input.job.id}/${input.fileName}`,
          input.body,
          input.contentType,
          token,
        ),
      );
      await rpc('attach_job_output', {
        p_worker_id: input.workerId,
        p_job_id: input.job.id,
        p_file_name: input.fileName,
        p_role: input.role,
        p_stage_key: input.stage,
      });
    },
  };
}
