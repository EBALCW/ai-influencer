import { assert, assertEquals, assertFalse, assertRejects } from '@std/assert';
import {
  PermanentError,
  RateLimitedError,
  TokenExpiredError,
  TransientError,
} from '../collectors/types.ts';
import quotaExceeded from '../youtube/fixtures/error.quotaExceeded.json' with { type: 'json' };
import unauthorized from '../youtube/fixtures/error.unauthorized.json' with { type: 'json' };
import backendError from '../youtube/fixtures/error.backendError.json' with { type: 'json' };
import { DEFAULT_PUBLISH_CONFIG } from './config.ts';
import {
  createPublishFetch,
  jsonResponse,
  type PublishResponder,
} from './fake-fetch.ts';
import type {
  PublishCheckpoint,
  PublishContext,
  PublishInput,
} from './types.ts';
import {
  createYoutubePublisher,
  isShortVideo,
  youtubeDescription,
  youtubeTags,
  youtubeTitle,
} from './youtube.ts';

const TOKEN = 'ya29.SECRET-ACCESS-TOKEN';
const SESSION =
  'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&upload_id=SESSION1';
const UPLOAD = 'POST /upload/youtube/v3/videos';
const PUT = 'PUT /upload/youtube/v3/videos';
const NOW = new Date('2026-10-22T10:00:00Z');
const BYTES = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

function input(extra: Partial<PublishInput> = {}): PublishInput {
  return {
    jobId: 'job-1',
    account: { id: 'acc-1', platform: 'youtube', externalId: 'UC123' },
    title: 'Sabah <rutini>',
    caption: 'Yeni gün',
    tags: ['#ai', 'günlük'],
    paidPartnership: false,
    video: {
      url: '',
      mimeType: 'video/mp4',
      sizeBytes: BYTES.byteLength,
      width: 1080,
      height: 1920,
      durationMs: 21500,
    },
    containerId: null,
    containerCreatedAt: null,
    uploadUrl: null,
    ...extra,
  };
}

function setup(routes: Record<string, PublishResponder | PublishResponder[]>) {
  const fake = createPublishFetch(routes);
  const checkpoints: PublishCheckpoint[] = [];
  let downloads = 0;
  const ctx: PublishContext = {
    token: { accessToken: TOKEN },
    fetch: fake.fetch,
    now: NOW,
    loadVideo: () => {
      downloads++;
      return Promise.resolve(BYTES);
    },
    checkpoint: (s) => {
      checkpoints.push(s);
      return Promise.resolve();
    },
    warn: () => {},
  };
  return { ...fake, ctx, checkpoints, downloads: () => downloads };
}

const created: PublishResponder = () =>
  new Response(null, { status: 200, headers: { location: SESSION } });
const done =
  (id = 'vid-1'): PublishResponder =>
  () =>
    jsonResponse({ id, snippet: { publishedAt: '2026-10-22T10:00:05Z' } }, 200);

Deno.test(
  'YouTube: resumable upload — oturum aç, checkpoint, baytları gönder',
  async () => {
    const t = setup({ [UPLOAD]: created, [PUT]: done() });
    const out = await createYoutubePublisher().publish(t.ctx, input());

    assertEquals(out, {
      kind: 'published',
      externalId: 'vid-1',
      url: 'https://www.youtube.com/shorts/vid-1',
      publishedAt: new Date('2026-10-22T10:00:05Z'),
      durationS: 21.5,
      isShort: true,
    });
    assertEquals(
      t.calls.map((c) => c.method),
      ['POST', 'PUT'],
    );
    const [init, put] = t.calls;
    assertEquals(init.url.searchParams.get('uploadType'), 'resumable');
    assertEquals(
      init.url.searchParams.get('part'),
      'snippet,status,paidProductPlacementDetails',
    );
    assertEquals(init.headers.get('x-upload-content-length'), '10');
    assertEquals(init.headers.get('x-upload-content-type'), 'video/mp4');
    const meta = JSON.parse(String(init.body));
    assertEquals(
      meta.status.containsSyntheticMedia,
      true,
      'AI açıklaması her zaman açık (#32)',
    );
    assertEquals(meta.status.selfDeclaredMadeForKids, false);
    assertEquals(meta.status.privacyStatus, 'public');
    assertEquals(meta.paidProductPlacementDetails, {
      hasPaidProductPlacement: false,
    });
    assertEquals(meta.snippet.title, 'Sabah rutini');
    assertEquals(meta.snippet.description, 'Yeni gün\n\n#Shorts');
    assertEquals(meta.snippet.tags, ['ai', 'günlük']);
    assertEquals(put.url.toString(), SESSION);
    assertEquals(put.body, BYTES);
    assertEquals(put.headers.get('content-range'), null);
    // Oturum PUT'tan ÖNCE kalıcı yazılır.
    assertEquals(t.checkpoints, [{ uploadUrl: SESSION }]);
    for (const c of t.calls) {
      assertEquals(c.headers.get('authorization'), `Bearer ${TOKEN}`);
      assertFalse(c.url.toString().includes(TOKEN), 'token URL’de yok');
    }
  },
);

