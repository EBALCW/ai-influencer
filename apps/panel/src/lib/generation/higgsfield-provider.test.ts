import { describe, expect, it } from 'vitest';
import { HiggsfieldProvider } from './higgsfield-provider';
import { createFakeHiggsfieldFetch } from './test-utils';

const models = {
  image: 'higgsfield-ai/soul/v2/standard',
  videoToVideo: 'higgsfield/genjutsu/motion-transfer/v1.0',
};

function make(
  fetchImpl: typeof fetch,
  extra: Partial<{ timeoutMs: number }> = {},
) {
  return new HiggsfieldProvider({
    keyId: 'kid',
    keySecret: 'ksecret',
    models,
    fetch: fetchImpl,
    ...extra,
  });
}

const respond = (status: number, body?: unknown) =>
  (async () =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
    })) as typeof fetch;

describe('HiggsfieldProvider istek biçimi', () => {
  it('belgelenmiş auth başlığı, model yolu, idempotency ve webhook ile gönderir', async () => {
    const fake = createFakeHiggsfieldFetch();
    await make(fake.fetch).generateImage(
      { prompt: 'portre', modelParams: { aspect_ratio: '9:16' } },
      { idempotencyKey: 'gen-1', webhookUrl: 'https://panel.example/hook?x=1' },
    );
    const call = fake.calls[0]!;
    expect(call.method).toBe('POST');
    const url = new URL(call.url);
    expect(url.origin + url.pathname).toBe(
      'https://api.higgsfield.ai/higgsfield-ai/soul/v2/standard',
    );
    expect(url.searchParams.get('hf_webhook')).toBe(
      'https://panel.example/hook?x=1',
    );
    expect(call.headers.get('Authorization')).toBe('Key kid:ksecret');
    expect(call.headers.get('Idempotency-Key')).toBe('gen-1');
    expect(call.body).toEqual({ prompt: 'portre', aspect_ratio: '9:16' });
  });

  it('motion transfer alanlarını belgelenmiş adlarla gönderir', async () => {
    const fake = createFakeHiggsfieldFetch();
    await make(fake.fetch).videoToVideo({
      videoUrl: 'https://cdn.example/v.mp4',
      imageUrls: ['https://cdn.example/a.png'],
      resolution: '1080p',
    });
    expect(fake.calls[0]!.body).toEqual({
      video_url: 'https://cdn.example/v.mp4',
      image_urls: ['https://cdn.example/a.png'],
      prompt: '',
      resolution: '1080p',
    });
  });

  it('doğrulanmamış alanları sessizce düşürmek yerine reddeder', async () => {
    const fake = createFakeHiggsfieldFetch();
    await expect(
      make(fake.fetch).generateImage({ prompt: 'x', seed: 3 }),
    ).rejects.toMatchObject({ code: 'invalid_request' });
    expect(fake.calls).toHaveLength(0);
  });

  it('image-to-video model alanları doğrulanana kadar kapalı', async () => {
    const fake = createFakeHiggsfieldFetch();
    await expect(
      make(fake.fetch).imageToVideo({
        imageUrl: 'https://cdn.example/a.png',
        durationSeconds: 5,
      }),
    ).rejects.toMatchObject({ code: 'not_configured' });
    expect(fake.calls).toHaveLength(0);
  });

  it('model tanımlı değilse not_configured', async () => {
    const provider = new HiggsfieldProvider({
      keyId: 'a',
      keySecret: 'b',
      models: {},
      fetch: createFakeHiggsfieldFetch().fetch,
    });
    await expect(provider.generateImage({ prompt: 'x' })).rejects.toMatchObject(
      {
        code: 'not_configured',
      },
    );
  });
});

describe('HiggsfieldProvider durum eşleme', () => {
  it.each([
    ['failed', 'Sağlayıcı üretimi tamamlayamadı.'],
    ['nsfw', 'İçerik moderasyonu tarafından reddedildi.'],
  ] as const)(
    '%s → failed ve kullanıcı mesajı',
    async (finalStatus, message) => {
      const fake = createFakeHiggsfieldFetch({ finalStatus });
      const provider = make(fake.fetch);
      const job = await provider.generateImage({ prompt: 'x' });
      await provider.getStatus(job.providerJobId); // in_progress
      const final = await provider.getStatus(job.providerJobId);
      expect(final).toMatchObject({
        status: 'failed',
        error: message,
        outputs: [],
      });
    },
  );
});

describe('HiggsfieldProvider hata eşleme', () => {
  it.each([
    [400, 'rejected'],
    [401, 'auth_failed'],
    [403, 'insufficient_credits'],
    [404, 'not_found'],
    [422, 'invalid_request'],
    [423, 'unavailable'],
    [500, 'unavailable'],
    [503, 'unavailable'],
  ])('HTTP %i → %s', async (status, code) => {
    const provider = make(respond(status, { detail: 'gizli ayrıntı sk-test' }));
    const error = await provider
      .generateImage({ prompt: 'x' })
      .catch((e: unknown) => e);
    expect(error).toMatchObject({ code });
    // Sağlayıcı mesajı kullanıcıya/loga taşınmaz
    expect(String((error as Error).message)).not.toContain('sk-test');
  });

  it('beklenmeyen yanıt gövdesi unavailable olur', async () => {
    const provider = make(respond(200, { foo: 'bar' }));
    await expect(provider.generateImage({ prompt: 'x' })).rejects.toMatchObject(
      {
        code: 'unavailable',
      },
    );
  });

  it('zaman aşımı timeout olur', async () => {
    const hanging: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(init.signal!.reason),
        );
      });
    const provider = make(hanging, { timeoutMs: 20 });
    await expect(provider.generateImage({ prompt: 'x' })).rejects.toMatchObject(
      {
        code: 'timeout',
      },
    );
  });

  it('ağ hatası unavailable olur', async () => {
    const broken: typeof fetch = async () => {
      throw new TypeError('fetch failed');
    };
    await expect(make(broken).getStatus('abc')).rejects.toMatchObject({
      code: 'unavailable',
    });
  });
});
