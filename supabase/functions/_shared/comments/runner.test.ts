import { assert, assertEquals } from '@std/assert';
import {
  PermanentError,
  RateLimitedError,
  TokenExpiredError,
} from '../collectors/types.ts';
import { json } from '../youtube/fake-fetch.ts';
import { MemoryCommentStore } from './memory-store.ts';
import { fetchComments, MAX_REPLY_ATTEMPTS, sendReplies } from './runner.ts';
import type { CollectedComment, CommentAdapter } from './types.ts';
import { createYoutubeCommentAdapter } from './youtube.ts';

// Fixture'lar uydurmadır.
const NOW = new Date('2026-10-22T12:00:00Z');
const day = 24 * 3_600_000;
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const IG = 'acc-ig';
const YT = 'acc-yt';
const noNet = (() => Promise.reject(new Error('ağ yok'))) as typeof fetch;
const noSleep = () => Promise.resolve();

function setup() {
  const store = new MemoryCommentStore();
  store.accounts.push(
    {
      id: IG,
      influencerId: 'inf',
      platform: 'instagram',
      handle: 'demo',
      externalId: 'ig-1',
      status: 'active',
    },
    {
      id: YT,
      influencerId: 'inf',
      platform: 'youtube',
      handle: 'demo',
      externalId: 'UCdemo',
      status: 'error',
    },
  );
  store.tokens.set(IG, { accessToken: 'ig-secret-token' });
  store.tokens.set(YT, { accessToken: 'yt-secret-token' });
  store.posts.push(
    { id: 'p-ig', accountId: IG, externalId: 'm1', publishedAt: ago(2 * day) },
    { id: 'p-old', accountId: IG, externalId: 'm0', publishedAt: ago(9 * day) },
    { id: 'p-yt', accountId: YT, externalId: 'v1', publishedAt: ago(1 * day) },
  );
  return store;
}

type Script = {
  comments?: (postId: string, since: Date) => CollectedComment[] | Error;
  reply?: () => { externalId: string } | Error;
};

function scripted(
  platform: 'instagram' | 'youtube',
  script: Script,
  calls: { fetch: string[]; reply: number } = { fetch: [], reply: 0 },
) {
  const adapter: CommentAdapter = {
    platform,
    fetchComments(_ctx, post, { since }) {
      calls.fetch.push(`${post.id}@${since.toISOString()}`);
      const out = script.comments?.(post.id, since) ?? [];
      return out instanceof Error ? Promise.reject(out) : Promise.resolve(out);
    },
    reply() {
      calls.reply += 1;
      const out = script.reply?.() ?? { externalId: `r-${calls.reply}` };
      return out instanceof Error ? Promise.reject(out) : Promise.resolve(out);
    },
  };
  return { adapter, calls };
}

const c = (id: string, at: Date, text = 'Güzel'): CollectedComment => ({
  externalId: id,
  authorName: 'uydurma',
  text,
  publishedAt: at,
  likeCount: 1,
});

Deno.test(
  'fetch: son 7 günün postları, tekrar çalıştırmada duplicate yok, panel durumu korunur',
  async () => {
    const store = setup();
    const ig = scripted('instagram', {
      comments: () => [
        c('a', ago(3_600_000), 'İŞ BİRLİĞİ için yazın'),
        c('b', ago(day)),
        c('too-old', ago(8 * day)),
      ],
    });
    const deps = {
      store,
      adapters: { instagram: ig.adapter },
      fetch: noNet,
      now: () => NOW,
      sleep: noSleep,
    };
    const first = await fetchComments(deps);
    assertEquals(store.comments.length, 2, '7 günden eski yorum yazılmaz');
    assertEquals(ig.calls.fetch.length, 1, '9 günlük posta istek atılmaz');
    assertEquals(
      store.comments.find((x) => x.external_id === 'a')?.is_brand_inquiry,
      true,
    );
    assertEquals(
      store.comments.find((x) => x.external_id === 'b')?.is_brand_inquiry,
      false,
    );
    assertEquals(
      first.skipped,
      [{ accountId: YT, reason: 'no_adapter' }],
      'adaptörü olmayan platform atlanır',
    );

    store.comments[0]!.status = 'hidden';
    await fetchComments(deps);
    assertEquals(store.comments.length, 2, 'ikinci çalışma duplicate üretmez');
    assertEquals(store.comments[0]!.status, 'hidden', 'panel durumu ezilmez');
    // İkinci çalışma bilinen en yeni yorumdan 1 saat geriye bakar.
    assertEquals(
      ig.calls.fetch[1],
      `p-ig@${new Date(ago(3_600_000).getTime() - 3_600_000).toISOString()}`,
    );
    assertEquals(
      store.runs.map((r) => [r.job, r.status, r.processedCount]),
      [
        ['comments', 'succeeded', 2],
        ['comments', 'succeeded', 2],
      ],
    );
  },
);

