import { assert, assertEquals, assertRejects } from '@std/assert';
import { FakeProvider } from '../_shared/generation/fake.ts';
import {
  backoffSeconds,
  type JobPatch,
  NOT_CONFIGURED_MESSAGE,
  type QueueJob,
  readLimited,
  type QueueStore,
  runWorker,
  toSubmitJob,
} from './worker.ts';

const INF = '10000000-0000-4000-8000-000000000001';
const T0 = new Date('2026-10-22T10:00:00Z');

type Row = QueueJob & {
  next_run_at: string;
  progress: number;
  error: string | null;
  credits: number | null;
  cost_usd: number | null;
  finished_at: string | null;
  output_path: string | null;
};

/** claim_generations / complete_generation davranışının bellek içi karşılığı. */
class MemoryStore implements QueueStore {
  rows = new Map<string, Row>();
  uploads = new Map<string, { bytes: Uint8Array; contentType: string }>();
  inputReads = 0;
  heartbeats: Array<{
    providers: string[];
    claimed: number;
    message: string | null;
  }> = [];
  constructor(private readonly now: () => Date) {}

  add(id: string, extra: Partial<Row> = {}) {
    this.rows.set(id, {
      id,
      influencer_id: INF,
      tool: 'fake',
      mode: 'text_to_image',
      status: 'queued',
      params: { prompt: 'p' },
      input_asset_ids: [],
      provider_job_id: null,
      attempts: 0,
      max_attempts: 3,
      started_at: null,
      cancel_requested_at: null,
      next_run_at: this.now().toISOString(),
      progress: 0,
      error: null,
      credits: null,
      cost_usd: null,
      estimated_cost_usd: null,
      finished_at: null,
      output_path: null,
      ...extra,
    });
  }
  get(id: string) {
    return this.rows.get(id)!;
  }
  claim(tools: string[], limit: number, lease: number) {
    const due = [...this.rows.values()]
      .filter(
        (r) =>
          ['queued', 'running'].includes(r.status) &&
          tools.includes(r.tool) &&
          new Date(r.next_run_at) <= this.now(),
      )
      .slice(0, limit);
    for (const r of due) {
      r.next_run_at = new Date(
        this.now().getTime() + lease * 1000,
      ).toISOString();
    }
    return Promise.resolve(due.map((r) => ({ ...r })));
  }
  update(id: string, patch: JobPatch) {
    const r = this.get(id);
    if (['queued', 'running'].includes(r.status)) Object.assign(r, patch);
    return Promise.resolve();
  }
  inputMedia(job: QueueJob) {
    this.inputReads++;
    return Promise.resolve({
      images: job.input_asset_ids.map((a) => ({
        url: `https://signed.example/${a}`,
        mimeType: 'image/png',
      })),
      video: null,
    });
  }
  upload(path: string, bytes: Uint8Array, contentType: string) {
    this.uploads.set(path, { bytes, contentType });
    return Promise.resolve();
  }
  complete(
    id: string,
    path: string,
    _mime: string,
    _size: number,
    credits: number | null,
    costUsd: number | null,
  ) {
    const r = this.get(id);
    if (['queued', 'running'].includes(r.status)) {
      Object.assign(r, {
        status: 'succeeded',
        output_path: path,
        progress: 100,
      });
      if (credits !== null) r.credits = credits;
      if (costUsd !== null) r.cost_usd = costUsd;
    }
    return Promise.resolve();
  }
  heartbeat(state: {
    providers: string[];
    claimed: number;
    message: string | null;
  }) {
    this.heartbeats.push(state);
    return Promise.resolve();
  }
}

function setup() {
  let now = T0;
  const clock = () => now;
  const store = new MemoryStore(clock);
  const provider = new FakeProvider();
  const fetched: string[] = [];
  const fakeFetch: typeof fetch = (input) => {
    fetched.push(String(input));
    return Promise.resolve(
      new Response(new Uint8Array([1, 2, 3, 4]), {
        headers: { 'content-type': 'image/png' },
      }),
    );
  };
  const run = () =>
    runWorker({ store, providers: [provider], fetch: fakeFetch, now: clock });
  const advance = (seconds: number) => {
    now = new Date(now.getTime() + seconds * 1000);
  };
  return { store, provider, run, advance, fetched };
}

