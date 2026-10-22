import { assert, assertEquals, assertFalse, assertRejects } from '@std/assert';
import {
  PermanentError,
  RateLimitedError,
  TokenExpiredError,
  TransientError,
} from '../collectors/types.ts';
import {
  createPublishFetch,
  jsonResponse,
  type PublishResponder,
} from './fake-fetch.ts';
import { createInstagramPublisher, instagramError } from './instagram.ts';
import type {
  PublishCheckpoint,
  PublishContext,
  PublishInput,
} from './types.ts';

const TOKEN = 'IGQV-SECRET-ACCESS-TOKEN';
const VIDEO_URL =
  'https://ref.supabase.co/storage/v1/object/sign/assets/final.mp4?token=SIGNED';
const V = '/v23.0';
const LIMIT = `GET ${V}/178414/content_publishing_limit`;
const CREATE = `POST ${V}/178414/media`;
const LIST = `GET ${V}/178414/media`;
const STATUS = `GET ${V}/container-1`;
const PUBLISH = `POST ${V}/178414/media_publish`;
const MEDIA = `GET ${V}/media-1`;
const NOW = new Date('2026-10-22T10:00:00Z');

function input(extra: Partial<PublishInput> = {}): PublishInput {
  return {
    jobId: 'job-1',
    account: { id: 'acc-1', platform: 'instagram', externalId: '178414' },
    title: 'Başlık',
    caption: 'Reels açıklaması',
    tags: [],
    paidPartnership: false,
    video: {
      url: VIDEO_URL,
      mimeType: 'video/mp4',
      sizeBytes: 10,
      width: 1080,
      height: 1920,
      durationMs: 20000,
    },
    containerId: null,
    containerCreatedAt: null,
    uploadUrl: null,
    ...extra,
  };
}

function setup(
  routes: Record<string, PublishResponder | PublishResponder[]>,
  now = NOW,
) {
  const fake = createPublishFetch(routes);
  const checkpoints: PublishCheckpoint[] = [];
  const ctx: PublishContext = {
    token: { accessToken: TOKEN },
    fetch: fake.fetch,
    now,
    loadVideo: () => Promise.reject(new Error('Instagram baytları indirmez')),
    checkpoint: (s) => {
      checkpoints.push(s);
      return Promise.resolve();
    },
    warn: () => {},
  };
  return { ...fake, ctx, checkpoints };
}

const limitOk: PublishResponder = () =>
  jsonResponse({
    data: [
      { quota_usage: 3, config: { quota_total: 100, quota_duration: 86400 } },
    ],
  });
const status =
  (code: string, extra: Record<string, unknown> = {}): PublishResponder =>
  () =>
    jsonResponse({ status_code: code, id: 'container-1', ...extra });

Deno.test(
  'Instagram: container oluşturur (Reels + AI etiketi), checkpoint yazar, beklemeye geçer',
  async () => {
    const t = setup({
      [LIMIT]: limitOk,
      [CREATE]: () => jsonResponse({ id: 'container-1' }),
    });
    const out = await createInstagramPublisher().publish(t.ctx, input());
    assertEquals(out, { kind: 'pending', retryAfterSeconds: 60 });
    assertEquals(t.checkpoints, [
      { containerId: 'container-1', containerCreatedAt: NOW },
    ]);
    const create = t.calls[1];
    assertEquals(create.url.hostname, 'graph.instagram.com');
    const form = new URLSearchParams(String(create.body));
    assertEquals(form.get('media_type'), 'REELS');
    assertEquals(form.get('video_url'), VIDEO_URL);
    assertEquals(form.get('caption'), 'Reels açıklaması');
    assertEquals(
      form.get('is_ai_generated'),
      'true',
      'AI etiketi her zaman açık (#32)',
    );
    assertEquals(form.get('share_to_feed'), 'true');
    for (const c of t.calls) {
      assertEquals(c.headers.get('authorization'), `Bearer ${TOKEN}`);
      assertFalse(c.url.toString().includes(TOKEN), 'token URL’de yok');
    }
  },
);

Deno.test(
  'Instagram: container yaşam döngüsü IN_PROGRESS → FINISHED → media_publish → post',
  async () => {
    const t = setup({
      [STATUS]: [status('IN_PROGRESS'), status('FINISHED')],
      [PUBLISH]: () => jsonResponse({ id: 'media-1' }),
      [MEDIA]: () =>
        jsonResponse({
          id: 'media-1',
          permalink: 'https://www.instagram.com/reel/abc/',
          timestamp: '2026-10-22T10:02:00+0000',
        }),
    });
    const publisher = createInstagramPublisher();
    const existing = input({
      containerId: 'container-1',
      containerCreatedAt: new Date(NOW.getTime() - 60_000),
    });
    assertEquals(await publisher.publish(t.ctx, existing), {
      kind: 'pending',
      retryAfterSeconds: 60,
    });
    const out = await publisher.publish(t.ctx, existing);
    assertEquals(out, {
      kind: 'published',
      externalId: 'media-1',
      url: 'https://www.instagram.com/reel/abc/',
      publishedAt: new Date('2026-10-22T10:02:00Z'),
      durationS: null,
      isShort: true,
    });
    assertEquals(
      new URLSearchParams(String(t.calls[2].body)).get('creation_id'),
      'container-1',
    );
    assertEquals(
      t.calls.filter(
        (c) => c.method === 'POST' && c.url.pathname.endsWith('/media'),
      ).length,
      0,
      'yeni container yok',
    );
  },
);

