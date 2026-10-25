import { assert, assertEquals, assertRejects } from '@std/assert';
import {
  contentTypeFromUrl,
  higgsfieldFromEnv,
  HiggsfieldProvider,
  parseRetryAfter,
} from './higgsfield.ts';
import { ProviderError, type SubmitJob } from './provider.ts';

type Call = {
  url: string;
  method: string;
  headers: Headers;
  body: unknown;
};

/** Sahte fetch: yanıtlar sırayla döner. Gerçek ağ çağrısı yok. */
function fakeApi(responses: Array<Response | Error>) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    const raw = init?.body;
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body:
        typeof raw === 'string'
          ? JSON.parse(raw)
          : raw instanceof Uint8Array
            ? [...raw]
            : undefined,
    });
    const next = responses.shift();
    if (!next) return Promise.reject(new Error('beklenmeyen çağrı'));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };
  return { calls, fetchImpl };
}

const job = (extra: Partial<SubmitJob> = {}): SubmitJob => ({
  id: 'gen-1',
  mode: 'text_to_image',
  prompt: 'portre',
  negative: null,
  seed: null,
  resolution: '480p',
  imageResolution: '2K',
  aspectRatio: null,
  durationSeconds: null,
  imageUrls: [],
  videoUrl: null,
  modelParams: {},
  ...extra,
});

const provider = (fetchImpl: typeof fetch, models = {}) =>
  new HiggsfieldProvider({
    keyId: 'kid',
    keySecret: 'ksec',
    fetch: fetchImpl,
    models,
  });

const API = 'https://api.higgsfield.ai';

Deno.test('submit: auth başlığı, Idempotency-Key ve Soul gövdesi', async () => {
  const api = fakeApi([Response.json({ request_id: 'r1', status: 'queued' })]);
  const out = await provider(api.fetchImpl).submit(
    job({
      seed: 3,
      negative: 'bulanık',
      aspectRatio: '9:16',
      imageResolution: '4K',
    }),
  );
  assertEquals(out, { providerJobId: 'r1' });
  const call = api.calls[0];
  assertEquals(call.url, `${API}/higgsfield-ai/soul/standard`);
  assertEquals(call.method, 'POST');
  assertEquals(call.headers.get('authorization'), 'Key kid:ksec');
  assertEquals(call.headers.get('idempotency-key'), 'gen-1');
  // Soul şemasında seed/negative_prompt yok; tek görsel saklandığı için num_images 1.
  assertEquals(call.body, {
    prompt: 'portre',
    num_images: 1,
    resolution: '4K',
    aspect_ratio: '9:16',
  });
});

Deno.test('Soul: şema dışı oran/çözünürlük gönderilmez', async () => {
  const api = fakeApi([Response.json({ request_id: 'r1', status: 'queued' })]);
  await provider(api.fetchImpl).submit(
    job({ aspectRatio: '7:3', imageResolution: '8K' }),
  );
  assertEquals(api.calls[0].body, {
    prompt: 'portre',
    num_images: 1,
    resolution: '2K',
  });
});

Deno.test('Soul dışı görsel modeli: sadece prompt + model_params', async () => {
  const api = fakeApi([Response.json({ request_id: 'r1', status: 'queued' })]);
  await provider(api.fetchImpl, { image: 'other/model' }).submit(
    job({ seed: 1, aspectRatio: '1:1', modelParams: { style: 'x' } }),
  );
  assertEquals(api.calls[0].url, `${API}/other/model`);
  assertEquals(api.calls[0].body, { style: 'x', prompt: 'portre' });
});

Deno.test('submit video_to_video: motion transfer alanları', async () => {
  const api = fakeApi([Response.json({ request_id: 'r2', status: 'queued' })]);
  await provider(api.fetchImpl).submit(
    job({
      mode: 'video_to_video',
      videoUrl: 'https://v',
      imageUrls: ['https://i'],
      resolution: '720p',
    }),
  );
  assertEquals(
    api.calls[0].url,
    `${API}/higgsfield/genjutsu/motion-transfer/v1.0`,
  );
  assertEquals(api.calls[0].body, {
    video_url: 'https://v',
    image_urls: ['https://i'],
    prompt: 'portre',
    resolution: '720p',
  });
});

