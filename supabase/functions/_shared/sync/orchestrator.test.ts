import { assert, assertEquals, assertFalse, assertRejects } from '@std/assert';
import { createFakeCollector } from '../collectors/fake.ts';
import {
  errorForResponse,
  parseRetryAfter,
  PermanentError,
  RateLimitedError,
  TokenExpiredError,
  TransientError,
} from '../collectors/types.ts';
import { getCollector } from '../collectors/index.ts';
import { MemoryStore } from './memory-store.ts';
import {
  defaultRetryPolicy,
  redact,
  runSync,
  type SyncDeps,
  toMetricRow,
  utcDay,
  withRetry,
} from './orchestrator.ts';

const NOW = new Date('2026-10-22T12:00:00Z');
const TOKEN = 'IGQ-secret-token-value';
const noFetch = (() => Promise.reject(new Error('ağ yok'))) as typeof fetch;

function setup(platform: 'instagram' | 'youtube' = 'instagram') {
  const store = new MemoryStore();
  store.accounts.push({
    id: 'acc-1',
    influencerId: 'inf-1',
    platform,
    handle: 'fixture',
    externalId: 'ext-acc',
    status: 'active',
  });
  store.tokens.set('acc-1', {
    accessToken: TOKEN,
    refreshToken: 'refresh-secret',
  });
  return store;
}

function due(postId: string, targetHours: number, accountId = 'acc-1') {
  return {
    postId,
    accountId,
    platform: 'instagram' as const,
    externalId: `ext-${postId}`,
    publishedAt: new Date(NOW.getTime() - targetHours * 3_600_000 - 5 * 60_000),
    targetHours,
  };
}

function deps(
  store: MemoryStore,
  collectors: SyncDeps['collectors'],
  extra: Partial<SyncDeps> = {},
) {
  const sleeps: number[] = [];
  const logs: string[] = [];
  const d: SyncDeps = {
    store,
    collectors,
    fetch: noFetch,
    now: () => NOW,
    sleep: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
    log: (m) => logs.push(m),
    ...extra,
  };
  return { d, sleeps, logs };
}

Deno.test(
  'metrics: zamanı gelen post için target_hours ve gerçek geçen süreyle snapshot yazar',
  async () => {
    const store = setup();
    store.due.push(due('p1', 1), due('p2', 24));
    const collector = createFakeCollector('instagram', {
      metrics: { 'ext-p1': [{ views: 120, likes: 9, raw: { plays: 120 } }] },
    });
    const { d } = deps(store, { instagram: collector });
    const summary = await runSync('metrics', d);

    assertEquals(store.metrics.length, 2);
    const m1 = store.metrics.find((m) => m.post_id === 'p1')!;
    assertEquals(m1.target_hours, 1);
    assertEquals(m1.hours_since_publish, 1.08);
    assertEquals(m1.views, 120);
    assertEquals(m1.reach, null, 'ölçülmeyen nullable metrik NULL kalır');
    assertEquals(m1.raw_payload._unmeasured, ['comments', 'shares', 'saves']);
    assertEquals(store.runs[0].status, 'succeeded');
    assertEquals(store.runs[0].processedCount, 2);
    assertEquals(summary.runs[0].status, 'succeeded');
  },
);

Deno.test(
  'metrics: aynı çalışma tekrar edilirse duplicate snapshot oluşmaz (idempotent)',
  async () => {
    const store = setup();
    store.due.push(due('p1', 5));
    const collector = createFakeCollector('instagram');
    const { d } = deps(store, { instagram: collector });
    await runSync('metrics', d);
    await runSync('metrics', d);
    assertEquals(store.metrics.length, 1);
    // İkinci çalışmada zamanı gelen post kalmadığı için hesaba hiç dokunulmaz.
    assertEquals(store.runs.length, 1);
    // Yarış durumu: due listesi eski olsa bile yazım çakışmada atlanır.
    assertFalse(await store.insertMetricSnapshot({ ...store.metrics[0] }));
  },
);