Deno.test(
  'Instagram: PUBLISHED container (yanıt kaybolmuş) tekrar yayınlanmaz, son medyadan bulunur',
  async () => {
    const t = setup({
      [STATUS]: status('PUBLISHED'),
      [PUBLISH]: () => new Error('ikinci media_publish olmamalı'),
      [LIST]: () =>
        jsonResponse({
          data: [
            {
              id: 'old',
              caption: 'Reels açıklaması',
              timestamp: '2026-10-01T10:00:00+0000',
            },
            {
              id: 'media-9',
              caption: 'Reels açıklaması',
              permalink: 'https://www.instagram.com/reel/z/',
              timestamp: '2026-10-22T10:01:00+0000',
            },
          ],
        }),
    });
    const out = await createInstagramPublisher().publish(
      t.ctx,
      input({
        containerId: 'container-1',
        containerCreatedAt: new Date(NOW.getTime() - 120_000),
      }),
    );
    assertEquals(out.kind === 'published' && out.externalId, 'media-9');

    const none = setup({
      [STATUS]: status('PUBLISHED'),
      [LIST]: () => jsonResponse({ data: [] }),
    });
    const manual = await createInstagramPublisher().publish(
      none.ctx,
      input({ containerId: 'container-1', containerCreatedAt: NOW }),
    );
    assertEquals(manual.kind, 'manual_required');
  },
);

Deno.test(
  'Instagram: EXPIRED container sıfırlanır (geçici), ERROR kalıcı, uzun işleme zaman aşımı',
  async () => {
    const expired = setup({ [STATUS]: status('EXPIRED') });
    await assertRejects(
      () =>
        createInstagramPublisher().publish(
          expired.ctx,
          input({ containerId: 'container-1', containerCreatedAt: NOW }),
        ),
      TransientError,
    );
    assertEquals(expired.checkpoints, [
      { containerId: null, containerCreatedAt: null },
    ]);

    const error = setup({
      [STATUS]: status('ERROR', {
        status: 'Error: unsupported codec https://x.example/a?token=1',
      }),
    });
    const err = await assertRejects(
      () =>
        createInstagramPublisher().publish(
          error.ctx,
          input({ containerId: 'container-1', containerCreatedAt: NOW }),
        ),
      PermanentError,
    );
    assertFalse(
      err.message.includes('token=1'),
      'durum metnindeki URL temizlenir',
    );

    const slow = setup({ [STATUS]: status('IN_PROGRESS') });
    await assertRejects(
      () =>
        createInstagramPublisher().publish(
          slow.ctx,
          input({
            containerId: 'container-1',
            containerCreatedAt: new Date(NOW.getTime() - 31 * 60_000),
          }),
        ),
      PermanentError,
    );
  },
);

Deno.test(
  'Instagram: 24 saatlik yayın limiti doluysa container açılmaz (rate limit)',
  async () => {
    const t = setup({
      [LIMIT]: () =>
        jsonResponse({
          data: [{ quota_usage: 100, config: { quota_total: 100 } }],
        }),
      [CREATE]: () => new Error('container açılmamalı'),
    });
    const err = await assertRejects(
      () => createInstagramPublisher().publish(t.ctx, input()),
      RateLimitedError,
    );
    assertEquals((err as RateLimitedError).retryAfterSeconds, 3600);
  },
);

Deno.test(
  'Instagram hata eşlemesi: token, izin, limit, rate, geçici, kalıcı',
  () => {
    const r = (status: number, error: Record<string, unknown>) =>
      [new Response(null, { status }), { error }] as const;
    const map = (status: number, error: Record<string, unknown>) =>
      instagramError(
        ...r(status, { message: `secret ${TOKEN}`, ...error }),
        'Instagram',
        NOW,
      );

    const expired = map(400, { code: 190, error_subcode: 463 });
    assert(
      expired instanceof TokenExpiredError &&
        expired.accountStatus === 'expired',
    );
    const revoked = map(400, { code: 190, error_subcode: 460 });
    assert(
      revoked instanceof TokenExpiredError && revoked.accountStatus === 'error',
    );
    const permission = map(403, { code: 10 });
    assert(
      permission instanceof TokenExpiredError &&
        permission.accountStatus === 'error',
    );
    assert(
      map(400, { code: 9, error_subcode: 2207042 }) instanceof RateLimitedError,
    );
    assert(map(400, { code: 4 }) instanceof RateLimitedError);
    assert(map(429, {}) instanceof RateLimitedError);
    assert(map(500, { code: 2 }) instanceof TransientError);
    const permanent = map(400, { code: 100, error_subcode: 2207026 });
    assert(permanent instanceof PermanentError);
    assertEquals(
      permanent.message,
      'Instagram: istek reddedildi (400, code 100/2207026)',
    );
    for (const e of [expired, permanent])
      assertFalse(e.message.includes(TOKEN), 'sağlayıcı mesajı yazılmaz');
  },
);

Deno.test(
  'Instagram: externalId yoksa /me kullanılır; ağ hatası geçici',
  async () => {
    const t = setup({
      [`GET ${V}/me/content_publishing_limit`]: limitOk,
      [`POST ${V}/me/media`]: () => new TypeError('reset'),
    });
    await assertRejects(
      () =>
        createInstagramPublisher().publish(
          t.ctx,
          input({
            account: { id: 'a', platform: 'instagram', externalId: null },
          }),
        ),
      TransientError,
    );
  },
);