Deno.test(
  'sağlayıcı yapılandırılmamışsa işler kuyrukta kalır, durum yazılır',
  async () => {
    const store = new MemoryStore(() => T0);
    store.add('g1');
    const result = await runWorker({ store, providers: [], now: () => T0 });
    assertEquals(result, { configured: false, claimed: 0, outcomes: {} });
    assertEquals(store.get('g1').status, 'queued');
    assertEquals(store.heartbeats, [
      { providers: [], claimed: 0, message: NOT_CONFIGURED_MESSAGE },
    ]);
  },
);

Deno.test(
  'claim: sadece yapılandırılmış sağlayıcının ve zamanı gelmiş işler alınır',
  async () => {
    const { store, run } = setup();
    store.add('g1');
    store.add('g2', { tool: 'other' });
    store.add('g3', {
      next_run_at: new Date(T0.getTime() + 60_000).toISOString(),
    });
    const result = await run();
    assertEquals(Object.keys(result.outcomes), ['g1']);
    assertEquals(store.get('g2').status, 'queued');
    assertEquals(store.get('g3').status, 'queued');
  },
);

Deno.test(
  'başarılı akış: queued → running → succeeded, sonuç Storage + asset',
  async () => {
    const { store, provider, run, advance, fetched } = setup();
    store.add('g1', {
      input_asset_ids: ['a1'],
      params: { prompt: 'merhaba', test_mode: true },
    });

    assertEquals((await run()).outcomes.g1, 'submitted');
    const row = store.get('g1');
    assertEquals(row.status, 'running');
    assertEquals(row.provider_job_id, 'job-g1');
    assertEquals(row.attempts, 1);
    assertEquals(provider.submitted[0].id, 'g1');
    assertEquals(provider.submitted[0].resolution, '480p');
    assertEquals(provider.submitted[0].imageUrls, [
      'https://signed.example/a1',
    ]);

    // Aynı tur tekrar çalışırsa yoklama zamanı gelmediği için iş alınmaz
    assertEquals((await run()).claimed, 0);

    provider.polls.set('job-g1', [
      { status: 'running', progress: 40 },
      {
        status: 'succeeded',
        resultUrl: 'https://cdn.example/out.png',
        credits: 2,
      },
    ]);
    advance(15);
    assertEquals((await run()).outcomes.g1, 'running');
    assertEquals(store.get('g1').progress, 40);
    advance(15);
    assertEquals((await run()).outcomes.g1, 'succeeded');

    const done = store.get('g1');
    assertEquals(done.status, 'succeeded');
    assertEquals(done.credits, 2);
    assertEquals(done.output_path, `${INF}/generated-g1.png`);
    assertEquals(fetched, ['https://cdn.example/out.png']);
    assertEquals(
      store.uploads.get(`${INF}/generated-g1.png`)?.contentType,
      'image/png',
    );
  },
);

Deno.test(
  'sağlayıcı failed → failed, hata ve kredi yazılır (maliyet trigger ile)',
  async () => {
    const { store, provider, run, advance } = setup();
    store.add('g1');
    await run();
    provider.polls.set('job-g1', [
      { status: 'failed', error: 'nsfw', credits: 3 },
    ]);
    advance(15);
    assertEquals((await run()).outcomes.g1, 'failed');
    const row = store.get('g1');
    assertEquals(row.status, 'failed');
    assertEquals(row.error, 'nsfw');
    assertEquals(row.credits, 3);
    assert(row.finished_at);
  },
);

Deno.test(
  'geçici gönderim hatası: geri çekilmeyle tekrar, deneme hakkı dolunca failed',
  async () => {
    const { store, provider, run, advance } = setup();
    store.add('g1');
    provider.submitErrors = ['unavailable', 'timeout', 'unavailable'];

    assertEquals((await run()).outcomes.g1, 'retry');
    let row = store.get('g1');
    assertEquals(row.status, 'queued');
    assertEquals(row.attempts, 1);
    assertEquals(
      row.next_run_at,
      new Date(T0.getTime() + 30_000).toISOString(),
    );

    advance(29);
    assertEquals(
      (await run()).claimed,
      0,
      'geri çekilme süresi dolmadan alınmaz',
    );
    advance(1);
    assertEquals((await run()).outcomes.g1, 'retry');
    row = store.get('g1');
    assertEquals(row.attempts, 2);
    assertEquals(
      row.next_run_at,
      new Date(T0.getTime() + 30_000 + 60_000).toISOString(),
    );

    advance(60);
    assertEquals((await run()).outcomes.g1, 'failed');
    row = store.get('g1');
    assertEquals(row.status, 'failed');
    assertEquals(row.attempts, 3);
    assertEquals(provider.submitted.length, 3);
    assertEquals(
      new Set(provider.submitted.map((j) => j.id)).size,
      1,
      'Idempotency: aynı iş kimliği',
    );
  },
);

