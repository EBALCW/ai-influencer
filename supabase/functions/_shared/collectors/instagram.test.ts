import { assert, assertEquals, assertRejects } from '@std/assert';
import {
  createInstagramCollector,
  instagramCollector,
  instagramMetrics,
} from './instagram.ts';
import { collectors } from './index.ts';
import {
  type CollectorContext,
  PermanentError,
  RateLimitedError,
  TokenExpiredError,
  TransientError,
} from './types.ts';
import { MemoryStore } from '../sync/memory-store.ts';
import { runSync } from '../sync/orchestrator.ts';
import page1 from '../instagram/fixtures/media.json' with { type: 'json' };
import page2 from '../instagram/fixtures/media-page2.json' with { type: 'json' };
import insights from '../instagram/fixtures/insights.json' with { type: 'json' };

const NOW = new Date('2026-10-24T12:00:00Z');
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status });
function setup(respond: (url: URL) => Response | Promise<Response>) {
  const calls: URL[] = [];
  const warnings: string[] = [];
  let quota = 0;
  const ctx: CollectorContext = {
    account: {
      id: 'acc-1',
      influencerId: 'inf-1',
      platform: 'instagram',
      handle: 'fixture',
      externalId: 'user-1',
      status: 'active',
    },
    token: { accessToken: 'fixture-secret' },
    now: NOW,
    fetch: (async (input, init) => {
      const url = new URL(String(input));
      assertEquals(url.origin, 'https://graph.instagram.com');
      assertEquals(url.searchParams.has('access_token'), false);
      assertEquals(
        new Headers(init?.headers).get('authorization'),
        'Bearer fixture-secret',
      );
      calls.push(url);
      return await respond(url);
    }) as typeof fetch,
    warn: (m) => warnings.push(m),
    reportQuota: (n) => {
      quota += n;
    },
  };
  return { ctx, calls, warnings, quota: () => quota };
}
const media = {
  id: 'media-1',
  owner: { id: 'user-1' },
  media_type: 'VIDEO',
  media_product_type: 'REELS',
};
const post = {
  id: 'p1',
  externalId: 'media-1',
  publishedAt: NOW,
  targetHours: 1,
};