Deno.test(
  'image_to_video modeli yoksa not_configured, ağ çağrısı yok',
  async () => {
    const api = fakeApi([]);
    const error = await assertRejects(
      () =>
        provider(api.fetchImpl).submit(
          job({ mode: 'image_to_video', imageUrls: ['https://i'] }),
        ),
      ProviderError,
    );
    assertEquals(error.code, 'not_configured');
    assertEquals(api.calls.length, 0);
  },
);

Deno.test(
  'image_to_video Kling: resolution yok, süre 5|10, negative_prompt',
  async () => {
    const api = fakeApi([
      Response.json({ request_id: 'r3', status: 'queued' }),
      Response.json({ request_id: 'r4', status: 'queued' }),
    ]);
    const p = provider(api.fetchImpl, {
      imageToVideo: 'kling-video/v2.5-turbo/pro/image-to-video',
    });
    await p.submit(
      job({
        mode: 'image_to_video',
        imageUrls: ['https://i'],
        resolution: '720p',
        durationSeconds: 3,
        negative: 'bulanık',
      }),
    );
    await p.submit(
      job({
        mode: 'image_to_video',
        imageUrls: ['https://i'],
        durationSeconds: 8,
      }),
    );
    assertEquals(
      api.calls[0].url,
      `${API}/kling-video/v2.5-turbo/pro/image-to-video`,
    );
    assertEquals(api.calls[0].body, {
      prompt: 'portre',
      image_url: 'https://i',
      duration: 5,
      negative_prompt: 'bulanık',
    });
    assertEquals((api.calls[1].body as { duration: number }).duration, 10);
  },
);

Deno.test('image_to_video Hailuo: süre 6|10, resolution yok', async () => {
  const api = fakeApi([
    Response.json({ request_id: 'r5', status: 'queued' }),
    Response.json({ request_id: 'r6', status: 'queued' }),
  ]);
  const p = provider(api.fetchImpl, {
    imageToVideo: 'minimax/hailuo-2.3/standard/image-to-video',
  });
  await p.submit(
    job({ mode: 'image_to_video', imageUrls: ['https://i'], negative: 'x' }),
  );
  await p.submit(
    job({
      mode: 'image_to_video',
      imageUrls: ['https://i'],
      durationSeconds: 7,
    }),
  );
  assertEquals(api.calls[0].body, {
    prompt: 'portre',
    image_url: 'https://i',
    duration: 6,
  });
  assertEquals((api.calls[1].body as { duration: number }).duration, 10);
});

Deno.test('HTTP hataları tipli hataya çevrilir', async () => {
  for (const [status, code, retryable] of [
    [400, 'invalid_request', false],
    [401, 'auth_failed', false],
    [403, 'insufficient_credits', false],
    [404, 'not_found', false],
    [422, 'invalid_request', false],
    [423, 'unavailable', true],
    [429, 'rate_limited', true],
    [500, 'unavailable', true],
    [503, 'unavailable', true],
  ] as const) {
    const api = fakeApi([Response.json({ detail: 'x' }, { status })]);
    const error = await assertRejects(
      () => provider(api.fetchImpl).submit(job()),
      ProviderError,
    );
    assertEquals(
      [status, error.code, error.retryable],
      [status, code, retryable],
    );
  }
  const net = fakeApi([new TypeError('network')]);
  const error = await assertRejects(
    () => provider(net.fetchImpl).submit(job()),
    ProviderError,
  );
  assertEquals(error.code, 'unavailable');
});

