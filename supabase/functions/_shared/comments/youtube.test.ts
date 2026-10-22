import { assert, assertEquals, assertRejects } from '@std/assert';
import {
  type CollectorContext,
  PermanentError,
  RateLimitedError,
  TokenExpiredError,
} from '../collectors/types.ts';
import { json } from '../youtube/fake-fetch.ts';
import { YOUTUBE_QUOTA_COST } from '../youtube/quota.ts';
import { createYoutubeCommentAdapter, mapCommentThread } from './youtube.ts';

// Fixture'lar uydurmadır (gerçek yorum/kişi yok).
const NOW = new Date('2026-10-22T12:00:00Z');
const TOKEN = 'ya29.fixture-secret-access-token';
const CHANNEL = 'UCfixtureChannel000000001';

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
      id: 'acc-yt',
      influencerId: 'inf-1',
      platform: 'youtube',
      handle: 'fixture',
      externalId: CHANNEL,
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

const thread = (
  id: string,
  publishedAt: string,
  opts: { author?: string; channel?: string; text?: string } = {},
) => ({
  kind: 'youtube#commentThread',
  id,
  snippet: {
    videoId: 'vid-1',
    topLevelComment: {
      id,
      snippet: {
        authorDisplayName: opts.author ?? 'Uydurma İzleyici',
        authorChannelId: { value: opts.channel ?? 'UCviewer' },
        textOriginal: opts.text ?? 'Harika video!',
        textDisplay: opts.text ?? 'Harika video!',
        likeCount: 3,
        publishedAt,
      },
    },
    totalReplyCount: 0,
  },
});

const post = {
  id: 'post-1',
  externalId: 'vid-1',
  publishedAt: new Date('2026-10-20T10:00:00Z'),
};

Deno.test(
  'kota tablosu: commentThreads.list 1, comments.insert 50 birim',
  () => {
    assertEquals(YOUTUBE_QUOTA_COST['commentThreads.list'], 1);
    assertEquals(YOUTUBE_QUOTA_COST['comments.insert'], 50);
  },
);

Deno.test(
  'mapCommentThread: alanlar, kanalın kendi yorumu ve tarihsiz öğe atlanır',
  () => {
    const c = mapCommentThread(thread('c1', '2026-10-21T10:00:00Z'), CHANNEL);
    assertEquals(c?.externalId, 'c1');
    assertEquals(c?.authorName, 'Uydurma İzleyici');
    assertEquals(c?.text, 'Harika video!');
    assertEquals(c?.likeCount, 3);
    assertEquals(c?.publishedAt.toISOString(), '2026-10-21T10:00:00.000Z');
    assertEquals(
      mapCommentThread(
        thread('c2', '2026-10-21T10:00:00Z', { channel: CHANNEL }),
        CHANNEL,
      ),
      null,
    );
    assertEquals(mapCommentThread({ id: 'x', snippet: {} }, CHANNEL), null);
  },
);

Deno.test(
  'fetchComments: sayfalama since’a ulaşınca durur, sayfa başına 1 birim',
  async () => {
    const { fetch, calls } = fakeFetch([
      json({
        items: [
          thread('c3', '2026-10-22T09:00:00Z'),
          thread('own', '2026-10-22T08:00:00Z', { channel: CHANNEL }),
          thread('c2', '2026-10-21T09:00:00Z'),
        ],
        nextPageToken: 'P2',
      }),
      json({
        items: [
          thread('c1', '2026-10-20T12:00:00Z'),
          thread('old', '2026-10-14T09:00:00Z'),
        ],
        nextPageToken: 'P3',
      }),
    ]);
    const { ctx, quota } = makeCtx(fetch);
    const adapter = createYoutubeCommentAdapter();
    const out = await adapter.fetchComments(ctx, post, {
      since: new Date('2026-10-15T12:00:00Z'),
    });
    assertEquals(
      out.map((c) => c.externalId),
      ['c3', 'c2', 'c1'],
    );
    assertEquals(calls.length, 2, 'eski yoruma inince 3. sayfa istenmez');
    assertEquals(quota, [1, 1]);
    const first = calls[0]!.url;
    assertEquals(first.pathname, '/youtube/v3/commentThreads');
    assertEquals(first.searchParams.get('videoId'), 'vid-1');
    assertEquals(first.searchParams.get('order'), 'time');
    assertEquals(first.searchParams.get('textFormat'), 'plainText');
    assertEquals(calls[1]!.url.searchParams.get('pageToken'), 'P2');
    for (const call of calls) {
      assert(!call.url.toString().includes(TOKEN), 'token URL’de değil');
      assertEquals(
        new Headers(call.init?.headers).get('authorization'),
        `Bearer ${TOKEN}`,
      );
    }
  },
);

