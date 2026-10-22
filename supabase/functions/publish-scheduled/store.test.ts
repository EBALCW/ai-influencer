import { assertEquals } from '@std/assert';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseStore } from './store.ts';

function recorder(body: unknown = []) {
  const requests: { method: string; url: URL; body: string }[] = [];
  const fetchFn = (async (
    input: Request | URL | string,
    init?: RequestInit,
  ) => {
    const req = new Request(input, init);
    requests.push({
      method: req.method,
      url: new URL(req.url),
      body: await req.text(),
    });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  const db = createClient('http://db.test', 'service-key', {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: fetchFn },
  });
  return { requests, store: createSupabaseStore(db) };
}

Deno.test(
  'iş kapma claim_publish_jobs RPC’sini kira süresiyle çağırır',
  async () => {
    const { requests, store } = recorder([]);
    await store.claim(5, 600);
    assertEquals(requests[0].url.pathname, '/rest/v1/rpc/claim_publish_jobs');
    assertEquals(JSON.parse(requests[0].body), {
      p_limit: 5,
      p_lease_seconds: 600,
    });
  },
);

Deno.test(
  'durum güncellemesi yalnız processing satırına uygulanır',
  async () => {
    const { requests, store } = recorder([]);
    await store.update('job-1', { attempts: 2 });
    assertEquals(requests[0].method, 'PATCH');
    assertEquals(requests[0].url.searchParams.get('id'), 'eq.job-1');
    assertEquals(requests[0].url.searchParams.get('status'), 'eq.processing');
  },
);

Deno.test(
  'tamamlama complete_publish_job RPC’sine post bilgisini verir',
  async () => {
    const { requests, store } = recorder(null);
    await store.complete('job-1', {
      externalId: 'vid-1',
      url: 'https://www.youtube.com/shorts/vid-1',
      publishedAt: new Date('2026-10-22T10:00:00Z'),
      durationS: 20,
      isShort: true,
    });
    assertEquals(requests[0].url.pathname, '/rest/v1/rpc/complete_publish_job');
    assertEquals(JSON.parse(requests[0].body), {
      p_id: 'job-1',
      p_external_id: 'vid-1',
      p_url: 'https://www.youtube.com/shorts/vid-1',
      p_published_at: '2026-10-22T10:00:00.000Z',
      p_duration_s: 20,
      p_is_short: true,
    });
  },
);

Deno.test('bağlam sorguları influencer filtresiyle yapılır', async () => {
  const { requests, store } = recorder({
    id: 'c',
    influencer_id: 'inf-1',
    checklist: {},
  });
  await store.context({
    id: 'job-1',
    content_item_id: 'c',
    account_id: 'acc-1',
    asset_id: 'asset-1',
    platform: 'youtube',
    status: 'processing',
    title: 't',
    caption: '',
    tags: [],
    paid_partnership: false,
    attempts: 0,
    max_attempts: 5,
    provider_container_id: null,
    provider_upload_url: null,
    container_created_at: null,
  });
  const account = requests.find(
    (r) => r.url.pathname === '/rest/v1/social_accounts',
  )!;
  const asset = requests.find((r) => r.url.pathname === '/rest/v1/assets')!;
  assertEquals(account.url.searchParams.get('influencer_id'), 'eq.inf-1');
  assertEquals(asset.url.searchParams.get('influencer_id'), 'eq.inf-1');
  assertEquals(asset.url.searchParams.get('kind'), 'eq.final_video');
});