Deno.test(
  '429 account_queue_full: Retry-After ve X-Correlation-ID taşınır',
  async () => {
    const api = fakeApi([
      Response.json(
        {
          detail: {
            code: 'account_queue_full',
            retryable: true,
            retry_after_seconds: 30,
          },
        },
        {
          status: 429,
          headers: { 'retry-after': '30', 'x-correlation-id': 'abc-123' },
        },
      ),
    ]);
    const error = await assertRejects(
      () => provider(api.fetchImpl).submit(job()),
      ProviderError,
    );
    assertEquals(error.code, 'rate_limited');
    assertEquals(error.retryAfterSeconds, 30);
    assertEquals(error.correlationId, 'abc-123');
    assert(error.message.includes('destek kimliği: abc-123'));
    assert(!error.message.includes('account_queue_full'), 'gövde taşınmaz');
  },
);

Deno.test('503 admission_control_unavailable geçicidir', async () => {
  const api = fakeApi([
    Response.json(
      { detail: { code: 'admission_control_unavailable', retryable: true } },
      { status: 503, headers: { 'x-correlation-id': 'c-503' } },
    ),
  ]);
  const error = await assertRejects(
    () => provider(api.fetchImpl).submit(job()),
    ProviderError,
  );
  assertEquals([error.code, error.retryable], ['unavailable', true]);
  assertEquals(error.retryAfterSeconds, null);
  assertEquals(error.correlationId, 'c-503');
});

Deno.test('X-Correlation-ID güvenli değilse mesaja yazılmaz', async () => {
  const api = fakeApi([
    Response.json(
      { detail: 'x' },
      { status: 400, headers: { 'x-correlation-id': 'a b<script>' } },
    ),
  ]);
  const error = await assertRejects(
    () => provider(api.fetchImpl).submit(job()),
    ProviderError,
  );
  assertEquals(error.correlationId, null);
  assert(!error.message.includes('script'));
});

Deno.test('parseRetryAfter: saniye, HTTP tarihi, sınırlar', () => {
  const now = Date.parse('2026-10-24T10:00:00Z');
  assertEquals(parseRetryAfter('30', now), 30);
  assertEquals(parseRetryAfter('0', now), 1);
  assertEquals(parseRetryAfter('99999', now), 3600);
  assertEquals(parseRetryAfter('Sat, 24 Oct 2026 10:01:00 GMT', now), 60);
  assertEquals(parseRetryAfter('yakında', now), null);
  assertEquals(parseRetryAfter(null, now), null);
});

Deno.test(
  'estimate: aynı gövdeyle /estimate/<model>, usd sayıya çevrilir',
  async () => {
    const api = fakeApi([
      Response.json({ usd: '0.094' }),
      Response.json({ usd: 'yok' }),
      Response.json({ detail: 'x' }, { status: 400 }),
    ]);
    const p = provider(api.fetchImpl);
    assertEquals(await p.estimate(job({ aspectRatio: '1:1' })), 0.094);
    assertEquals(
      api.calls[0].url,
      `${API}/estimate/higgsfield-ai/soul/standard`,
    );
    assertEquals(api.calls[0].method, 'POST');
    assertEquals(api.calls[0].body, {
      prompt: 'portre',
      num_images: 1,
      resolution: '2K',
      aspect_ratio: '1:1',
    });
    assertEquals(
      api.calls[0].headers.get('idempotency-key'),
      null,
      'estimate gönderim değil',
    );
    assertEquals(await p.estimate(job()), null, 'geçersiz tutar → null');
    const error = await assertRejects(() => p.estimate(job()), ProviderError);
    assertEquals(error.code, 'invalid_request');
  },
);

Deno.test('poll: durum eşlemesi, çıktı ve expires_at', async () => {
  const api = fakeApi([
    Response.json({ request_id: 'r1', status: 'in_progress' }),
    Response.json({
      request_id: 'r1',
      status: 'completed',
      expires_at: '2026-10-31T12:05:12.481Z',
      images: [{ url: 'https://cdn/x.jpg' }],
    }),
    Response.json({ request_id: 'r1', status: 'nsfw' }),
    Response.json({ request_id: 'r1', status: 'canceled' }),
  ]);
  const p = provider(api.fetchImpl);
  const running = await p.poll('r1');
  assertEquals([running.status, running.expiresAt], ['running', null]);
  const done = await p.poll('r1');
  assertEquals(
    [
      done.status,
      done.resultUrl,
      done.contentType,
      done.progress,
      done.credits,
      done.expiresAt,
    ],
    [
      'succeeded',
      'https://cdn/x.jpg',
      'image/jpeg',
      100,
      null,
      '2026-10-31T12:05:12.481Z',
    ],
  );
  const nsfw = await p.poll('r1');
  assertEquals(
    [nsfw.status, nsfw.error],
    ['failed', 'İçerik moderasyonu tarafından reddedildi.'],
  );
  assertEquals((await p.poll('r1')).status, 'cancelled');
  assertEquals(api.calls[0].url, `${API}/requests/r1/status`);
});

