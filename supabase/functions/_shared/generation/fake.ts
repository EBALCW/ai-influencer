// Testler için deterministik sağlayıcı. Ağ çağrısı yapmaz; senaryo kuyruğu ile davranır.

import {
  type GenerationProvider,
  type PollResult,
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

  constructor(id = 'fake') {
    this.id = id;
  }

  submit(job: SubmitJob): Promise<{ providerJobId: string }> {
    this.submitted.push(job);
    const error = this.submitErrors.shift();
    if (error) return Promise.reject(new ProviderError(error));
    return Promise.resolve({ providerJobId: `job-${job.id}` });
  }

  poll(providerJobId: string): Promise<PollResult> {
    const queue = this.polls.get(providerJobId) ?? [{ status: 'running' }];
    const next = queue.length > 1 ? queue.shift()! : queue[0];
    if (typeof next === 'string') return Promise.reject(new ProviderError(next));
    return Promise.resolve({
      status: 'running',
      progress: null,
      resultUrl: null,
      contentType: null,
      credits: null,
      error: null,
      ...next,
    });
  }

  cancel(providerJobId: string): Promise<void> {
    if (this.cancelError) return Promise.reject(new ProviderError(this.cancelError));
    this.cancelled.push(providerJobId);
    return Promise.resolve();
  }
}