Deno.test(
  'fetchComments: sayfa sınırında uyarı, yorumlar kapalıysa boş liste',
  async () => {
    const many = fakeFetch([
      json({
        items: [thread('a', '2026-10-22T09:00:00Z')],
        nextPageToken: 'N',
      }),
    ]);
    const a = makeCtx(many.fetch);
    const out = await createYoutubeCommentAdapter({
      maxPages: 2,
    }).fetchComments(a.ctx, post, { since: new Date('2026-10-15T00:00:00Z') });
    assertEquals(many.calls.length, 2);
    assertEquals(out.length, 1, 'aynı yorum iki kez dönmez');
    assert(a.warnings.some((w) => w.includes('sayfa sınırı')));

    const disabled = fakeFetch([
      json(
        { error: { code: 403, errors: [{ reason: 'commentsDisabled' }] } },
        403,
      ),
    ]);
    const b = makeCtx(disabled.fetch);
    assertEquals(
      await createYoutubeCommentAdapter().fetchComments(b.ctx, post, {
        since: new Date('2026-10-15T00:00:00Z'),
      }),
      [],
    );
    assertEquals(b.quota, [1], 'reddedilen istek de kotaya yazılır');
  },
);

Deno.test('fetchComments: hata sınıflandırması (kota, token)', async () => {
  const quota = fakeFetch([
    json({ error: { code: 403, errors: [{ reason: 'quotaExceeded' }] } }, 403),
  ]);
  const err = await assertRejects(
    () =>
      createYoutubeCommentAdapter().fetchComments(
        makeCtx(quota.fetch).ctx,
        post,
        {
          since: NOW,
        },
      ),
    RateLimitedError,
  );
  assertEquals(err.scope, 'platform');
  const expired = fakeFetch([json({ error: { code: 401 } }, 401)]);
  await assertRejects(
    () =>
      createYoutubeCommentAdapter().fetchComments(
        makeCtx(expired.fetch).ctx,
        post,
        {
          since: NOW,
        },
      ),
    TokenExpiredError,
  );
});

Deno.test(
  'reply: comments.insert POST gövdesi, 50 birim, yanıt id’si',
  async () => {
    const { fetch, calls } = fakeFetch([json({ id: 'reply-1' })]);
    const { ctx, quota } = makeCtx(fetch);
    const result = await createYoutubeCommentAdapter().reply(ctx, {
      commentExternalId: 'c1',
      text: 'Teşekkürler!',
    });
    assertEquals(result, { externalId: 'reply-1' });
    assertEquals(quota, [50]);
    assertEquals(calls.length, 1);
    assertEquals(calls[0]!.url.pathname, '/youtube/v3/comments');
    assertEquals(calls[0]!.url.searchParams.get('part'), 'snippet');
    assertEquals(calls[0]!.init?.method, 'POST');
    assertEquals(JSON.parse(String(calls[0]!.init?.body)), {
      snippet: { parentId: 'c1', textOriginal: 'Teşekkürler!' },
    });
  },
);

Deno.test(
  'reply: 5xx ve ağ hatası tekrar denenmez (çift yanıt riski)',
  async () => {
    const server = fakeFetch([json({ error: { code: 503 } }, 503)]);
    const e1 = await assertRejects(
      () =>
        createYoutubeCommentAdapter().reply(makeCtx(server.fetch).ctx, {
          commentExternalId: 'c1',
          text: 'x',
        }),
      PermanentError,
    );
    assert(e1.message.includes('platformda kontrol'));
    const network = fakeFetch([new TypeError('bağlantı koptu')]);
    const n = makeCtx(network.fetch);
    await assertRejects(
      () =>
        createYoutubeCommentAdapter().reply(n.ctx, {
          commentExternalId: 'c1',
          text: 'x',
        }),
      PermanentError,
    );
    assertEquals(n.quota, [], 'yanıt gelmediyse kota yazılmaz');
    const limited = fakeFetch([
      json(
        { error: { code: 429, errors: [{ reason: 'rateLimitExceeded' }] } },
        429,
      ),
    ]);
    await assertRejects(
      () =>
        createYoutubeCommentAdapter().reply(makeCtx(limited.fetch).ctx, {
          commentExternalId: 'c1',
          text: 'x',
        }),
      RateLimitedError,
    );
  },
);
