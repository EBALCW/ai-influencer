import { assert, assertEquals } from '@std/assert';
import { createSupabaseStore } from './supabase-store.ts';

function recorder(body: unknown = []) {
  const requests: {
    method: string;
    url: URL;
    headers: Headers;
    body: string;
  }[] = [];
  const fetchFn = (async (
    input: Request | URL | string,
    init?: RequestInit,
  ) => {
    const req = new Request(input, init);
    requests.push({
      method: req.method,
      url: new URL(req.url),
      headers: req.headers,
      body: await req.text(),
    });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return {
    requests,
    store: createSupabaseStore('http://db.test', 'service-key', fetchFn),
  };
}

Deno.test(
  'posts upsert düz UNIQUE kısıtını hedefler (on_conflict)',
  async () => {
    const { requests, store } = recorder([{ id: 'p' }]);
    const n = await store.upsertPosts([
      {
        account_id: 'a',
        external_id: 'e',
        url: null,
        caption: '',
        published_at: '2026-10-22T00:00:00.000Z',
        duration_s: null,
        is_short: true,
      },
    ]);
    assertEquals(n, 1);
    assertEquals(requests[0].url.pathname, '/rest/v1/posts');
    assertEquals(
      requests[0].url.searchParams.get('on_conflict'),
      'account_id,external_id',
    );
    assert(
      requests[0].headers
        .get('prefer')
        ?.includes('resolution=merge-duplicates'),
    );
  },
);

Deno.test(
  'metrik snapshot (post_id, target_hours) çakışmasında yazmaz',
  async () => {
    const { requests, store } = recorder([]);
    const inserted = await store.insertMetricSnapshot({
      post_id: 'p',
      captured_at: '2026-10-22T01:00:00.000Z',
      hours_since_publish: 1,
      target_hours: 1,
      views: 0,
      reach: null,
      likes: 0,
      comments: 0,
      shares: 0,
      saves: 0,
      avg_watch_time_s: null,
      completion_rate: null,
      raw_payload: {},
    });
    assertEquals(inserted, false);
    assertEquals(
      requests[0].url.searchParams.get('on_conflict'),
      'post_id,target_hours',
    );
    assert(
      requests[0].headers
        .get('prefer')
        ?.includes('resolution=ignore-duplicates'),
    );
  },
);

Deno.test(
  'due_snapshots RPC zamanı parametre olarak gönderir ve satırları eşler',
  async () => {
    const { requests, store } = recorder([
      {
        post_id: 'p',
        account_id: 'a',
        platform: 'instagram',
        external_id: 'e',
        published_at: '2026-10-22T00:00:00+00:00',
        target_hours: 5,
        due_at: '2026-10-22T05:00:00+00:00',
      },
    ]);
    const rows = await store.dueSnapshots(
      new Date('2026-10-22T05:10:00Z'),
      50,
      'a',
    );
    assertEquals(requests[0].url.pathname, '/rest/v1/rpc/due_snapshots');
    assertEquals(JSON.parse(requests[0].body), {
      p_at: '2026-10-22T05:10:00.000Z',
      p_limit: 50,
      p_account_id: 'a',
    });
    assertEquals(rows[0].targetHours, 5);
    assertEquals(rows[0].publishedAt.toISOString(), '2026-10-22T00:00:00.000Z');
  },
);

Deno.test(
  'günlük kapatma bitiş zamanını göndermez (veritabanı saati yazar)',
  async () => {
    const { requests, store } = recorder([]);
    await store.finishRun('r', {
      status: 'failed',
      processedCount: 0,
      quotaUnits: null,
      error: 'x',
    });
    assertEquals(requests[0].method, 'PATCH');
    assertEquals(JSON.parse(requests[0].body), {
      status: 'failed',
      processed_count: 0,
      quota_units: null,
      error: 'x',
    });
  },
);

Deno.test(
  'token paketi beklenen alanlara indirgenir; access_token yoksa null',
  async () => {
    const ok = recorder({ access_token: 'A', refresh_token: 'R', extra: 'x' });
    assertEquals(await ok.store.readToken('a'), {
      accessToken: 'A',
      refreshToken: 'R',
    });
    const empty = recorder(null);
    assertEquals(await empty.store.readToken('a'), null);
  },
);