Deno.test(
  'posts: yeni postlar upsert edilir, tekrar çalıştırmada satır sayısı değişmez',
  async () => {
    const store = setup();
    const posts = [
      {
        externalId: 'm1',
        caption: 'a',
        publishedAt: new Date('2026-10-21T10:00:00Z'),
        url: 'https://x/1',
      },
      {
        externalId: 'm2',
        publishedAt: new Date('2026-10-22T10:00:00Z'),
        durationS: 12.5,
      },
      { externalId: '', publishedAt: new Date('2026-10-22T10:00:00Z') },
    ];
    const collector = createFakeCollector('instagram', {
      posts: [posts, posts],
    });
    const { d, logs } = deps(store, { instagram: collector });
    await runSync('posts', d);
    await runSync('posts', d);
    assertEquals(store.posts.length, 2);
    assertEquals(store.posts[1].duration_s, 12.5);
    assertEquals(store.posts[0].caption, 'a');
    assert(logs.some((l) => l.includes('geçersiz post')));
  },
);

Deno.test('accounts: günlük snapshot UTC gün başına tek satır', async () => {
  const store = setup();
  const collector = createFakeCollector('instagram', {
    account: [
      { followers: 100, following: 5 },
      { followers: 110, mediaCount: -1 },
    ],
  });
  const { d } = deps(store, { instagram: collector });
  await runSync('accounts', d);
  await runSync('accounts', d);
  assertEquals(store.accountSnapshots.length, 1);
  assertEquals(
    store.accountSnapshots[0].captured_at,
    '2026-10-22T00:00:00.000Z',
  );
  assertEquals(store.accountSnapshots[0].followers, 110);
  assertEquals(
    store.accountSnapshots[0].media_count,
    null,
    'geçersiz sayı yazılmaz',
  );
});

Deno.test(
  'rate limit: kısa Retry-After beklenir ve tekrar denenir',
  async () => {
    const store = setup();
    store.due.push(due('p1', 1));
    const collector = createFakeCollector('instagram', {
      metrics: {
        'ext-p1': [new RateLimitedError('429', 2), { views: 5, raw: {} }],
      },
    });
    const { d, sleeps } = deps(store, { instagram: collector });
    await runSync('metrics', d);
    assertEquals(sleeps, [2_000]);
    assertEquals(store.metrics.length, 1);
    assertEquals(store.runs[0].status, 'succeeded');
  },
);

Deno.test(
  'rate limit: uzun bekleme → beklemeden durur, kalan iş sonraki çalışmaya (partial, uyarısız)',
  async () => {
    const store = setup();
    store.due.push(due('p1', 1), due('p2', 5));
    const collector = createFakeCollector('instagram', {
      metrics: { 'ext-p1': [new RateLimitedError('429', 3600)] },
    });
    const { d, sleeps } = deps(store, { instagram: collector });
    await runSync('metrics', d);
    assertEquals(sleeps, []);
    assertEquals(store.metrics.length, 0);
    assertEquals(
      collector.calls.filter((c) => c.method === 'fetchPostMetrics').length,
      1,
    );
    assertEquals(store.runs[0].status, 'partial');
    assert(store.runs[0].error?.includes('Rate limit'));
  },
);

Deno.test(
  'rate limit: platform kapsamlı kota aynı platformun diğer hesaplarını bu çalışmada atlar',
  async () => {
    const store = setup();
    store.accounts.push({ ...store.accounts[0], id: 'acc-2' });
    store.tokens.set('acc-2', { accessToken: 'other' });
    const collector = createFakeCollector('instagram', {
      account: [new RateLimitedError('kota', null, 'platform')],
    });
    const { d } = deps(
      store,
      { instagram: collector },
      {
        retry: { ...defaultRetryPolicy, maxAttempts: 1 },
      },
    );
    const summary = await runSync('accounts', d);
    assertEquals(summary.runs.length, 1);
    assertEquals(summary.skipped, [
      { accountId: 'acc-2', reason: 'rate_limited' },
    ]);
  },
);

Deno.test('geçici hata: üstel backoff ile tekrar denenir', async () => {
  const store = setup();
  store.due.push(due('p1', 1));
  const collector = createFakeCollector('instagram', {
    metrics: {
      'ext-p1': [
        new TransientError('500'),
        new TransientError('502'),
        { views: 1, raw: {} },
      ],
    },
  });
  const { d, sleeps } = deps(store, { instagram: collector });
  await runSync('metrics', d);
  assertEquals(sleeps, [1_000, 2_000]);
  assertEquals(store.metrics.length, 1);
});

