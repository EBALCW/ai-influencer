import { assertEquals, assertRejects } from '@std/assert';
import { higgsfieldFromEnv, HiggsfieldProvider } from './higgsfield.ts';
import { ProviderError, type SubmitJob } from './provider.ts';

type Call = { url: string; method: string; headers: Headers; body: unknown };

function fakeApi(responses: Array<Response | Error>) {
  const calls: Call[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const next = responses.shift()!;
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

Deno.test('submit: auth başlığı, Idempotency-Key ve model yolu', async () => {
  const api = fakeApi([Response.json({ request_id: 'r1', status: 'queued' })]);
  const out = await provider(api.fetchImpl).submit(job({ seed: 3 }));
  assertEquals(out, { providerJobId: 'r1' });
  const call = api.calls[0];
  assertEquals(
    call.url,
    'https://api.higgsfield.ai/higgsfield-ai/soul/v2/standard',
  );
  assertEquals(call.method, 'POST');
  assertEquals(call.headers.get('authorization'), 'Key kid:ksec');
  assertEquals(call.headers.get('idempotency-key'), 'gen-1');
  assertEquals(call.body, { prompt: 'portre', seed: 3 });
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
    'https://api.higgsfield.ai/higgsfield/genjutsu/motion-transfer/v1.0',
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

Deno.test('HTTP hataları tipli hataya çevrilir', async () => {
  for (const [status, code, retryable] of [
    [401, 'auth_failed', false],
    [403, 'insufficient_credits', false],
    [400, 'rejected', true],
    [422, 'invalid_request', false],
    [503, 'unavailable', true],
  ] as const) {
    const api = fakeApi([Response.json({ detail: 'x' }, { status })]);
    const error = await assertRejects(
      () => provider(api.fetchImpl).submit(job()),
      ProviderError,
    );
    assertEquals([error.code, error.retryable], [code, retryable]);
  }
  const net = fakeApi([new TypeError('network')]);
  const error = await assertRejects(
    () => provider(net.fetchImpl).submit(job()),
    ProviderError,
  );
  assertEquals(error.code, 'unavailable');
});

Deno.test('poll: durum eşlemesi ve çıktı', async () => {
  const api = fakeApi([
    Response.json({ request_id: 'r1', status: 'in_progress' }),
    Response.json({
      request_id: 'r1',
      status: 'completed',
      images: [{ url: 'https://cdn/x.png' }],
    }),
    Response.json({ request_id: 'r1', status: 'nsfw' }),
    Response.json({ request_id: 'r1', status: 'canceled' }),
  ]);
  const p = provider(api.fetchImpl);
  assertEquals((await p.poll('r1')).status, 'running');
  const done = await p.poll('r1');
  assertEquals(
    [done.status, done.resultUrl, done.progress, done.credits],
    ['succeeded', 'https://cdn/x.png', 100, null],
  );
  const nsfw = await p.poll('r1');
  assertEquals(
    [nsfw.status, nsfw.error],
    ['failed', 'İçerik moderasyonu tarafından reddedildi.'],
  );
  assertEquals((await p.poll('r1')).status, 'cancelled');
  assertEquals(
    api.calls[0].url,
    'https://api.higgsfield.ai/requests/r1/status',
  );
});

Deno.test('cancel: başlamış iş 400 → not_cancelable', async () => {
  const api = fakeApi([
    new Response(null, { status: 202 }),
    new Response(null, { status: 400 }),
  ]);
  const p = provider(api.fetchImpl);
  await p.cancel('r1');
  assertEquals(
    api.calls[0].url,
    'https://api.higgsfield.ai/requests/r1/cancel',
  );
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
