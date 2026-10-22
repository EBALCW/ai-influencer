import { assertEquals } from '@std/assert';
import { createFakeCollector } from '../_shared/collectors/fake.ts';
import { MemoryStore } from '../_shared/sync/memory-store.ts';
import { createHandler, parseBody } from './index.ts';

const ACC = '0f3c2a8e-1b2c-4d5e-8f90-123456789abc';

function handler(extra: Partial<Parameters<typeof createHandler>[0]> = {}) {
  const store = new MemoryStore();
  store.accounts.push({
    id: ACC,
    influencerId: 'inf',
    platform: 'instagram',
    handle: 'h',
    externalId: null,
    status: 'active',
  });
  store.tokens.set(ACC, { accessToken: 't' });
  const h = createHandler({
    secret: 's3cret',
    createStore: () => store,
    collectors: {
      instagram: createFakeCollector('instagram', {
        account: [{ followers: 3 }],
      }),
    },
    fetch: (() => Promise.reject(new Error('ağ yok'))) as typeof fetch,
    ...extra,
  });
  return { h, store };
}

const post = (body: unknown, secret = 's3cret') =>
  new Request('http://localhost/sync-dispatch', {
    method: 'POST',
    headers: { 'x-cron-secret': secret, 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

Deno.test('sır yoksa 503, yanlışsa 401, GET 405', async () => {
  assertEquals(
    (await handler({ secret: null }).h(post({ job: 'posts' }))).status,
    503,
  );
  assertEquals(
    (await handler().h(post({ job: 'posts' }, 'yanlis'))).status,
    401,
  );
  assertEquals(
    (await handler().h(new Request('http://localhost/x'))).status,
    405,
  );
});

Deno.test('geçersiz gövde 400', async () => {
  const { h } = handler();
  assertEquals((await h(post('{'))).status, 400);
  assertEquals((await h(post({ job: 'everything' }))).status, 400);
  assertEquals(
    (await h(post({ job: 'manual', account_id: 'x; drop' }))).status,
    400,
  );
  assertEquals(parseBody({ job: 'manual', account_id: ACC }), {
    job: 'manual',
    accountId: ACC,
  });
  assertEquals(parseBody({ job: 'metrics', account_id: null }), {
    job: 'metrics',
  });
});

Deno.test('geçerli çağrı işi çalıştırır ve özet döner', async () => {
  const { h, store } = handler();
  const res = await h(post({ job: 'accounts' }));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.runs[0].status, 'succeeded');
  assertEquals(store.accountSnapshots[0].followers, 3);
});

Deno.test('waitUntil varsa 202 döner, iş arka planda tamamlanır', async () => {
  const tasks: Promise<unknown>[] = [];
  const { h, store } = handler({ waitUntil: (t) => tasks.push(t) });
  const res = await h(post({ job: 'manual', account_id: ACC }));
  assertEquals(res.status, 202);
  await Promise.all(tasks);
  assertEquals(store.runs[0].job, 'manual');
});

Deno.test('yapılandırma eksikse 503', async () => {
  const { h } = handler({
    createStore: () => {
      throw new Error('env yok');
    },
  });
  assertEquals((await h(post({ job: 'posts' }))).status, 503);
});