Deno.test(
  'poll: video önce, sonra görsel, sonra ses (audio/audios)',
  async () => {
    const api = fakeApi([
      Response.json({
        request_id: 'r1',
        status: 'completed',
        video: { url: 'https://cdn/v.mp4' },
        images: [{ url: 'https://cdn/thumb.png' }],
      }),
      Response.json({
        request_id: 'r1',
        status: 'completed',
        audio: { url: 'https://cdn/a.mp3' },
        audios: [{ url: 'https://cdn/a.mp3' }],
      }),
      Response.json({
        request_id: 'r1',
        status: 'completed',
        audios: [{ url: 'https://cdn/sound' }],
      }),
      Response.json({ request_id: 'r1', status: 'completed' }),
    ]);
    const p = provider(api.fetchImpl);
    const video = await p.poll('r1');
    assertEquals(
      [video.resultUrl, video.contentType],
      ['https://cdn/v.mp4', 'video/mp4'],
    );
    const audio = await p.poll('r1');
    assertEquals(
      [audio.resultUrl, audio.contentType],
      ['https://cdn/a.mp3', 'audio/mpeg'],
    );
    const audios = await p.poll('r1');
    assertEquals(audios.contentType, 'audio/mpeg', 'uzantısız ses');
    const error = await assertRejects(() => p.poll('r1'), ProviderError);
    assertEquals(error.code, 'unavailable');
  },
);

Deno.test('contentTypeFromUrl: uzantıdan tür, sorgu dizesi yok sayılır', () => {
  assertEquals(contentTypeFromUrl('https://cdn/a/b.PNG?sig=1'), 'image/png');
  assertEquals(contentTypeFromUrl('https://cdn/x.webm'), 'video/webm');
  assertEquals(contentTypeFromUrl('https://cdn/x'), null);
  assertEquals(contentTypeFromUrl('bozuk'), null);
});

Deno.test(
  'prepareInputs: generate-upload-url → PUT (anahtarsız) → public_url',
  async () => {
    const api = fakeApi([
      Response.json({
        public_url: 'https://cdn.hf/input/1.png',
        upload_url: 'https://storage.hf/presigned?sig=x',
        content_type: 'image/png',
        upload_headers: {
          'Content-Type': 'image/png',
          'x-amz-tagging': 'retention=temporary',
        },
      }),
      new Response(new Uint8Array([7, 8, 9])),
      new Response(null, { status: 200 }),
    ]);
    const out = await provider(api.fetchImpl).prepareInputs({
      images: [
        { url: 'https://supabase/signed/a.png?token=t', mimeType: 'image/png' },
      ],
      video: null,
    });
    assertEquals(out, {
      imageUrls: ['https://cdn.hf/input/1.png'],
      videoUrl: null,
    });
    const [create, source, put] = api.calls;
    assertEquals(create.url, `${API}/files/generate-upload-url`);
    assertEquals(create.body, { content_type: 'image/png' });
    assertEquals(create.headers.get('authorization'), 'Key kid:ksec');
    assertEquals(source.url, 'https://supabase/signed/a.png?token=t');
    assertEquals(source.headers.get('authorization'), null);
    assertEquals(put.url, 'https://storage.hf/presigned?sig=x');
    assertEquals(put.method, 'PUT');
    assertEquals(put.headers.get('authorization'), null, 'anahtar gönderilmez');
    assertEquals(put.headers.get('x-amz-tagging'), 'retention=temporary');
    assertEquals(put.headers.get('content-type'), 'image/png');
    assertEquals(put.body, [7, 8, 9]);
  },
);

