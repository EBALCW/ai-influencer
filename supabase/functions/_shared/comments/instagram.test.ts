import { assert, assertEquals, assertRejects } from '@std/assert';
import {
  type CollectorContext,
  PermanentError,
  RateLimitedError,
  TokenExpiredError,
} from '../collectors/types.ts';
import { json } from '../youtube/fake-fetch.ts';
import {
  createInstagramCommentAdapter,
  mapInstagramComment,
} from './instagram.ts';

// Fixture'lar uydurmadır (gerçek yorum/kişi yok).
const NOW = new Date('2026-10-22T12:00:00Z');
const TOKEN = 'IGfixture-secret-access-token';

type Call = { url: URL; init?: RequestInit };

function fakeFetch(responses: (Response | Error)[]) {
  const calls: Call[] = [];
  const fn = ((input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: new URL(String(input)), init });
    const next = responses[Math.min(calls.length - 1, responses.length - 1)];
    return next instanceof Error
      ? Promise.reject(next)
      : Promise.resolve(next.clone());
  }) as typeof fetch;
  return { fetch: fn, calls };
}

function makeCtx(fetchFn: typeof fetch) {
  const quota: number[] = [];
  const warnings: string[] = [];
  const ctx: CollectorContext = {
    account: {
      id: 'acc-ig',
      influencerId: 'inf-1',
      platform: 'instagram',
      handle: '@Demo.Creator',
      externalId: '17841400000000000',
      status: 'active',
    },
    token: { accessToken: TOKEN },
    fetch: fetchFn,
    now: NOW,
    reportQuota: (u) => quota.push(u),
    warn: (m) => warnings.push(m),
  };
  return { ctx, quota, warnings };
}

const comment = (
  id: string,
  timestamp: string,
  username = 'uydurma.izleyici',
) => ({
  id,
  text: 'Çok güzel olmuş',
  timestamp,
  username,
  like_count: 1,
});
const post = {
  id: 'post-ig',
  externalId: '18000000000000001',
  publishedAt: new Date('2026-10-20T10:00:00Z'),
};
const since = new Date('2026-10-15T12:00:00Z');

Deno.test(
  'mapInstagramComment: alanlar; hesabın kendi yorumu (@, büyük harf) atlanır',
  () => {
    const c = mapInstagramComment(
      comment('1', '2026-10-21T10:00:00+0000'),
      'demo.creator',
    );
    assertEquals(c?.externalId, '1');
    assertEquals(c?.authorName, 'uydurma.izleyici');
    assertEquals(c?.publishedAt.toISOString(), '2026-10-21T10:00:00.000Z');
    assertEquals(c?.likeCount, 1);
    assertEquals(
      mapInstagramComment(
        comment('2', '2026-10-21T10:00:00+0000', 'Demo.Creator'),
        'demo.creator',
      ),
      null,
    );
    assertEquals(mapInstagramComment({ id: '3' }, 'demo.creator'), null);
  },
);

Deno.test(
  'fetchComments: after imleciyle sayfalar, eski sayfada durur, token başlıkta',
  async () => {
    const { fetch, calls } = fakeFetch([
      json({
        data: [
          comment('c3', '2026-10-22T09:00:00+0000'),
          comment('own', '2026-10-22T08:00:00+0000', 'demo.creator'),
          comment('c2', '2026-10-21T09:00:00+0000'),
        ],
        paging: {
          cursors: { after: 'A1' },
          next: 'https://graph.example/next',
        },
      }),
      json({
        data: [comment('old', '2026-10-10T09:00:00+0000')],
        paging: {
          cursors: { after: 'A2' },
          next: 'https://graph.example/next2',
        },
      }),
    ]);
    const { ctx, quota } = makeCtx(fetch);
    const out = await createInstagramCommentAdapter().fetchComments(ctx, post, {
      since,
    });
    assertEquals(
      out.map((c) => c.externalId),
      ['c3', 'c2'],
    );
    assertEquals(calls.length, 2, 'tamamı eski sayfadan sonra durur');
    assertEquals(quota, [], 'Instagram için kota birimi raporlanmaz');
    assertEquals(calls[0]!.url.pathname, '/v23.0/18000000000000001/comments');
    assertEquals(calls[0]!.url.searchParams.get('limit'), '50');
    assertEquals(calls[1]!.url.searchParams.get('after'), 'A1');
    for (const call of calls) {
      assert(!call.url.toString().includes(TOKEN));
      assertEquals(
        new Headers(call.init?.headers).get('authorization'),
        `Bearer ${TOKEN}`,
      );
    }
  },
);

Deno.test(
  'fetchComments: next yoksa durur; silinmiş media boş liste',
  async () => {
    const single = fakeFetch([
      json({
        data: [comment('c1', '2026-10-22T09:00:00+0000')],
        paging: { cursors: { after: 'X' } },
      }),
    ]);
    const out = await createInstagramCommentAdapter().fetchComments(
      makeCtx(single.fetch).ctx,
      post,
      { since },
    );
    assertEquals(out.length, 1);
    assertEquals(single.calls.length, 1);

    const gone = fakeFetch([
      json({ error: { code: 100, error_subcode: 33, message: 'x' } }, 400),
    ]);
    assertEquals(
      await createInstagramCommentAdapter().fetchComments(
        makeCtx(gone.fetch).ctx,
        post,
        { since },
      ),
      [],
    );
  },
);

Deno.test(
  'hata sınıflandırması: 190 token, 4 platform limiti, 17 hesap limiti, 10 izin',
  async () => {
    const run = (body: unknown, status: number) =>
      createInstagramCommentAdapter().fetchComments(
        makeCtx(fakeFetch([json(body, status)]).fetch).ctx,
        post,
        { since },
      );
    await assertRejects(
      () => run({ error: { code: 190 } }, 400),
      TokenExpiredError,
    );
    const app = await assertRejects(
      () => run({ error: { code: 4 } }, 400),
      RateLimitedError,
    );
    assertEquals(app.scope, 'platform');
    const user = await assertRejects(
      () => run({ error: { code: 17 } }, 400),
      RateLimitedError,
    );
    assertEquals(user.scope, 'account');
    const perm = await assertRejects(
      () => run({ error: { code: 10 } }, 403),
      PermanentError,
    );
    assert(perm.message.includes('izin yok'));
    assert(!perm.message.includes(TOKEN));
  },
);

Deno.test(
  'reply: /replies POST (form gövdesi), yanıt id’si; 5xx tekrar denenmez',
  async () => {
    const { fetch, calls } = fakeFetch([json({ id: '17900000000000009' })]);
    const result = await createInstagramCommentAdapter().reply(
      makeCtx(fetch).ctx,
      {
        commentExternalId: '17850000000000001',
        text: 'Teşekkürler 💛',
      },
    );
    assertEquals(result, { externalId: '17900000000000009' });
    assertEquals(calls[0]!.url.pathname, '/v23.0/17850000000000001/replies');
    assertEquals(calls[0]!.init?.method, 'POST');
    assertEquals(
      new URLSearchParams(String(calls[0]!.init?.body)).get('message'),
      'Teşekkürler 💛',
    );

    const server = fakeFetch([json({ error: { code: 2 } }, 500)]);
    const e = await assertRejects(
      () =>
        createInstagramCommentAdapter().reply(makeCtx(server.fetch).ctx, {
          commentExternalId: '1',
          text: 'x',
        }),
      PermanentError,
    );
    assert(e.message.includes('platformda kontrol'));
  },
);
