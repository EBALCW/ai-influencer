// Testler için bellek içi kuyruk: makine RPC'lerinin sözleşmesini (kira, aşama sırası, onay,
// iptal, geçici/kalıcı hata) veritabanı olmadan taklit eder. Gerçek sözleşme pgTAP ve
// entegrasyon testleriyle doğrulanır; bu sahte yalnız döngü mantığını denemek içindir.
import { ApiError } from '../lib/errors.ts';
import type { JobRow, WorkerApi, WorkerRow } from '../lib/worker-api.ts';

export interface FakeStage {
  key: string;
  requires_approval?: boolean;
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
  output?: Record<string, unknown>;
  approved?: boolean;
  progress?: number;
  detail?: string | null;
}

export interface FakeJob extends JobRow {
  stages: FakeStage[];
  required: string[];
  error: string | null;
  uploads: {
    fileName: string;
    role: string;
    stage: string;
    size: number;
    contentType: string;
  }[];
}

const rpcError = (status: number, code: string, hint?: string) =>
  new ApiError(hint ?? code, { status, code, hint: hint ?? null });

export function createFakeApi(options: { now?: () => number } = {}) {
  const now = options.now ?? Date.now;
  const jobs: FakeJob[] = [];
  const calls: string[] = [];
  const state = {
    worker: null as WorkerRow | null,
    revoked: false,
    /** Sıradaki N çağrı (ada göre) geçici hata verir. */
    failNext: new Map<string, number>(),
    heartbeats: 0,
  };
  let seq = 0;
  const id = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;

  function guard(name: string) {
    calls.push(name);
    const remaining = state.failNext.get(name) ?? 0;
    if (remaining > 0) {
      state.failNext.set(name, remaining - 1);
      throw new ApiError('geçici', { status: 503 });
    }
    if (state.revoked) throw rpcError(403, '42501', 'worker_revoked');
  }
  const lease = (seconds: number) =>
    new Date(now() + seconds * 1000).toISOString();

  function held(jobId: string): FakeJob {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) throw rpcError(404, 'P0002');
    if (
      job.status !== 'running' ||
      job.worker_id !== state.worker?.id ||
      !job.lease_expires_at ||
      Date.parse(job.lease_expires_at) <= now()
    )
      throw rpcError(400, '55000', 'lease_lost');
    return job;
  }
  const current = (job: FakeJob) =>
    job.stages.find((stage) => stage.key === job.current_stage)!;
  function skipOpen(job: FakeJob) {
    for (const stage of job.stages)
      if (stage.status === 'pending' || stage.status === 'running')
        stage.status = 'skipped';
  }
  function advance(job: FakeJob, keepWorker: boolean) {
    const index = job.stages.findIndex(
      (stage) => stage.key === job.current_stage,
    );
    const next = job.stages[index + 1];
    if (!next) {
      job.status = 'succeeded';
      job.lease_expires_at = null;
    } else {
      job.current_stage = next.key;
      if (!keepWorker) {
        job.status = 'queued';
        job.lease_expires_at = null;
      }
    }
  }
  const row = (job: FakeJob): JobRow => ({ ...job });

  const api: WorkerApi = {
    async registerWorker(input) {
      guard('register_worker');
      state.worker = {
        id: state.worker?.id ?? id(),
        workspace_id: '11111111-1111-4111-8111-111111111111',
        name: input.name,
        platform: input.platform,
        version: input.version,
        capabilities: [...input.capabilities],
        last_seen_at: new Date(now()).toISOString(),
        revoked_at: null,
      };
      return state.worker;
    },
    async heartbeat() {
      guard('worker_heartbeat');
      state.heartbeats += 1;
      return state.worker!;
    },
    async claimJob(_workerId, leaseSeconds) {
      guard('claim_job');
      // Kirası dolan işler kuyruğa döner
      for (const job of jobs)
        if (
          job.status === 'running' &&
          job.lease_expires_at &&
          Date.parse(job.lease_expires_at) <= now()
        ) {
          job.attempts += 1;
          const stage = current(job);
          if (job.attempts >= job.max_attempts) {
            stage.status = 'failed';
            skipOpen(job);
            job.status = 'failed';
          } else {
            stage.status = 'pending';
            job.status = 'queued';
          }
          job.lease_expires_at = null;
        }
      const job = jobs.find(
        (item) =>
          item.status === 'queued' &&
          item.required.every((key) =>
            state.worker!.capabilities.includes(key),
          ),
      );
      if (!job) return null;
      job.status = 'running';
      job.worker_id = state.worker!.id;
      job.lease_expires_at = lease(leaseSeconds);
      return row(job);
    },
    async startStage(_workerId, jobId, stage, leaseSeconds) {
      guard('start_stage');
      const job = held(jobId);
      if (job.cancel_requested_at)
        throw rpcError(400, '55000', 'cancel_requested');
      if (job.current_stage !== stage)
        throw rpcError(400, '55000', 'stage_out_of_order');
      const item = current(job);
      if (item.status === 'pending') item.status = 'running';
      else if (item.status !== 'running')
        throw rpcError(400, '55000', 'illegal_transition');
      job.lease_expires_at = lease(leaseSeconds);
      return row(job);
    },
    async reportProgress(_workerId, jobId, progress, detail, leaseSeconds) {
      guard('report_progress');
      const job = held(jobId);
      const item = current(job);
      if (progress !== null) item.progress = progress;
      if (detail !== null) item.detail = detail;
      job.lease_expires_at = lease(leaseSeconds);
      return row(job);
    },
    async completeStage(_workerId, jobId, stage, output) {
      guard('complete_stage');
      const job = held(jobId);
      const item = current(job);
      if (job.current_stage !== stage || item.status !== 'running')
        throw rpcError(400, '55000', 'illegal_transition');
      item.status = 'succeeded';
      item.output = output;
      if (job.cancel_requested_at) {
        skipOpen(job);
        job.status = 'cancelled';
        job.lease_expires_at = null;
      } else if (item.requires_approval) {
        job.status = 'awaiting_approval';
        job.lease_expires_at = null;
      } else advance(job, true);
      return row(job);
    },
    async failStage(_workerId, jobId, stage, error, retryable) {
      guard('fail_stage');
      const job = held(jobId);
      const item = current(job);
      if (job.current_stage !== stage || item.status !== 'running')
        throw rpcError(400, '55000', 'illegal_transition');
      const retry =
        retryable &&
        !job.cancel_requested_at &&
        job.attempts + 1 < job.max_attempts;
      job.attempts += 1;
      job.error = error;
      job.lease_expires_at = null;
      if (retry) {
        item.status = 'pending';
        job.status = 'queued';
      } else {
        item.status = 'failed';
        skipOpen(job);
        job.status = job.cancel_requested_at ? 'cancelled' : 'failed';
      }
      return row(job);
    },
    async acknowledgeCancel(_workerId, jobId) {
      guard('acknowledge_cancel');
      const job = held(jobId);
      if (!job.cancel_requested_at) throw rpcError(400, '55000');
      skipOpen(job);
      job.status = 'cancelled';
      job.lease_expires_at = null;
      return row(job);
    },
    async uploadOutput(input) {
      guard('upload_output');
      const job = held(input.job.id);
      job.uploads.push({
        fileName: input.fileName,
        role: input.role,
        stage: input.stage,
        size: input.body.byteLength,
        contentType: input.contentType,
      });
    },
  };

  return {
    api,
    jobs,
    calls,
    state,
    enqueue(input: {
      kind: string;
      stages: { key: string; requires_approval?: boolean }[];
      params?: unknown;
      required?: string[];
      maxAttempts?: number;
    }): FakeJob {
      const job: FakeJob = {
        id: id(),
        workspace_id: '11111111-1111-4111-8111-111111111111',
        module: input.kind.split('.')[0]!,
        kind: input.kind,
        params: input.params ?? {},
        status: 'queued',
        current_stage: input.stages[0]!.key,
        cancel_requested_at: null,
        lease_expires_at: null,
        attempts: 0,
        max_attempts: input.maxAttempts ?? 3,
        worker_id: null,
        stages: input.stages.map((stage) => ({ ...stage, status: 'pending' })),
        required: input.required ?? [],
        error: null,
        uploads: [],
      };
      jobs.push(job);
      return job;
    },
    approve(job: FakeJob) {
      if (job.status !== 'awaiting_approval')
        throw new Error('onay beklemiyor');
      current(job).approved = true;
      advance(job, false);
    },
    requestCancel(job: FakeJob) {
      if (job.status === 'running')
        job.cancel_requested_at = new Date(now()).toISOString();
      else {
        skipOpen(job);
        job.status = 'cancelled';
      }
    },
  };
}