Deno.test(
  'token süresi doldu: hesap expired olur, iş failed, sonraki hesap yine işlenir',
  async () => {
    const store = setup();
    store.accounts.push({ ...store.accounts[0], id: 'acc-2' });
    store.tokens.set('acc-2', { accessToken: 'other-token' });
    let first = true;
    const collector = createFakeCollector('instagram', {
      account: [
        () => {
          if (first) {
            first = false;
            throw new TokenExpiredError(`expired ${TOKEN}`);
          }
          return { followers: 1 };
        },
      ],
    });
    const { d } = deps(store, { instagram: collector });
    await runSync('accounts', d);
    assertEquals(store.statusChanges, [
      { accountId: 'acc-1', status: 'expired' },
    ]);
    assertEquals(
      store.runs.map((r) => r.status),
      ['failed', 'succeeded'],
    );
    assertFalse(store.runs[0].error?.includes(TOKEN), 'token günlüğe yazılmaz');
  },
);

Deno.test(
  'token iptal (accountStatus=error) ve kasada token yoksa hesap error olur',
  async () => {
    const store = setup();
    store.accounts.push({ ...store.accounts[0], id: 'acc-2' });
    const collector = createFakeCollector('instagram', {
      account: [new TokenExpiredError('revoked', 'error')],
    });
    const { d } = deps(store, { instagram: collector });
    await runSync('accounts', d);
    assertEquals(store.statusChanges, [
      { accountId: 'acc-1', status: 'error' },
      { accountId: 'acc-2', status: 'error' },
    ]);
    assertEquals(
      store.runs.every((r) => r.status === 'failed'),
      true,
    );
  },
);

Deno.test(
  'toplayıcı hatası: tüm postlar başarısızsa failed, kısmi başarıda partial',
  async () => {
    const store = setup();
    store.due.push(due('p1', 1), due('p2', 5));
    const collector = createFakeCollector('instagram', {
      metrics: {
        'ext-p1': [new PermanentError('400 bozuk istek')],
        'ext-p2': [new Error(`patladı access_token=${TOKEN}`)],
      },
    });
    const { d } = deps(store, { instagram: collector });
    await runSync('metrics', d);
    assertEquals(store.runs[0].status, 'failed');
    assertFalse(store.runs[0].error?.includes(TOKEN));

    store.due.push(due('p3', 24));
    await runSync('metrics', d);
    assertEquals(store.runs[1].status, 'partial');
    assertEquals(store.runs[1].processedCount, 1);
  },
);

Deno.test(
  'hatalı hesap başarılı senkronda active olur; kota toplanır',
  async () => {
    const store = setup('youtube');
    store.accounts[0].status = 'error';
    const collector = createFakeCollector('youtube', { quotaPerCall: 3 });
    const { d } = deps(store, { youtube: collector });
    await runSync('accounts', d);
    assertEquals(store.statusChanges, [
      { accountId: 'acc-1', status: 'active' },
    ]);
    assertEquals(store.runs[0].quotaUnits, 3);
  },
);

Deno.test(
  'toplayıcısı olmayan platform sessizce atlanır (günlük satırı yok)',
  async () => {
    const store = setup('youtube');
    const { d, logs } = deps(store, {
      instagram: createFakeCollector('instagram'),
    });
    const summary = await runSync('accounts', d);
    assertEquals(store.runs.length, 0);
    assertEquals(summary.skipped, [
      { accountId: 'acc-1', reason: 'no_collector' },
    ]);
    assertEquals(logs.length, 1);
    assertEquals(
      getCollector({ youtube: createFakeCollector('instagram') }, 'youtube'),
      null,
    );
  },
);