Deno.test('fetch: YouTube kotası sync_runs.quota_units’e yazılır', async () => {
  const store = setup();
  store.accounts.splice(0, 1); // yalnız YouTube
  const thread = (id: string, at: Date) => ({
    id,
    snippet: {
      topLevelComment: {
        id,
        snippet: {
          authorDisplayName: 'Uydurma',
          authorChannelId: { value: 'UCviewer' },
          textOriginal: 'sponsor arıyor musunuz?',
          publishedAt: at.toISOString(),
        },
      },
    },
  });
  let n = 0;
  const fakeFetch = (() => {
    n += 1;
    return Promise.resolve(
      n === 1
        ? json({ items: [thread('y1', ago(60_000))], nextPageToken: 'P2' })
        : json({ items: [thread('y2', ago(120_000))] }),
    );
  }) as typeof fetch;
  await fetchComments({
    store,
    adapters: { youtube: createYoutubeCommentAdapter() },
    fetch: fakeFetch,
    now: () => NOW,
    sleep: noSleep,
  });
  assertEquals(store.comments.length, 2);
  assertEquals(store.runs[0]?.quotaUnits, 2, 'iki sayfa = 2 birim');
  assertEquals(store.runs[0]?.platform, 'youtube');
  assert(store.comments.every((x) => x.is_brand_inquiry));
});

Deno.test(
  'fetch: platform rate limit → aynı platformun kalan hesabı atlanır, kısmi',
  async () => {
    const store = setup();
    store.accounts.push({
      id: 'acc-ig-2',
      influencerId: 'inf',
      platform: 'instagram',
      handle: 'two',
      externalId: null,
      status: 'active',
    });
    store.tokens.set('acc-ig-2', { accessToken: 't2' });
    const ig = scripted('instagram', {
      comments: () => new RateLimitedError('limit', 3600, 'platform'),
    });
    const summary = await fetchComments({
      store,
      adapters: { instagram: ig.adapter },
      fetch: noNet,
      now: () => NOW,
      sleep: noSleep,
    });
    assertEquals(summary.runs[0]?.status, 'partial');
    assert(
      summary.skipped.some(
        (s) => s.accountId === 'acc-ig-2' && s.reason === 'rate_limited',
      ),
    );
  },
);

Deno.test(
  'fetch: token hatası hesabı işaretler, sır loga/günlüğe yazılmaz',
  async () => {
    const store = setup();
    const logs: string[] = [];
    const ig = scripted('instagram', {
      comments: () =>
        new TokenExpiredError('token ig-secret-token reddedildi', 'error'),
    });
    const summary = await fetchComments({
      store,
      adapters: { instagram: ig.adapter },
      fetch: noNet,
      now: () => NOW,
      sleep: noSleep,
      log: (m) => logs.push(m),
    });
    assertEquals(summary.runs[0]?.status, 'failed');
    assertEquals(store.statusChanges, [{ accountId: IG, status: 'error' }]);
    assert(!JSON.stringify(store.runs).includes('ig-secret-token'));
    assert(!logs.join('\n').includes('ig-secret-token'));
  },
);

function queue(store: MemoryCommentStore, platform: 'instagram' | 'youtube') {
  const account = platform === 'instagram' ? IG : YT;
  store.comments.push({
    id: `cm-${platform}`,
    post_id: platform === 'instagram' ? 'p-ig' : 'p-yt',
    account_id: account,
    platform,
    external_id: `ext-${platform}`,
    parent_external_id: null,
    author_name: 'uydurma',
    text: 'Soru?',
    published_at: ago(3_600_000).toISOString(),
    like_count: null,
    is_brand_inquiry: false,
    status: 'new',
  });
  store.replies.push({
    id: `rp-${platform}`,
    commentId: `cm-${platform}`,
    body: 'Teşekkürler!',
    status: 'queued',
    attempts: 0,
    nextAttemptAt: ago(1000),
    externalId: null,
    error: null,
  });
}

