import { afterEach, describe, expect, it, vi } from 'vitest';
import { Constants } from '@ai-influencer/shared';
import { checkBudget } from './budget';
import { MockProvider } from './mock-provider';
import { assertTransition, canTransition, isTerminal } from './status';
import { generationStatusSchema } from './types';

vi.mock('server-only', () => ({}));
const { getGenerationProvider } = await import('./index');

describe('durum geçişleri', () => {
  it('Zod şeması DB enum değerleriyle birebir aynı', () => {
    expect(generationStatusSchema.options).toEqual(
      Constants.public.Enums.generation_status,
    );
  });

  it('terminal durumlar', () => {
    expect(isTerminal('queued')).toBe(false);
    expect(isTerminal('running')).toBe(false);
    expect(isTerminal('succeeded')).toBe(true);
    expect(isTerminal('failed')).toBe(true);
    expect(isTerminal('cancelled')).toBe(true);
  });

  it('ileri geçişler geçerli, geri ve terminalden çıkış geçersiz', () => {
    expect(canTransition('queued', 'running')).toBe(true);
    expect(canTransition('running', 'succeeded')).toBe(true);
    expect(canTransition('running', 'running')).toBe(true);
    expect(canTransition('running', 'queued')).toBe(false);
    expect(canTransition('succeeded', 'running')).toBe(false);
    expect(canTransition('failed', 'succeeded')).toBe(false);
    expect(canTransition('cancelled', 'queued')).toBe(false);
    expect(() => assertTransition('succeeded', 'failed')).toThrow(/Geçersiz/);
  });
});

describe('checkBudget', () => {
  it('limit yoksa izin verir', () => {
    expect(checkBudget({ spent: 1000, limit: null, cost: 50 })).toEqual({
      allowed: true,
      remaining: null,
    });
  });

  it('limite tam eşit olmak serbest, aşmak değil', () => {
    expect(checkBudget({ spent: 90, limit: 100, cost: 10 })).toEqual({
      allowed: true,
      remaining: 0,
    });
    expect(checkBudget({ spent: 90, limit: 100, cost: 10.0001 })).toEqual({
      allowed: false,
      remaining: 10,
      reason: 'limit_exceeded',
    });
  });

  it('ondalık toplama hatası yanlış red üretmez', () => {
    // 0.1 + 0.2 = 0.30000000000000004
    expect(checkBudget({ spent: 0.1, limit: 0.3, cost: 0.2 }).allowed).toBe(
      true,
    );
  });

  it('limit zaten aşılmışsa kalan 0', () => {
    expect(checkBudget({ spent: 120, limit: 100, cost: 0 })).toEqual({
      allowed: false,
      remaining: 0,
      reason: 'limit_exceeded',
    });
  });

  it.each([
    { spent: -1, limit: 10, cost: 1 },
    { spent: 1, limit: 10, cost: Number.NaN },
    { spent: 1, limit: -5, cost: 1 },
    { spent: Number.POSITIVE_INFINITY, limit: 10, cost: 1 },
  ])('geçersiz değerleri reddeder: %o', (input) => {
    expect(() => checkBudget(input)).toThrow(RangeError);
  });
});

describe('MockProvider', () => {
  it('[mock:fail] prompt ile başarısızlık senaryosu', async () => {
    let now = 0;
    const provider = new MockProvider({ stepMs: 10, now: () => now });
    const job = await provider.generateImage({ prompt: 'deneme [mock:fail]' });
    now = 25;
    const final = await provider.getStatus(job.providerJobId);
    expect(final).toMatchObject({ status: 'failed', outputs: [], credits: 0 });
    expect(final.error).toBeTruthy();
  });

  it('aynı idempotency anahtarı aynı işi döner', async () => {
    const provider = new MockProvider();
    const a = await provider.generateImage(
      { prompt: 'x' },
      { idempotencyKey: 'k' },
    );
    const b = await provider.generateImage(
      { prompt: 'y' },
      { idempotencyKey: 'k' },
    );
    const c = await provider.generateImage({ prompt: 'x' });
    expect(b.providerJobId).toBe(a.providerJobId);
    expect(c.providerJobId).not.toBe(a.providerJobId);
  });

  it('deterministik kimlik ve çıktı', async () => {
    let now = 0;
    const provider = new MockProvider({ stepMs: 10, now: () => now });
    const job = await provider.generateImage({ prompt: 'x' });
    expect(job.providerJobId).toBe('mock-000001');
    now = 20;
    const done = await provider.getStatus(job.providerJobId);
    expect(done.outputs[0]).toEqual({
      kind: 'image',
      url: 'https://mock.invalid/mock-000001.png',
      contentType: 'image/png',
    });
    expect(done.credits).toBe(1);
  });
});

describe('getGenerationProvider', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('varsayılan mock', () => {
    expect(getGenerationProvider({}).id).toBe('mock');
  });

  it('higgsfield anahtarsız not_configured', () => {
    expect(() =>
      getGenerationProvider({ GENERATION_PROVIDER: 'higgsfield' }),
    ).toThrow(expect.objectContaining({ code: 'not_configured' }));
  });

  it('higgsfield anahtarlarla seçilir', () => {
    const provider = getGenerationProvider({
      GENERATION_PROVIDER: 'higgsfield',
      HIGGSFIELD_API_KEY_ID: 'id',
      HIGGSFIELD_API_KEY_SECRET: 'secret',
    });
    expect(provider.id).toBe('higgsfield');
  });

  it('bilinmeyen sağlayıcı not_configured', () => {
    expect(() =>
      getGenerationProvider({ GENERATION_PROVIDER: 'bilinmeyen' }),
    ).toThrow(expect.objectContaining({ code: 'not_configured' }));
  });
});
