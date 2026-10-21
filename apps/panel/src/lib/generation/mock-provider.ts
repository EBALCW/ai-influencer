import type { GenerationProvider } from './provider';
import { GenerationError } from './errors';
import { assertTransition } from './status';
import {
  imageRequestSchema,
  imageToVideoRequestSchema,
  videoToVideoRequestSchema,
  type GenerationJob,
  type SubmitOptions,
} from './types';
import { parseRequest } from './validate';

type MockJob = {
  id: string;
  kind: 'image' | 'video';
  createdAt: number;
  outcome: 'succeeded' | 'failed';
  cancelled: boolean;
  lastStatus: GenerationJob['status'];
};

export type MockProviderOptions = {
  /** queued → running ve running → bitiş arasındaki süre (ms). */
  stepMs?: number;
  /** Testlerde zamanı kontrol etmek için. */
  now?: () => number;
};

/**
 * Geliştirme ve testler için deterministik sağlayıcı. Ağ çağrısı yapmaz.
 * Prompt'ta `[mock:fail]` geçerse iş başarısız biter; aynı idempotency
 * anahtarıyla gelen istek aynı işi döner.
 */
export class MockProvider implements GenerationProvider {
  readonly id = 'mock';
  private readonly jobs = new Map<string, MockJob>();
  private readonly byIdempotencyKey = new Map<string, string>();
  private readonly stepMs: number;
  private readonly now: () => number;
  private counter = 0;

  constructor(options: MockProviderOptions = {}) {
    this.stepMs = options.stepMs ?? 1500;
    this.now = options.now ?? Date.now;
  }

  async generateImage(request: unknown, options?: SubmitOptions) {
    const parsed = parseRequest(imageRequestSchema, request);
    return this.submit('image', parsed.prompt, options);
  }

  async imageToVideo(request: unknown, options?: SubmitOptions) {
    const parsed = parseRequest(imageToVideoRequestSchema, request);
    return this.submit('video', parsed.prompt ?? '', options);
  }

  async videoToVideo(request: unknown, options?: SubmitOptions) {
    const parsed = parseRequest(videoToVideoRequestSchema, request);
    return this.submit('video', parsed.prompt ?? '', options);
  }

  async getStatus(providerJobId: string) {
    return this.snapshot(this.find(providerJobId));
  }

  async cancel(providerJobId: string) {
    const job = this.find(providerJobId);
    const current = this.snapshot(job);
    if (current.status !== 'queued') {
      throw new GenerationError('not_cancelable');
    }
    job.cancelled = true;
    return this.snapshot(job);
  }

  private submit(
    kind: MockJob['kind'],
    prompt: string,
    options?: SubmitOptions,
  ): GenerationJob {
    const key = options?.idempotencyKey;
    const existing = key ? this.byIdempotencyKey.get(key) : undefined;
    if (existing) return this.snapshot(this.find(existing));

    this.counter += 1;
    const job: MockJob = {
      id: `mock-${this.counter.toString().padStart(6, '0')}`,
      kind,
      createdAt: this.now(),
      outcome: prompt.includes('[mock:fail]') ? 'failed' : 'succeeded',
      cancelled: false,
      lastStatus: 'queued',
    };
    this.jobs.set(job.id, job);
    if (key) this.byIdempotencyKey.set(key, job.id);
    return this.snapshot(job);
  }

  private find(id: string): MockJob {
    const job = this.jobs.get(id);
    if (!job) throw new GenerationError('not_found');
    return job;
  }

  private snapshot(job: MockJob): GenerationJob {
    const elapsed = this.now() - job.createdAt;
    const status: GenerationJob['status'] = job.cancelled
      ? 'cancelled'
      : elapsed < this.stepMs
        ? 'queued'
        : elapsed < this.stepMs * 2
          ? 'running'
          : job.outcome;
    assertTransition(job.lastStatus, status);
    job.lastStatus = status;

    return {
      providerJobId: job.id,
      status,
      outputs:
        status === 'succeeded'
          ? [
              {
                kind: job.kind,
                url: `https://mock.invalid/${job.id}.${job.kind === 'image' ? 'png' : 'mp4'}`,
                contentType: job.kind === 'image' ? 'image/png' : 'video/mp4',
              },
            ]
          : [],
      error: status === 'failed' ? 'Mock üretim başarısız oldu.' : null,
      credits: status === 'succeeded' ? (job.kind === 'image' ? 1 : 5) : 0,
    };
  }
}