Deno.test('kalıcı gönderim hatası tekrar denenmez', async () => {
  const { store, provider, run } = setup();
  store.add('g1');
  provider.submitErrors = ['insufficient_credits'];
  assertEquals((await run()).outcomes.g1, 'failed');
  assertEquals(store.get('g1').attempts, 1);
  assertEquals(
    store.get('g1').error,
    'Sağlayıcı hesabında yeterli bakiye yok. (destek kimliği: corr-1)',
  );
});

Deno.test('running iş zaman aşımına uğrar', async () => {
  const { store, run } = setup();
  store.add('g1', {
    status: 'running',
    provider_job_id: 'job-g1',
    attempts: 1,
    started_at: new Date(T0.getTime() - 31 * 60_000).toISOString(),
  });
  assertEquals((await run()).outcomes.g1, 'timeout');
  assertEquals(store.get('g1').status, 'failed');
  assert(store.get('g1').error?.includes('zaman aşımı'));
});

Deno.test(
  'iptal: gönderilmiş iş sağlayıcıda iptal edilir; başlamışsa izlemeye devam',
  async () => {
    const { store, provider, run } = setup();
    store.add('g1', {
      status: 'running',
      provider_job_id: 'job-g1',
      cancel_requested_at: T0.toISOString(),
    });
    assertEquals((await run()).outcomes.g1, 'cancelled');
    assertEquals(store.get('g1').status, 'cancelled');
    assertEquals(provider.cancelled, ['job-g1']);

    store.add('g2', {
      status: 'running',
      provider_job_id: 'job-g2',
      cancel_requested_at: T0.toISOString(),
    });
    provider.cancelError = 'not_cancelable';
    assertEquals((await run()).outcomes.g2, 'cancel_refused');
    assertEquals(store.get('g2').status, 'running');
    assertEquals(store.get('g2').cancel_requested_at, null);
  },
);

Deno.test('indirme hatası işi düşürmez, sonra tekrar denenir', async () => {
  let now = T0;
  const store = new MemoryStore(() => now);
  const provider = new FakeProvider();
  store.add('g1', {
    status: 'running',
    provider_job_id: 'job-g1',
    started_at: T0.toISOString(),
  });
  provider.polls.set('job-g1', [
    { status: 'succeeded', resultUrl: 'https://cdn.example/x.mp4' },
  ]);
  let fail = true;
  const fetchImpl: typeof fetch = () =>
    Promise.resolve(
      fail
        ? new Response('no', { status: 503 })
        : new Response(new Uint8Array([9]), {
            headers: { 'content-type': 'video/mp4' },
          }),
    );
  const run = () =>
    runWorker({
      store,
      providers: [provider],
      fetch: fetchImpl,
      now: () => now,
    });
  assertEquals((await run()).outcomes.g1, 'download_retry');
  assertEquals(store.get('g1').status, 'running');
  fail = false;
  now = new Date(T0.getTime() + 60_000);
  assertEquals((await run()).outcomes.g1, 'succeeded');
  assertEquals(store.get('g1').output_path, `${INF}/generated-g1.mp4`);
});