Deno.test('prepareInputs: video ve image/jpg normalize edilir', async () => {
  const upload = (n: number, type: string) =>
    Response.json({
      public_url: `https://cdn.hf/${n}`,
      upload_url: `https://storage.hf/${n}`,
      upload_headers: { 'Content-Type': type },
    });
  const api = fakeApi([
    upload(1, 'image/jpeg'),
    new Response(new Uint8Array([1])),
    new Response(null),
    upload(2, 'video/mp4'),
    new Response(new Uint8Array([2])),
    new Response(null),
  ]);
  const out = await provider(api.fetchImpl).prepareInputs({
    images: [{ url: 'https://s/1', mimeType: 'image/jpg' }],
    video: { url: 'https://s/2', mimeType: 'video/mp4' },
  });
  assertEquals(out, {
    imageUrls: ['https://cdn.hf/1'],
    videoUrl: 'https://cdn.hf/2',
  });
  assertEquals(api.calls[0].body, { content_type: 'image/jpeg' });
  assertEquals(api.calls[3].body, { content_type: 'video/mp4' });
});

Deno.test(
  'prepareInputs: desteklenmeyen tür kalıcı, yükleme hatası geçici',
  async () => {
    const none = fakeApi([]);
    const bad = await assertRejects(
      () =>
        provider(none.fetchImpl).prepareInputs({
          images: [{ url: 'https://s/1', mimeType: 'image/avif' }],
          video: null,
        }),
      ProviderError,
    );
    assertEquals([bad.code, bad.retryable], ['invalid_request', false]);
    assert(bad.message.includes('image/avif'));
    assertEquals(none.calls.length, 0);

    const api = fakeApi([
      Response.json({
        public_url: 'https://cdn.hf/1',
        upload_url: 'https://storage.hf/1',
      }),
      new Response(new Uint8Array([1])),
      new Response('denied', { status: 403 }),
    ]);
    const put = await assertRejects(
      () =>
        provider(api.fetchImpl).prepareInputs({
          images: [{ url: 'https://s/1', mimeType: 'image/png' }],
          video: null,
        }),
      ProviderError,
    );
    assertEquals([put.code, put.retryable], ['unavailable', true]);

    const quota = fakeApi([
      Response.json(
        { detail: 'x' },
        { status: 429, headers: { 'retry-after': '10' } },
      ),
    ]);
    const limited = await assertRejects(
      () =>
        provider(quota.fetchImpl).prepareInputs({
          images: [{ url: 'https://s/1', mimeType: 'image/png' }],
          video: null,
        }),
      ProviderError,
    );
    assertEquals(
      [limited.code, limited.retryAfterSeconds],
      ['rate_limited', 10],
    );
  },
);

Deno.test('cancel: başlamış iş 400 → not_cancelable', async () => {
  const api = fakeApi([
    new Response(null, { status: 202 }),
    new Response(null, { status: 400 }),
  ]);
  const p = provider(api.fetchImpl);
  await p.cancel('r1');
  assertEquals(api.calls[0].url, `${API}/requests/r1/cancel`);
  const error = await assertRejects(() => p.cancel('r1'), ProviderError);
  assertEquals(error.code, 'not_cancelable');
});

Deno.test('higgsfieldFromEnv: anahtar yoksa null', () => {
  const env = (vars: Record<string, string>) => ({
    get: (k: string) => vars[k],
  });
  assertEquals(higgsfieldFromEnv(env({})), null);
  assertEquals(higgsfieldFromEnv(env({ HIGGSFIELD_API_KEY_ID: 'a' })), null);
  assertEquals(
    higgsfieldFromEnv(
      env({ HIGGSFIELD_API_KEY_ID: 'a', HIGGSFIELD_API_KEY_SECRET: 'b' }),
    )?.id,
    'higgsfield',
  );
});
