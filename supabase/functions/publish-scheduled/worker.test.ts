import { assert, assertEquals, assertFalse } from '@std/assert';
import {
  PermanentError,
  RateLimitedError,
  type SocialToken,
  TokenExpiredError,
  TransientError,
} from '../_shared/collectors/types.ts';
import { CHECKLIST_KEYS } from '../_shared/publishers/checklist.ts';
import { PLATFORM_CAPABILITIES } from '../_shared/publishers/config.ts';
import type {
  PublishContext,
  Publisher,
  PublishInput,
  PublishOutcome,
  PublishPlatform,
} from '../_shared/publishers/types.ts';
import {
  backoffSeconds,
  type JobContext,
  type JobPatch,
  MESSAGES,
  type PublishJob,
  type PublishStore,
  runPublishWorker,
} from './worker.ts';

const T0 = new Date('2026-10-22T10:00:00Z');
const TOKEN = 'SECRET-ACCESS-TOKEN-123';
const SIGNED =
  'https://ref.supabase.co/storage/v1/object/sign/assets/v.mp4?token=SIGNEDXYZ';

const ready = {
  items: Object.fromEntries(CHECKLIST_KEYS.map((k) => [k, true])),
  hookScore: 4,
  engagementScore: 4,
  decision: 'ready',
};

type Row = PublishJob & {
  next_attempt_at: string;
  error: string | null;
  post?: string;
};

/** claim_publish_jobs / complete_publish_job davranışının bellek içi karşılığı. */
class MemoryStore implements PublishStore {
  rows = new Map<string, Row>();
  context_: JobContext = {
    checklist: ready,
    account: {
      id: 'acc-1',
      externalId: 'ext-1',
      status: 'active',
      connected: true,
    },
    asset: {
      storagePath: 'inf/final.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 10,
      width: 1080,
      height: 1920,
      durationMs: 20000,
    },
  };
  token: SocialToken | null = { accessToken: TOKEN };
  accountStatus: string[] = [];
  completed: string[] = [];
  constructor(private readonly now: () => Date) {}

  add(id: string, extra: Partial<Row> = {}) {
    this.rows.set(id, {
      id,
      content_item_id: 'content-1',
      account_id: 'acc-1',
      asset_id: 'asset-1',
      platform: 'youtube',
      status: 'queued',
      title: 'Başlık',
      caption: 'Açıklama',
      tags: [],
      paid_partnership: false,
      attempts: 0,
      max_attempts: 5,
      provider_container_id: null,
      provider_upload_url: null,
      container_created_at: null,
      next_attempt_at: this.now().toISOString(),
      error: null,
      ...extra,
    });
  }
  get(id: string) {
    return this.rows.get(id)!;
  }
  claim(limit: number, lease: number) {
    const due = [...this.rows.values()]
      .filter(
        (r) =>
          ['queued', 'processing'].includes(r.status) &&
          new Date(r.next_attempt_at) <= this.now(),
      )
      .slice(0, limit);
    for (const r of due) {
      r.status = 'processing';
      r.next_attempt_at = new Date(
        this.now().getTime() + lease * 1000,
      ).toISOString();
    }
    return Promise.resolve(due.map((r) => ({ ...r })));
  }
  context() {
    return Promise.resolve(this.context_);
  }
  readToken() {
    return Promise.resolve(this.token);
  }
  signedUrl() {
    return Promise.resolve(SIGNED);
  }
  download() {
    return Promise.resolve(new Uint8Array([1, 2, 3]));
  }
  update(id: string, patch: JobPatch) {
    const r = this.get(id);
    if (r.status === 'processing') Object.assign(r, patch);
    return Promise.resolve();
  }
  complete(id: string, result: { externalId: string }) {
    const r = this.get(id);
    this.completed.push(id);
    r.status = 'published';
    r.post = result.externalId;
    return Promise.resolve();
  }
  setAccountStatus(_id: string, status: 'expired' | 'error') {
    this.accountStatus.push(status);
    return Promise.resolve();
  }
}

class ScriptedPublisher implements Publisher {
  calls: PublishInput[] = [];
  constructor(
    readonly platform: PublishPlatform,
    private readonly script: (
      ctx: PublishContext,
      input: PublishInput,
      n: number,
    ) => Promise<PublishOutcome>,
    readonly capabilities = PLATFORM_CAPABILITIES[platform],
  ) {}
  publish(ctx: PublishContext, input: PublishInput) {
    this.calls.push(input);
    return this.script(ctx, input, this.calls.length);
  }
}

