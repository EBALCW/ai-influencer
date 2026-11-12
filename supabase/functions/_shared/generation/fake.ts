// Testler için deterministik sağlayıcı. Ağ çağrısı yapmaz; senaryo kuyruğu ile davranır.

import {
  type GenerationProvider,
  type InputMedia,
  type PollResult,
  type PreparedInputs,
  ProviderError,
  type ProviderErrorCode,
  type SubmitJob,
} from './provider.ts';

export class FakeProvider implements GenerationProvider {
  readonly id: string;
  readonly submitted: SubmitJob[] = [];
  readonly cancelled: string[] = [];
  /** Sıradaki submit çağrılarında atılacak hatalar. */
  submitErrors: ProviderErrorCode[] = [];
  /** providerJobId → sıradaki poll sonuçları (son eleman tekrar eder). */
  polls = new Map<string, Array<Partial<PollResult> | ProviderErrorCode>>();
  cancelError: ProviderErrorCode | null = null;
  /** Sıradaki submit hatalarına eklenecek Retry-After (saniye). */
  retryAfterSeconds: number | null = null;
  /** Tanımlıysa estimate() bu tutarı döner (USD); hata kodu verilirse onu atar. */
  estimateUsd: number | ProviderErrorCode | null = null;
  readonly estimated: SubmitJob[] = [];
  /** Tanımlıysa prepareInputs() çağrılır ve URL'leri `uploaded:` önekiyle döner. */
  uploads = false;
  readonly prepared: InputMedia[] = [];

  constructor(id = 'fake') {
    this.id = id;
  }

  get prepareInputs() {
    if (!this.uploads) return undefined;
    return (media: InputMedia): Promise<PreparedInputs> => {
      this.prepared.push(media);
      return Promise.resolve({
        imageUrls: media.images.map((f) => `uploaded:${f.url}`),
        videoUrl: media.video ? `uploaded:${media.video.url}` : null,
      });
    };
  }

  get estimate() {
    if (this.estimateUsd === null) return undefined;
    return (job: SubmitJob): Promise<number | null> => {
      this.estimated.push(job);
      const value = this.estimateUsd;
      if (typeof value === 'string')
        return Promise.reject(new ProviderError(value));
      return Promise.resolve(value);
    };
  }

  submit(job: SubmitJob): Promise<{ providerJobId: string }> {
    this.submitted.push(job);
    const error = this.submitErrors.shift();
    if (error)
      return Promise.reject(
        new ProviderError(error, {
          retryAfterSeconds: this.retryAfterSeconds,
          correlationId: 'corr-1',
        }),
      );
    return Promise.resolve({ providerJobId: `job-${job.id}` });
  }

  poll(providerJobId: string): Promise<PollResult> {
    const queue = this.polls.get(providerJobId) ?? [{ status: 'running' }];
    const next = queue.length > 1 ? queue.shift()! : queue[0];
    if (typeof next === 'string')
      return Promise.reject(new ProviderError(next));
    return Promise.resolve({
      status: 'running',
      progress: null,
      resultUrl: null,
      contentType: null,
      credits: null,
      expiresAt: null,
      error: null,
      ...next,
    });
  }

  cancel(providerJobId: string): Promise<void> {
    if (this.cancelError)
      return Promise.reject(new ProviderError(this.cancelError));
    this.cancelled.push(providerJobId);
    return Promise.resolve();
  }
}
