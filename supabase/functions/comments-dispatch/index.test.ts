import { assertEquals } from '@std/assert';
import { MemoryCommentStore } from '../_shared/comments/memory-store.ts';
import type { CommentAdapter } from '../_shared/comments/types.ts';
import { createHandler, parseBody } from './index.ts';

const ACC = 'acc-ig';

function handler(extra: Partial<Parameters<typeof createHandler>[0]> = {}) {
  const store = new MemoryCommentStore();
  store.accounts.push({
    id: ACC,
    influencerId: 'inf',
    platform: 'instagram',
    handle: 'h',
    externalId: null,
    status: 'active',
  });
  store.tokens.set(ACC, { accessToken: 't' });
  store.posts.push({
    id: 'p1',
    accountId: ACC,
    externalId: 'm1',
    publishedAt: new Date(Date.now() - 3_600_000),
  });
  const adapter: CommentAdapter = {
    platform: 'instagram',
    fetchComments: () =>
      Promise.resolve([
        {
          externalId: 'c1',
          authorName: 'uydurma',
          text: 'Merhaba',
          publishedAt: new Date(Date.now() - 60_000),
        },
      ]),
    reply: () => Promise.resolve({ externalId: 'r1' }),
  };
  const h = createHandler({
    secret: 's3cret',
    createStore: () => store,
    adapters: { instagram: adapter },
    fetch: (() => Promise.reject(new Error('ağ yok'))) as typeof fetch,
    ...extra,
  });
  return { h, store };
}

const post = (body: unknown, secret = 's3cret') =>
  new Request('http://localhost/comments-dispatch', {
    method: 'POST',
    headers: { 'x-cron-secret': secret, 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

Deno.test('sır yoksa 503, yanlışsa 401, GET 405', async () => {
  assertEquals(
    (await handler({ secret: null }).h(post({ job: 'fetch' }))).status,
    503,
  );
  assertEquals(
    (await handler().h(post({ job: 'fetch' }, 'yanlis'))).status,
    401,
  );
  assertEquals(
    (await handler().h(new Request('http://localhost/x'))).status,
    405,
  );
});

Deno.test('gövde doğrulama', async () => {
  assertEquals(parseBody({ job: 'fetch' }), { job: 'fetch' });
  assertEquals(parseBody({ job: 'reply' }), { job: 'reply' });
  assertEquals(parseBody({ job: 'metrics' }), null);
  assertEquals(parseBody([]), null);
  assertEquals((await handler().h(post('{bozuk'))).status, 400);
  assertEquals((await handler().h(post({ job: 'x' }))).status, 400);
});

Deno.test('yapılandırma eksikse 503', async () => {
  const { h } = handler({
    createStore: () => {
      throw new Error('env yok');
    },
  });
  assertEquals((await h(post({ job: 'fetch' }))).status, 503);
});

Deno.test(
  'fetch yorumları yazar; reply kuyruğu gönderir; waitUntil ile 202',
  async () => {
    const { h, store } = handler();
    const res = await h(post({ job: 'fetch' }));
    assertEquals(res.status, 200);
    assertEquals(store.comments.length, 1);

    store.replies.push({
      id: 'r1',
      commentId: store.comments[0]!.id,
      body: 'Teşekkürler',
      status: 'queued',
      attempts: 0,
      nextAttemptAt: new Date(Date.now() - 1000),
      externalId: null,
      error: null,
    });
    const sent = await h(post({ job: 'reply' }));
    assertEquals(await sent.json(), {
      sent: 1,
      failed: 0,
      requeued: 0,
      skipped: 0,
    });

    const tasks: Promise<unknown>[] = [];
    const bg = handler({ waitUntil: (t) => tasks.push(t) });
    const accepted = await bg.h(post({ job: 'fetch' }));
    assertEquals(accepted.status, 202);
    await Promise.all(tasks);
    assertEquals(bg.store.comments.length, 1);
  },
);