Deno.test('toSubmitJob: test modu kapalıysa çözünürlük ve süre korunur', () => {
  const base = {
    id: 'g',
    influencer_id: INF,
    tool: 'fake',
    mode: 'image_to_video' as const,
    status: 'queued' as const,
    input_asset_ids: [],
    provider_job_id: null,
    attempts: 0,
    max_attempts: 3,
    started_at: null,
    cancel_requested_at: null,
  };
  const media = { imageUrls: ['https://i'], videoUrl: null };
  const image = toSubmitJob(
    {
      ...base,
      mode: 'text_to_image',
      params: {
        prompt: 'x',
        test_mode: false,
        image_resolution: '4K',
        aspect_ratio: '9:16',
      },
    },
    media,
  );
  assertEquals([image.imageResolution, image.aspectRatio], ['4K', '9:16']);
  const imageTest = toSubmitJob(
    {
      ...base,
      mode: 'text_to_image',
      params: { prompt: 'x', image_resolution: '4K', aspect_ratio: '7:7' },
    },
    media,
  );
  assertEquals(
    [imageTest.imageResolution, imageTest.aspectRatio],
    ['2K', null],
    'test modu 2K zorlar, şemada olmayan oran gönderilmez',
  );
  const off = toSubmitJob(
    {
      ...base,
      params: {
        prompt: 'x',
        test_mode: false,
        resolution: '1080p',
        duration_seconds: 10,
        seed: 7,
      },
    },
    media,
  );
  assertEquals(
    [off.resolution, off.durationSeconds, off.seed],
    ['1080p', 10, 7],
  );
  const on = toSubmitJob(
    {
      ...base,
      params: { prompt: 'x', resolution: '1080p', duration_seconds: 10 },
    },
    media,
  );
  assertEquals([on.resolution, on.durationSeconds], ['480p', 5]);
});

Deno.test('backoffSeconds üstel ve tavanlı', () => {
  assertEquals(
    [1, 2, 3, 10].map((n) => backoffSeconds(n)),
    [30, 60, 120, 900],
  );
});

/** content-length başlığı olmayan, `chunks` parça üreten akış; kaç parça okunduğunu sayar. */
function chunkedBody(chunks: number, size: number) {
  const state = { pulled: 0, cancelled: false };
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (state.pulled >= chunks) return controller.close();
      state.pulled++;
      controller.enqueue(new Uint8Array(size).fill(7));
    },
    cancel() {
      state.cancelled = true;
    },
  });
  return { body, state };
}

Deno.test(
  'content-length olmadan sınırı aşan indirme akış okunurken kesilir',
  async () => {
    const store = new MemoryStore(() => T0);
    const provider = new FakeProvider();
    store.add('g1', {
      status: 'running',
      provider_job_id: 'job-g1',
      started_at: T0.toISOString(),
    });
    provider.polls.set('job-g1', [
      { status: 'succeeded', resultUrl: 'https://cdn.example/big.png' },
    ]);
    const stream = chunkedBody(1000, 1024);
    const fetchImpl: typeof fetch = () =>
      Promise.resolve(
        new Response(stream.body, { headers: { 'content-type': 'image/png' } }),
      );
    const result = await runWorker({
      store,
      providers: [provider],
      fetch: fetchImpl,
      now: () => T0,
      maxFileBytes: 4096,
    });
    assertEquals(result.outcomes.g1, 'failed');
    assertEquals(store.get('g1').error, 'Sonuç dosyası çok büyük.');
    assert(stream.state.cancelled, 'akış iptal edilir');
    assert(stream.state.pulled < 10, 'dosyanın tamamı okunmaz');
    assertEquals(store.uploads.size, 0);
  },
);

Deno.test('readLimited sınır içindeki parçaları birleştirir', async () => {
  const stream = chunkedBody(3, 4);
  const bytes = await readLimited(new Response(stream.body), 12);
  assertEquals(bytes.byteLength, 12);
  assertEquals(bytes[11], 7);
  await assertRejects(
    () => readLimited(new Response(chunkedBody(4, 4).body), 12),
    Error,
    'unsupported',
  );
});

Deno.test(
  '429 kuyruk dolu: Retry-After kadar beklenir, deneme hakkı harcanmaz',
  async () => {
    const { store, provider, run, advance } = setup();
    store.add('g1');
    provider.submitErrors = ['rate_limited', 'rate_limited'];
    provider.retryAfterSeconds = 45;

    assertEquals((await run()).outcomes.g1, 'rate_limited');
    let row = store.get('g1');
    assertEquals(row.status, 'queued');
    assertEquals(row.attempts, 0);
    assertEquals(
      row.next_run_at,
      new Date(T0.getTime() + 45_000).toISOString(),
    );
    assert(row.error?.includes('destek kimliği: corr-1'));

    advance(44);
    assertEquals((await run()).claimed, 0, 'Retry-After dolmadan alınmaz');
    advance(1);
    assertEquals((await run()).outcomes.g1, 'rate_limited');
    advance(45);
    assertEquals((await run()).outcomes.g1, 'submitted');
    row = store.get('g1');
    assertEquals([row.status, row.attempts], ['running', 1]);
    assertEquals(
      new Set(provider.submitted.map((j) => j.id)).size,
      1,
      'aynı Idempotency-Key',
    );
  },
);