Deno.test(
  'Instagram kaydı ve güvenli cursor sayfalama; tekrarlar ve bozuk tarihler atlanır',
  async () => {
    assertEquals(collectors.instagram, instagramCollector);
    const { ctx, calls, quota } = setup((u) =>
      json(u.searchParams.has('after') ? page2 : page1),
    );
    const rows = await instagramCollector.fetchPosts(ctx, { since: null });
    assertEquals(
      rows.map((p) => p.externalId),
      ['media-1', 'media-2'],
    );
    assertEquals(rows[0].publishedAt.toISOString(), '2026-10-23T10:00:00.000Z');
    assertEquals(rows[0].isShort, true);
    assertEquals(rows[1].isShort, false);
    assertEquals(calls[1].searchParams.get('after'), 'page-2');
    assertEquals(quota(), 2);
  },
);
Deno.test(
  'Instagram eski kayıt sonraki sayfadaki yeni kaydı gizlemez',
  async () => {
    const { ctx } = setup((u) =>
      json(u.searchParams.has('after') ? page2 : page1),
    );
    const rows = await instagramCollector.fetchPosts(ctx, {
      since: new Date('2026-10-24T08:00:00Z'),
    });
    assertEquals(
      rows.map((p) => p.externalId),
      ['media-2'],
    );
  },
);
Deno.test(
  'Instagram sayfa sınırı ve tekrarlayan cursor sessiz veri kaybettirmez',
  async () => {
    const { ctx } = setup(() => json(page1));
    await assertRejects(
      () =>
        createInstagramCollector({ maxPages: 1 }).fetchPosts(ctx, {
          since: null,
        }),
      PermanentError,
    );
    await assertRejects(
      () => instagramCollector.fetchPosts(ctx, { since: null }),
      PermanentError,
    );
  },
);
Deno.test(
  'Instagram hesap sayıları; erişim 24 saat, kaldırılan profile_views NULL',
  async () => {
    const { ctx, calls } = setup((u) =>
      json(
        u.pathname.endsWith('/insights')
          ? { data: [{ name: 'reach', total_value: { value: 12 } }] }
          : {
              id: 'user-1',
              followers_count: 20,
              follows_count: 2,
              media_count: 3,
            },
      ),
    );
    assertEquals(await instagramCollector.fetchAccount(ctx), {
      followers: 20,
      following: 2,
      mediaCount: 3,
      reachDay: 12,
      profileViews: null,
    });
    assertEquals(
      Number(calls[1].searchParams.get('until')) -
        Number(calls[1].searchParams.get('since')),
      86400,
    );
  },
);
Deno.test('Instagram başka hesap ve eksik kimlik reddedilir', async () => {
  const { ctx, calls } = setup(() =>
    json({ id: 'other', followers_count: 10 }),
  );
  await assertRejects(
    () => instagramCollector.fetchAccount(ctx),
    PermanentError,
  );
  ctx.account.externalId = null;
  await assertRejects(
    () => instagramCollector.fetchPosts(ctx, { since: null }),
    PermanentError,
  );
  assertEquals(calls.length, 1);
});
Deno.test(
  'Instagram metrikler: sıfır korunur, ms saniyeye çevrilir, bilinmeyen metrik saklanır',
  async () => {
    const { ctx, warnings } = setup((u) =>
      json(u.pathname.endsWith('/insights') ? insights : media),
    );
    const result = await instagramCollector.fetchPostMetrics(ctx, post);
    assertEquals(result?.views, 120);
    assertEquals(result?.likes, 0);
    assertEquals(result?.avgWatchTimeS, 4.5);
    assertEquals(result?.completionRate, null);
    assertEquals(
      (result?.raw.metrics as Record<string, unknown>).future_metric,
      7,
    );
    assertEquals(
      (result?.raw.metrics as Record<string, unknown>)
        .ig_reels_video_view_total_time,
      540000,
    );
    assert(warnings.length > 0);
    assert(!JSON.stringify(result).includes('fixture-secret'));
  },
);
Deno.test(
  'Instagram ölçülmeyen ve bozuk metrik sıfır olmaz, şema hatası reddedilir',
  () => {
    const warnings: string[] = [];
    assertEquals(
      instagramMetrics(
        { data: [{ name: 'views', values: [{ value: -1 }] }] },
        ['views', 'reach'],
        (m) => warnings.push(m),
      ),
      { views: null },
    );
    assertEquals(warnings.length, 2);
  },
);
Deno.test(
  'Instagram FEED Reels izleme metriklerini istemez; farklı medya sahibi reddedilir',
  async () => {
    const { ctx, calls } = setup((u) =>
      json(
        u.pathname.endsWith('/insights')
          ? { data: [] }
          : { ...media, media_product_type: 'FEED' },
      ),
    );
    await instagramCollector.fetchPostMetrics(ctx, post);
    assert(!calls[1].searchParams.get('metric')!.includes('ig_reels'));
    const other = setup(() => json({ ...media, owner: { id: 'other' } }));
    await assertRejects(
      () => instagramCollector.fetchPostMetrics(other.ctx, post),
      PermanentError,
    );
    assertEquals(other.calls.length, 1);
  },
);
Deno.test(
  'Instagram 190/429/503 ve ağ hataları sır sızdırmadan sınıflandırılır',
  async () => {
    for (const [status, code, type] of [
      [400, 190, TokenExpiredError],
      [429, 4, RateLimitedError],
      [503, 2, TransientError],
      [400, 100, PermanentError],
    ] as const) {
      const { ctx } = setup(() =>
        json({ error: { code, message: 'fixture-secret' } }, status),
      );
      const error = await assertRejects(
        () => instagramCollector.fetchAccount(ctx),
        type,
      );
      assert(!error.message.includes('fixture-secret'));
    }
    const { ctx } = setup(() => {
      throw new Error('fixture-secret');
    });
    await assertRejects(
      () => instagramCollector.fetchAccount(ctx),
      TransientError,
    );
  },
);
Deno.test(
  'Instagram silinmiş medya NULL; HTML veya bozuk data reddedilir',
  async () => {
    const missing = setup(() =>
      json({ error: { code: 100, error_subcode: 33 } }, 400),
    );
    assertEquals(
      await instagramCollector.fetchPostMetrics(missing.ctx, post),
      null,
    );
    const broken = setup(() => new Response('not JSON'));
    await assertRejects(
      () => instagramCollector.fetchPosts(broken.ctx, { since: null }),
      PermanentError,
    );
    const data = setup(() => json({ data: {} }));
    await assertRejects(
      () => instagramCollector.fetchPosts(data.ctx, { since: null }),
      PermanentError,
    );
  },
);
Deno.test(
  'Instagram orkestratörü tekrar çalışınca aynı postu çoğaltmaz',
  async () => {
    const { ctx } = setup((u) =>
      json(u.searchParams.has('after') ? page2 : page1),
    );
    const store = new MemoryStore();
    store.accounts.push(ctx.account);
    store.tokens.set(ctx.account.id, ctx.token);
    const deps = {
      store,
      collectors: { instagram: instagramCollector },
      fetch: ctx.fetch,
      now: () => NOW,
      sleep: () => Promise.resolve(),
      log: () => {},
    };
    await runSync('posts', deps);
    await runSync('posts', deps);
    assertEquals(store.posts.length, 2);
  },
);