Deno.test(
  'manual: tek hesap için post + hesap + zamanı gelen metrik',
  async () => {
    const store = setup();
    store.accounts.push({ ...store.accounts[0], id: 'acc-2' });
    store.due.push(due('p1', 1), due('px', 1, 'acc-2'));
    const collector = createFakeCollector('instagram', {
      posts: [
        [{ externalId: 'n1', publishedAt: new Date('2026-10-22T09:00:00Z') }],
      ],
    });
    const { d } = deps(store, { instagram: collector });
    await runSync('manual', d, { accountId: 'acc-1' });
    assertEquals(store.runs.length, 1);
    assertEquals(store.runs[0].job, 'manual');
    assertEquals(store.runs[0].processedCount, 3);
    assertEquals(
      store.metrics.map((m) => m.post_id),
      ['p1'],
    );
  },
);

Deno.test(
  'süre bütçesi dolunca kalan hesaplar sonraki çalışmaya kalır',
  async () => {
    const store = setup();
    store.accounts.push({ ...store.accounts[0], id: 'acc-2' });
    let t = NOW.getTime();
    const collector = createFakeCollector('instagram', {
      account: [
        () => {
          t += 200_000;
          return { followers: 1 };
        },
      ],
    });
    const { d } = deps(
      store,
      { instagram: collector },
      { now: () => new Date(t), budgetMs: 100_000 },
    );
    const summary = await runSync('accounts', d);
    assertEquals(summary.runs.length, 1);
    assertEquals(summary.skipped, [{ accountId: 'acc-2', reason: 'budget' }]);
  },
);

Deno.test('günlük kapatılamasa da çalışma çökmez', async () => {
  const store = setup();
  store.finishRun = () => Promise.reject(new Error('db down'));
  const { d, logs } = deps(store, {
    instagram: createFakeCollector('instagram'),
  });
  await runSync('accounts', d);
  assert(logs.some((l) => l.includes('günlük kapatılamadı')));
});

Deno.test(
  'withRetry: deneme sınırı aşılınca son hata fırlatılır; tipsiz hata tekrar denenmez',
  async () => {
    let n = 0;
    await assertRejects(
      () =>
        withRetry(
          () => {
            n++;
            return Promise.reject(new TransientError('x'));
          },
          defaultRetryPolicy,
          () => Promise.resolve(),
        ),
      TransientError,
    );
    assertEquals(n, 3);
    n = 0;
    await assertRejects(() =>
      withRetry(
        () => {
          n++;
          return Promise.reject(new Error('y'));
        },
        defaultRetryPolicy,
        () => Promise.resolve(),
      ),
    );
    assertEquals(n, 1);
  },
);

Deno.test('toMetricRow: completion_rate 0–1 dışında NULL', () => {
  const warns: string[] = [];
  const row = toMetricRow(
    due('p1', 1),
    { views: 1, completionRate: 45, raw: {} },
    NOW,
    (m) => warns.push(m),
  );
  assertEquals(row.completion_rate, null);
  assertEquals(warns.length, 1);
});

Deno.test(
  'yardımcılar: redact, utcDay, parseRetryAfter, errorForResponse',
  () => {
    assertEquals(
      redact('x?access_token=abc&y=1 Bearer abc.def'),
      'x?access_token=[gizli]&y=1 Bearer [gizli]',
    );
    assertEquals(redact('tok SECRET1 tok', ['SECRET1']), 'tok [gizli] tok');
    assertEquals(redact('a'.repeat(600)).length, 500);
    assertEquals(
      utcDay(new Date('2026-10-22T23:59:00+03:00')),
      '2026-10-22T00:00:00.000Z',
    );
    assertEquals(parseRetryAfter('12'), 12);
    assertEquals(
      parseRetryAfter(new Date(NOW.getTime() + 30_000).toUTCString(), NOW),
      30,
    );
    assertEquals(parseRetryAfter('abc'), null);
    assert(
      errorForResponse(new Response(null, { status: 401 }), 'ig') instanceof
        TokenExpiredError,
    );
    const rl = errorForResponse(
      new Response(null, { status: 429, headers: { 'retry-after': '7' } }),
      'ig',
    );
    assert(rl instanceof RateLimitedError && rl.retryAfterSeconds === 7);
    assert(
      errorForResponse(new Response(null, { status: 503 }), 'ig') instanceof
        TransientError,
    );
    assert(
      errorForResponse(new Response(null, { status: 404 }), 'ig') instanceof
        PermanentError,
    );
  },
);