Deno.test(
  '429 Retry-After yoksa üstel geri çekilme, 503 Retry-After daha uzunsa o',
  async () => {
    const { store, provider, run } = setup();
    store.add('g1');
    provider.submitErrors = ['rate_limited'];
    assertEquals((await run()).outcomes.g1, 'rate_limited');
    assertEquals(
      store.get('g1').next_run_at,
      new Date(T0.getTime() + 30_000).toISOString(),
    );

    store.add('g2');
    provider.submitErrors = ['unavailable'];
    provider.retryAfterSeconds = 120;
    assertEquals((await run()).outcomes.g2, 'retry');
    assertEquals(store.get('g2').attempts, 1);
    assertEquals(
      store.get('g2').next_run_at,
      new Date(T0.getTime() + 120_000).toISOString(),
    );
  },
);

Deno.test('400 geçersiz parametre kalıcıdır, tekrar denenmez', async () => {
  const { store, provider, run } = setup();
  store.add('g1');
  provider.submitErrors = ['invalid_request'];
  assertEquals((await run()).outcomes.g1, 'failed');
  assertEquals(store.get('g1').status, 'failed');
  assertEquals(provider.submitted.length, 1);
});

Deno.test(
  'estimate: tahmin gönderimde yazılır, başarıda gerçek tutar (USD) olur',
  async () => {
    const { store, provider, run, advance } = setup();
    provider.estimateUsd = 0.094;
    store.add('g1', { params: { prompt: 'p', aspect_ratio: '9:16' } });
    assertEquals((await run()).outcomes.g1, 'submitted');
    assertEquals(store.get('g1').estimated_cost_usd, 0.094);
    assertEquals(provider.estimated[0], provider.submitted[0], 'aynı gövde');

    provider.polls.set('job-g1', [
      { status: 'succeeded', resultUrl: 'https://cdn.example/o.png' },
    ]);
    advance(15);
    assertEquals((await run()).outcomes.g1, 'succeeded');
    assertEquals(store.get('g1').cost_usd, 0.094);
  },
);

Deno.test(
  'estimate: başarısız üretime tutar yazılmaz; estimate 400 → failed, gönderim yok',
  async () => {
    const { store, provider, run, advance } = setup();
    provider.estimateUsd = 0.5;
    store.add('g1');
    await run();
    provider.polls.set('job-g1', [{ status: 'failed', error: 'x' }]);
    advance(15);
    assertEquals((await run()).outcomes.g1, 'failed');
    assertEquals(store.get('g1').cost_usd, null);

    provider.estimateUsd = 'invalid_request';
    store.add('g2');
    advance(1);
    assertEquals((await run()).outcomes.g2, 'failed');
    assertEquals(provider.submitted.length, 1);
  },
);

Deno.test('expires_at geçmişse indirilmeden açık hatayla failed', async () => {
  const { store, provider, run, fetched } = setup();
  store.add('g1', {
    status: 'running',
    provider_job_id: 'job-g1',
    started_at: T0.toISOString(),
  });
  provider.polls.set('job-g1', [
    {
      status: 'succeeded',
      resultUrl: 'https://cdn.example/o.png',
      expiresAt: new Date(T0.getTime() - 1000).toISOString(),
    },
  ]);
  assertEquals((await run()).outcomes.g1, 'expired');
  const row = store.get('g1');
  assertEquals(row.status, 'failed');
  assert(row.error?.includes('expires_at'));
  assertEquals(fetched, []);
});

Deno.test('expires_at gelecekteyse normal indirilir', async () => {
  const { store, provider, run } = setup();
  store.add('g1', {
    status: 'running',
    provider_job_id: 'job-g1',
    started_at: T0.toISOString(),
  });
  provider.polls.set('job-g1', [
    {
      status: 'succeeded',
      resultUrl: 'https://cdn.example/o.png',
      expiresAt: new Date(T0.getTime() + 7 * 86_400_000).toISOString(),
    },
  ]);
  assertEquals((await run()).outcomes.g1, 'succeeded');
});