Deno.test(
  'YouTube: ücretli ortaklık ve gizlilik ayarı metadata’ya gider',
  async () => {
    const t = setup({ [UPLOAD]: created, [PUT]: done() });
    const config = structuredClone(DEFAULT_PUBLISH_CONFIG);
    config.youtube.privacyStatus = 'private';
    await createYoutubePublisher(config).publish(
      t.ctx,
      input({ paidPartnership: true }),
    );
    const meta = JSON.parse(String(t.calls[0].body));
    assertEquals(
      meta.paidProductPlacementDetails.hasPaidProductPlacement,
      true,
    );
    assertEquals(meta.status.privacyStatus, 'private');
  },
);

Deno.test(
  'YouTube: yarım kalan oturum kalan baytlardan devam eder (çift yükleme yok)',
  async () => {
    const t = setup({
      [UPLOAD]: () => new Error('yeni oturum açılmamalı'),
      [PUT]: [
        (c) => {
          assertEquals(c.headers.get('content-range'), 'bytes */10');
          return new Response(null, {
            status: 308,
            headers: { range: 'bytes=0-4' },
          });
        },
        (c) => {
          assertEquals(c.headers.get('content-range'), 'bytes 5-9/10');
          assertEquals(c.body, BYTES.subarray(5));
          return jsonResponse({ id: 'vid-2' }, 201);
        },
      ],
    });
    const out = await createYoutubePublisher().publish(
      t.ctx,
      input({ uploadUrl: SESSION }),
    );
    assertEquals(out.kind === 'published' && out.externalId, 'vid-2');
    assertEquals(
      t.calls.map((c) => c.method),
      ['PUT', 'PUT'],
    );
    assertEquals(t.checkpoints, []);
  },
);

Deno.test(
  'YouTube: yükleme önceki çalıştırmada bitmişse aynı video döner (idempotent)',
  async () => {
    const t = setup({
      [UPLOAD]: () => new Error('yeni oturum açılmamalı'),
      [PUT]: [done('vid-3'), () => new Error('ikinci PUT olmamalı')],
    });
    const out = await createYoutubePublisher().publish(
      t.ctx,
      input({ uploadUrl: SESSION }),
    );
    assertEquals(out.kind === 'published' && out.externalId, 'vid-3');
    assertEquals(t.calls.length, 1);
  },
);

Deno.test(
  'YouTube: düşmüş oturum (404) yeniden açılır; güvenilmeyen host yok sayılır',
  async () => {
    const t = setup({
      [UPLOAD]: created,
      [PUT]: [() => new Response(null, { status: 404 }), done('vid-4')],
    });
    const out = await createYoutubePublisher().publish(
      t.ctx,
      input({ uploadUrl: SESSION }),
    );
    assertEquals(out.kind === 'published' && out.externalId, 'vid-4');
    assertEquals(
      t.calls.map((c) => c.method),
      ['PUT', 'POST', 'PUT'],
    );

    const evil = setup({ [UPLOAD]: created, [PUT]: done('vid-5') });
    await createYoutubePublisher().publish(
      evil.ctx,
      input({ uploadUrl: 'https://evil.example/upload/youtube/v3/videos?x=1' }),
    );
    assert(
      evil.calls.every((c) => c.url.hostname === 'www.googleapis.com'),
      'token başka hosta gitmez',
    );
  },
);