const published: PublishOutcome = {
  kind: 'published',
  externalId: 'vid-1',
  url: 'https://www.youtube.com/shorts/vid-1',
  publishedAt: T0,
  durationS: 20,
  isShort: true,
};

function harness(
  script: (
    ctx: PublishContext,
    input: PublishInput,
    n: number,
  ) => Promise<PublishOutcome>,
  platform: PublishPlatform = 'youtube',
) {
  let clock = T0;
  const now = () => clock;
  const store = new MemoryStore(now);
  const publisher = new ScriptedPublisher(platform, script);
  const run = () =>
    runPublishWorker({
      store,
      publishers: { [platform]: publisher },
      now,
      backoffBaseSeconds: 60,
    });
  const advance = (seconds: number) => {
    clock = new Date(clock.getTime() + seconds * 1000);
  };
  return { store, publisher, run, advance };
}

Deno.test(
  'başarılı yayın: iş kapılır, yayıncı çağrılır, complete ile posts bağlanır',
  async () => {
    const h = harness(() => Promise.resolve(published));
    h.store.add('j1');
    const result = await h.run();
    assertEquals(result, { claimed: 1, outcomes: { j1: 'published' } });
    assertEquals(h.store.get('j1').status, 'published');
    assertEquals(h.store.get('j1').post, 'vid-1');
    const call = h.publisher.calls[0];
    assertEquals(
      call.video.url,
      '',
      'YouTube imzalı adres istemez (baytlar indirilir)',
    );
    assertEquals(call.account.externalId, 'ext-1');
  },
);

Deno.test(
  'yayın anında check-list eksikse iş manual_required olur (failed değil), yayıncı çağrılmaz',
  async () => {
    const h = harness(() => Promise.resolve(published));
    h.store.add('j1');
    h.store.context_ = {
      ...h.store.context_,
      checklist: { ...ready, items: { ...ready.items, ai_disclosure: false } },
    };
    assertEquals((await h.run()).outcomes.j1, 'manual_required');
    assertEquals(h.store.get('j1').status, 'manual_required');
    assertEquals(h.store.get('j1').error, MESSAGES.checklist);
    assertEquals(h.publisher.calls.length, 0);
  },
);

Deno.test(
  'ücretli ortaklık Instagram API ile verilemiyor → manual_required',
  async () => {
    const h = harness(() => Promise.resolve(published), 'instagram');
    h.store.add('j1', { platform: 'instagram', paid_partnership: true });
    assertEquals((await h.run()).outcomes.j1, 'manual_required');
    assertEquals(h.store.get('j1').error, MESSAGES.paidPartnership);
    assertEquals(h.publisher.calls.length, 0);
  },
);

Deno.test(
  '5xx/rate limit: attempts+1, next_attempt_at üstel artar; max denemede failed',
  async () => {
    const h = harness(() =>
      Promise.reject(new TransientError('YouTube: geçici hata (503)')),
    );
    h.store.add('j1', { max_attempts: 3 });
    assertEquals((await h.run()).outcomes.j1, 'retry');
    let row = h.store.get('j1');
    assertEquals(row.attempts, 1);
    assertEquals(row.status, 'processing');
    assertEquals(
      row.next_attempt_at,
      new Date(T0.getTime() + 60_000).toISOString(),
    );

    h.advance(60);
    assertEquals((await h.run()).outcomes.j1, 'retry');
    row = h.store.get('j1');
    assertEquals(row.attempts, 2);
    assertEquals(
      row.next_attempt_at,
      new Date(T0.getTime() + 60_000 + 120_000).toISOString(),
    );

    h.advance(120);
    assertEquals((await h.run()).outcomes.j1, 'failed');
    assertEquals(h.store.get('j1').status, 'failed');
    assert(h.store.get('j1').error?.startsWith('3 denemede yayınlanamadı'));
    assertEquals(backoffSeconds(1), 60);
    assertEquals(backoffSeconds(10), 3600);
  },
);

Deno.test('rate limit Retry-After daha uzunsa o kadar beklenir', async () => {
  const h = harness(() => Promise.reject(new RateLimitedError('limit', 3600)));
  h.store.add('j1');
  assertEquals((await h.run()).outcomes.j1, 'retry');
  assertEquals(
    h.store.get('j1').next_attempt_at,
    new Date(T0.getTime() + 3600_000).toISOString(),
  );
});