Deno.test(
  'reply: tek gönderim, yorum yanıtlandı olur; ikinci çalışma tekrar göndermez',
  async () => {
    const store = setup();
    queue(store, 'youtube');
    let posts = 0;
    const fakeFetch = (() => {
      posts += 1;
      return Promise.resolve(json({ id: 'yt-reply-1' }));
    }) as typeof fetch;
    const deps = {
      store,
      adapters: { youtube: createYoutubeCommentAdapter() },
      fetch: fakeFetch,
      now: () => NOW,
    };
    const first = await sendReplies(deps);
    const second = await sendReplies(deps);
    assertEquals(first, { sent: 1, failed: 0, requeued: 0, skipped: 0 });
    assertEquals(second.sent, 0);
    assertEquals(posts, 1, 'platforma tek istek');
    assertEquals(store.replies[0]?.status, 'sent');
    assertEquals(store.replies[0]?.externalId, 'yt-reply-1');
    assertEquals(store.comments[0]?.status, 'replied');
    assertEquals(
      store.runs.map((r) => [r.job, r.status, r.quotaUnits]),
      [['comment_reply', 'succeeded', 50]],
      'yanıt 50 kota birimi olarak günlüğe yazılır',
    );
  },
);

Deno.test('reply: başka çalışma aldıysa gönderilmez', async () => {
  const store = setup();
  queue(store, 'instagram');
  store.stealClaims = true;
  const ig = scripted('instagram', {});
  const summary = await sendReplies({
    store,
    adapters: { instagram: ig.adapter },
    fetch: noNet,
    now: () => NOW,
  });
  assertEquals(summary.skipped, 1);
  assertEquals(ig.calls.reply, 0);
});

Deno.test(
  'reply: rate limit yeniden sıraya alır, sınırda başarısız olur',
  async () => {
    const store = setup();
    queue(store, 'instagram');
    const ig = scripted('instagram', {
      reply: () => new RateLimitedError('limit', 120, 'account'),
    });
    const deps = {
      store,
      adapters: { instagram: ig.adapter },
      fetch: noNet,
      now: () => NOW,
    };
    assertEquals((await sendReplies(deps)).requeued, 1);
    const r = store.replies[0]!;
    assertEquals(r.status, 'queued');
    assertEquals(r.nextAttemptAt.getTime(), NOW.getTime() + 120_000);
    assertEquals(
      (await sendReplies(deps)).requeued,
      0,
      'zamanı gelmeden alınmaz',
    );

    r.attempts = MAX_REPLY_ATTEMPTS - 1;
    r.nextAttemptAt = ago(1);
    assertEquals((await sendReplies(deps)).failed, 1);
    assertEquals(r.status, 'failed');
  },
);

Deno.test(
  'reply: kalıcı hata, token yok, desteklenmeyen platform → failed',
  async () => {
    const store = setup();
    queue(store, 'instagram');
    queue(store, 'youtube');
    store.tokens.delete(YT);
    const ig = scripted('instagram', {
      reply: () => new PermanentError('Instagram replies: izin yok (code 10)'),
    });
    const yt = scripted('youtube', {});
    const summary = await sendReplies({
      store,
      adapters: { instagram: ig.adapter, youtube: yt.adapter },
      fetch: noNet,
      now: () => NOW,
    });
    assertEquals(summary.failed, 2);
    assertEquals(yt.calls.reply, 0);
    assertEquals(
      store.replies.map((x) => x.status),
      ['failed', 'failed'],
    );
    assert(store.replies[0]!.error!.includes('izin yok'));
    assertEquals(store.statusChanges, [{ accountId: YT, status: 'error' }]);

    const other = setup();
    queue(other, 'instagram');
    const unsupported = await sendReplies({
      store: other,
      adapters: {},
      fetch: noNet,
      now: () => NOW,
    });
    assertEquals(unsupported.failed, 1);
    assertEquals(other.runs.length, 0, 'claim edilmeden kapatılır');
  },
);