Deno.test(
  'içerik türü: genel başlıkta URL ipucu, ses çıktısı açık hatayla reddedilir',
  async () => {
    const now = T0;
    const store = new MemoryStore(() => now);
    const provider = new FakeProvider();
    const types: Record<string, string> = {
      'https://cdn.example/o.webp': 'application/octet-stream',
      'https://cdn.example/a.mp3': 'audio/mpeg',
      'https://cdn.example/noext': '',
    };
    const fetchImpl: typeof fetch = (input) =>
      Promise.resolve(
        new Response(new Uint8Array([1]), {
          headers: types[String(input)]
            ? { 'content-type': types[String(input)] }
            : {},
        }),
      );
    const run = () =>
      runWorker({
        store,
        providers: [provider],
        fetch: fetchImpl,
        now: () => now,
      });
    const running = {
      status: 'running' as const,
      started_at: T0.toISOString(),
    };
    store.add('g1', { ...running, provider_job_id: 'job-g1' });
    store.add('g2', { ...running, provider_job_id: 'job-g2' });
    store.add('g3', {
      ...running,
      provider_job_id: 'job-g3',
      mode: 'image_to_video',
    });
    provider.polls.set('job-g1', [
      {
        status: 'succeeded',
        resultUrl: 'https://cdn.example/o.webp',
        contentType: 'image/webp',
      },
    ]);
    provider.polls.set('job-g2', [
      {
        status: 'succeeded',
        resultUrl: 'https://cdn.example/a.mp3',
        contentType: 'audio/mpeg',
      },
    ]);
    provider.polls.set('job-g3', [
      { status: 'succeeded', resultUrl: 'https://cdn.example/noext' },
    ]);
    const out = (await run()).outcomes;
    assertEquals(out, { g1: 'succeeded', g2: 'failed', g3: 'succeeded' });
    assertEquals(store.get('g1').output_path, `${INF}/generated-g1.webp`);
    assert(store.get('g2').error?.includes('ses'));
    assertEquals(
      store.get('g3').output_path,
      `${INF}/generated-g3.mp4`,
      'tür bilinmiyorsa moddan',
    );
  },
);

Deno.test(
  'referans dosyalar sağlayıcıya bir kez yüklenir, tekrar denemede aynı URL',
  async () => {
    const { store, provider, run, advance } = setup();
    provider.uploads = true;
    provider.submitErrors = ['unavailable'];
    store.add('g1', { input_asset_ids: ['a1'], mode: 'image_to_video' });

    assertEquals((await run()).outcomes.g1, 'retry');
    assertEquals(provider.prepared.length, 1);
    assertEquals(provider.prepared[0].images[0].mimeType, 'image/png');
    assertEquals(
      (store.get('g1').params.provider_inputs as { image_urls: string[] })
        .image_urls,
      ['uploaded:https://signed.example/a1'],
    );
    advance(30);
    assertEquals((await run()).outcomes.g1, 'submitted');
    assertEquals(provider.prepared.length, 1, 'ikinci yükleme yok');
    assertEquals(store.inputReads, 1);
    assertEquals(
      provider.submitted.map((j) => j.imageUrls[0]),
      [
        'uploaded:https://signed.example/a1',
        'uploaded:https://signed.example/a1',
      ],
    );
  },
);

Deno.test(
  'başka üretimden kopyalanan provider_inputs kullanılmaz',
  async () => {
    const { store, provider, run } = setup();
    provider.uploads = true;
    store.add('g2', {
      input_asset_ids: ['a1'],
      params: {
        prompt: 'p',
        provider_inputs: { generation_id: 'g1', image_urls: ['https://old'] },
      },
    });
    assertEquals((await run()).outcomes.g2, 'submitted');
    assertEquals(provider.prepared.length, 1);
    assertEquals(provider.submitted[0].imageUrls, [
      'uploaded:https://signed.example/a1',
    ]);
  },
);

Deno.test('yoklamada 429 geçicidir, iş düşmez', async () => {
  const { store, provider, run } = setup();
  store.add('g1', {
    status: 'running',
    provider_job_id: 'job-g1',
    started_at: T0.toISOString(),
  });
  provider.polls.set('job-g1', ['rate_limited']);
  assertEquals((await run()).outcomes.g1, 'poll_retry');
  assertEquals(store.get('g1').status, 'running');
});