Deno.test(
  'token hatası: hesap durumu güncellenir, iş tekrar denenmeden failed',
  async () => {
    const h = harness(() =>
      Promise.reject(new TokenExpiredError('YouTube: yetki reddedildi (401)')),
    );
    h.store.add('j1');
    assertEquals((await h.run()).outcomes.j1, 'failed');
    assertEquals(h.store.accountStatus, ['expired']);
    assertEquals(h.store.get('j1').attempts, 0);
    assert(h.store.get('j1').error?.startsWith('Token:'));

    const missing = harness(() => Promise.resolve(published));
    missing.store.add('j2');
    missing.store.token = null;
    assertEquals((await missing.run()).outcomes.j2, 'failed');
    assertEquals(missing.store.accountStatus, ['error']);
    assertEquals(missing.publisher.calls.length, 0);
  },
);

Deno.test('kalıcı hata ve bağlı olmayan hesap tekrar denenmez', async () => {
  const h = harness(() =>
    Promise.reject(new PermanentError('YouTube: istek reddedildi (400)')),
  );
  h.store.add('j1');
  assertEquals((await h.run()).outcomes.j1, 'failed');

  const off = harness(() => Promise.resolve(published));
  off.store.add('j2');
  off.store.context_ = {
    ...off.store.context_,
    account: {
      id: 'acc-1',
      externalId: null,
      status: 'expired',
      connected: true,
    },
  };
  assertEquals((await off.run()).outcomes.j2, 'failed');
  assertEquals(off.store.get('j2').error, MESSAGES.notConnected);

  const novideo = harness(() => Promise.resolve(published));
  novideo.store.add('j3');
  novideo.store.context_ = { ...novideo.store.context_, asset: null };
  assertEquals((await novideo.run()).outcomes.j3, 'failed');
  assertEquals(novideo.store.get('j3').error, MESSAGES.noVideo);
});

Deno.test(
  'Instagram container işleniyor: pending, checkpoint kalıcı, attempts artmaz; sonraki çalıştırmada yayın',
  async () => {
    const h = harness(async (ctx, input, n) => {
      if (n === 1) {
        assertEquals(
          input.video.url,
          SIGNED,
          'Instagram imzalı Storage adresini alır',
        );
        await ctx.checkpoint({
          containerId: 'c-1',
          containerCreatedAt: ctx.now,
        });
        return { kind: 'pending', retryAfterSeconds: 60 };
      }
      assertEquals(input.containerId, 'c-1', 'aynı container ile devam');
      return { ...published, externalId: 'media-1' };
    }, 'instagram');
    h.store.add('j1', { platform: 'instagram' });
    assertEquals((await h.run()).outcomes.j1, 'pending');
    const row = h.store.get('j1');
    assertEquals(
      [row.status, row.attempts, row.provider_container_id],
      ['processing', 0, 'c-1'],
    );
    assertEquals(row.container_created_at, T0.toISOString());
    assertEquals(
      row.next_attempt_at,
      new Date(T0.getTime() + 60_000).toISOString(),
    );

    assertEquals(
      (await h.run()).claimed,
      0,
      'bekleme süresi dolmadan tekrar alınmaz',
    );
    h.advance(60);
    assertEquals((await h.run()).outcomes.j1, 'published');
    assertEquals(h.store.get('j1').post, 'media-1');
  },
);

Deno.test('eşzamanlı iki çalıştırmada aynı iş tek kez yayınlanır', async () => {
  const h = harness(async () => {
    await new Promise((r) => setTimeout(r, 5));
    return published;
  });
  h.store.add('j1');
  const [a, b] = await Promise.all([h.run(), h.run()]);
  assertEquals(a.claimed + b.claimed, 1);
  assertEquals(h.publisher.calls.length, 1);
  assertEquals(h.store.completed, ['j1']);
});

Deno.test('hata metninde token ve imzalı adres yazılmaz', async () => {
  const h = harness(
    () => Promise.reject(new TransientError(`ağ: Bearer ${TOKEN} ${SIGNED}`)),
    'instagram',
  );
  h.store.add('j1', { platform: 'instagram' });
  await h.run();
  const error = h.store.get('j1').error ?? '';
  assertFalse(error.includes(TOKEN));
  assertFalse(error.includes('SIGNEDXYZ'));
});

Deno.test(
  'TikTok (yayıncısı yok) failed; beklenmeyen hata geçici sayılır',
  async () => {
    const h = harness(() => Promise.resolve(published));
    h.store.add('j1', { platform: 'tiktok' });
    assertEquals((await h.run()).outcomes.j1, 'failed');
    assertEquals(h.store.get('j1').error, MESSAGES.unsupported);

    const boom = harness(() => Promise.reject(new Error('storage timeout')));
    boom.store.add('j2');
    assertEquals((await boom.run()).outcomes.j2, 'retry');
    assertEquals(boom.store.get('j2').attempts, 1);
  },
);