Deno.test(
  'YouTube: oturum yanıtında Location yoksa veya yabancı hostsa kalıcı hata',
  async () => {
    for (const location of [null, 'https://evil.example/x']) {
      const t = setup({
        [UPLOAD]: () =>
          new Response(null, {
            status: 200,
            headers: location ? { location } : {},
          }),
      });
      await assertRejects(
        () => createYoutubePublisher().publish(t.ctx, input()),
        PermanentError,
      );
    }
  },
);

Deno.test(
  'YouTube: hata eşlemesi (token, kota, geçici, kalıcı, ağ) ve token sızmaz',
  async () => {
    const cases: Array<
      [
        PublishResponder,
        (
          | typeof TokenExpiredError
          | typeof RateLimitedError
          | typeof TransientError
          | typeof PermanentError
        ),
      ]
    > = [
      [() => jsonResponse(unauthorized, 401), TokenExpiredError],
      [() => jsonResponse(quotaExceeded, 403), RateLimitedError],
      [() => jsonResponse(backendError, 503), TransientError],
      [
        () =>
          jsonResponse(
            { error: { code: 400, errors: [{ reason: 'invalidTitle' }] } },
            400,
          ),
        PermanentError,
      ],
      [() => new TypeError('connection reset'), TransientError],
    ];
    for (const [responder, type] of cases) {
      const t = setup({ [UPLOAD]: responder });
      const err = await assertRejects(
        () => createYoutubePublisher().publish(t.ctx, input()),
        type,
      );
      assertFalse(err.message.includes(TOKEN));
    }
    const quota = setup({ [UPLOAD]: () => jsonResponse(quotaExceeded, 403) });
    const q = await assertRejects(
      () => createYoutubePublisher().publish(quota.ctx, input()),
      RateLimitedError,
    );
    assertEquals((q as RateLimitedError).scope, 'platform');
  },
);

Deno.test(
  'YouTube: PUT 5xx geçici hata; oturum korunur ve sonraki çalıştırma devam eder',
  async () => {
    const t = setup({
      [UPLOAD]: created,
      [PUT]: () => jsonResponse(backendError, 503),
    });
    await assertRejects(
      () => createYoutubePublisher().publish(t.ctx, input()),
      TransientError,
    );
    assertEquals(t.checkpoints, [{ uploadUrl: SESSION }]);
  },
);

Deno.test(
  'YouTube: yatay uzun video normal video olarak yüklenir',
  async () => {
    const t = setup({ [UPLOAD]: created, [PUT]: done('vid-6') });
    const out = await createYoutubePublisher().publish(
      t.ctx,
      input({
        video: {
          ...input().video,
          width: 1920,
          height: 1080,
          durationMs: 600000,
        },
      }),
    );
    assertEquals(
      out.kind === 'published' && out.url,
      'https://www.youtube.com/watch?v=vid-6',
    );
    assertEquals(
      JSON.parse(String(t.calls[0].body)).snippet.description,
      'Yeni gün',
    );
  },
);

Deno.test('YouTube metin yardımcıları', () => {
  assertEquals(youtubeTitle('   '), 'Video');
  assertEquals(youtubeTitle('x'.repeat(150)).length, 100);
  assertEquals(
    youtubeDescription('Zaten #shorts', true, true),
    'Zaten #shorts',
  );
  assertEquals(youtubeTags(['a,b', '', '#c']), ['ab', 'c']);
  assertEquals(
    youtubeTags(Array.from({ length: 100 }, () => 'x'.repeat(20))).length < 30,
    true,
  );
  assert(
    isShortVideo({
      ...input().video,
      durationMs: null,
      width: null,
      height: null,
    }),
  );
  assertFalse(isShortVideo({ ...input().video, durationMs: 200000 }));
});
