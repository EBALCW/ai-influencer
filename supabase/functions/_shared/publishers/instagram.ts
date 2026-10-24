// Instagram Reels yayıncısı (#58): Instagram API with Instagram Login (graph.instagram.com).
//
// Akış birden çok cron çalıştırmasına yayılır:
//   1. container yok → yayın limitini oku (content_publishing_limit), Reels container oluştur
//      (media_type=REELS, video_url = kısa ömürlü imzalı Storage adresi, is_ai_generated=true),
//      id'yi hemen checkpoint'e yaz → pending.
//   2. container var → status_code: IN_PROGRESS → pending; FINISHED → media_publish → post;
//      PUBLISHED → (önceki çalıştırma yayınladı ama yanıt kayboldu) son medyalardan bul;
//      EXPIRED → container sıfırlanır, yeniden oluşturulur; ERROR → kalıcı hata.
// Token `Authorization: Bearer` başlığında gider, URL'e yazılmaz.
import {
  type CollectorError,
  parseRetryAfter,
  PermanentError,
  RateLimitedError,
  TokenExpiredError,
  TransientError,
} from '../collectors/types.ts';
import {
  DEFAULT_PUBLISH_CONFIG,
  PLATFORM_CAPABILITIES,
  type PublishConfig,
} from './config.ts';
import type {
  PublishContext,
  PublishInput,
  PublishOutcome,
  Publisher,
} from './types.ts';

type GraphError = { code?: unknown; error_subcode?: unknown };

/** Graph API hatası → tipli hata. Mesaja yalnız durum kodu ve Graph hata kodu yazılır. */
export function instagramError(
  response: Response,
  body: unknown,
  label: string,
  now: Date,
): CollectorError {
  const err = ((body as { error?: GraphError } | null)?.error ??
    {}) as GraphError;
  const code = typeof err.code === 'number' ? err.code : null;
  const sub = typeof err.error_subcode === 'number' ? err.error_subcode : null;
  const status = response.status;
  const tag = `${status}${code === null ? '' : `, code ${code}`}${sub === null ? '' : `/${sub}`}`;

  if (code === 190 || status === 401) {
    // 463 = süresi doldu; diğerleri (458 izin kaldırıldı, 460 şifre değişti …) iptal.
    return new TokenExpiredError(
      `${label}: token geçersiz (${tag})`,
      sub === 463 || sub === null ? 'expired' : 'error',
    );
  }
  if (code === 10 || (code !== null && code >= 200 && code <= 299)) {
    return new TokenExpiredError(`${label}: yayın izni yok (${tag})`, 'error');
  }
  if (code === 9 || sub === 2207042) {
    return new RateLimitedError(
      `${label}: 24 saatlik yayın limiti doldu (${tag})`,
      60 * 60,
      'account',
    );
  }
  if (status === 429 || (code !== null && [4, 17, 32, 613].includes(code))) {
    return new RateLimitedError(
      `${label}: rate limit (${tag})`,
      parseRetryAfter(response.headers.get('retry-after'), now),
      'account',
    );
  }
  if (status >= 500 || status === 408 || code === 1 || code === 2) {
    return new TransientError(`${label}: geçici hata (${tag})`);
  }
  return new PermanentError(`${label}: istek reddedildi (${tag})`);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

type Json = Record<string, unknown>;

export function createInstagramPublisher(
  config: PublishConfig = DEFAULT_PUBLISH_CONFIG,
): Publisher {
  const base = `${config.instagram.graphBase.replace(/\/$/, '')}/${config.instagram.version}`;

  async function call(
    ctx: PublishContext,
    label: string,
    path: string,
    init: { method?: 'GET' | 'POST'; query?: Json; form?: Json } = {},
  ): Promise<Json> {
    const url = new URL(`${base}/${path}`);
    for (const [k, v] of Object.entries(init.query ?? {})) {
      url.searchParams.set(k, String(v));
    }
    const headers: Record<string, string> = {
      authorization: `Bearer ${ctx.token.accessToken}`,
      accept: 'application/json',
    };
    let body: string | undefined;
    if (init.form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(
        Object.entries(init.form).map(([k, v]) => [k, String(v)]),
      ).toString();
    }
    let response: Response;
    try {
      response = await ctx.fetch(url.toString(), {
        method: init.method ?? 'GET',
        headers,
        body,
      });
    } catch {
      throw new TransientError(`${label}: ağ hatası`);
    }
    const json = await readJson(response);
    if (!response.ok) throw instagramError(response, json, label, ctx.now);
    if (!json || typeof json !== 'object') {
      throw new PermanentError(`${label}: beklenmeyen yanıt biçimi`);
    }
    return json as Json;
  }

  const userPath = (input: PublishInput) =>
    encodeURIComponent(input.account.externalId || 'me');

  async function checkLimit(ctx: PublishContext, input: PublishInput) {
    const body = await call(
      ctx,
      'Instagram content_publishing_limit',
      `${userPath(input)}/content_publishing_limit`,
      { query: { fields: 'quota_usage,config' } },
    );
    const row = (Array.isArray(body.data) ? body.data[0] : null) as Json | null;
    const usage = typeof row?.quota_usage === 'number' ? row.quota_usage : null;
    const total =
      typeof (row?.config as Json | undefined)?.quota_total === 'number'
        ? ((row!.config as Json).quota_total as number)
        : null;
    if (usage !== null && total !== null && usage >= total) {
      throw new RateLimitedError(
        `Instagram: 24 saatlik yayın limiti doldu (${usage}/${total})`,
        60 * 60,
        'account',
      );
    }
  }

  async function mediaDetails(
    ctx: PublishContext,
    mediaId: string,
  ): Promise<PublishOutcome> {
    const media = await call(
      ctx,
      'Instagram media',
      encodeURIComponent(mediaId),
      { query: { fields: 'id,permalink,timestamp' } },
    );
    return published(mediaId, media);
  }

  function published(mediaId: string, media: Json): PublishOutcome {
    const at =
      typeof media.timestamp === 'string' ? new Date(media.timestamp) : null;
    return {
      kind: 'published',
      externalId: mediaId,
      url:
        typeof media.permalink === 'string' &&
        /^https:\/\//.test(media.permalink)
          ? media.permalink
          : null,
      publishedAt: at && !Number.isNaN(at.getTime()) ? at : null,
      durationS: null,
      isShort: true,
    };
  }

  /** media_publish yanıtı kaybolduysa: container'dan sonra yayınlanan, aynı caption'lı medya. */
  async function recover(
    ctx: PublishContext,
    input: PublishInput,
  ): Promise<PublishOutcome> {
    const body = await call(
      ctx,
      'Instagram media list',
      `${userPath(input)}/media`,
      {
        query: { fields: 'id,caption,permalink,timestamp', limit: 10 },
      },
    );
    const since = (input.containerCreatedAt?.getTime() ?? 0) - 60_000;
    const match = (Array.isArray(body.data) ? (body.data as Json[]) : []).find(
      (m) =>
        typeof m.id === 'string' &&
        (m.caption ?? '') === input.caption &&
        typeof m.timestamp === 'string' &&
        Date.parse(m.timestamp) >= since,
    );
    if (match) return published(match.id as string, match);
    return {
      kind: 'manual_required',
      reason:
        'Instagram’da yayınlandı ama post kimliği alınamadı; postu içerik kartından elle eşleştirin.',
    };
  }

  return {
    platform: 'instagram',
    capabilities: PLATFORM_CAPABILITIES.instagram,
    async publish(ctx, input) {
      if (!input.containerId) {
        await checkLimit(ctx, input);
        const created = await call(
          ctx,
          'Instagram media',
          `${userPath(input)}/media`,
          {
            method: 'POST',
            form: {
              media_type: 'REELS',
              video_url: input.video.url,
              caption: input.caption,
              share_to_feed: config.instagram.shareToFeed,
              // #32: gerçekçi AI içerik her zaman etiketlenir.
              is_ai_generated: true,
            },
          },
        );
        const id = typeof created.id === 'string' ? created.id : null;
        if (!id)
          throw new PermanentError('Instagram media: yanıtta container id yok');
        await ctx.checkpoint({ containerId: id, containerCreatedAt: ctx.now });
        return {
          kind: 'pending',
          retryAfterSeconds: config.instagram.pollSeconds,
        };
      }

      const container = await call(
        ctx,
        'Instagram container',
        encodeURIComponent(input.containerId),
        { query: { fields: 'status_code,status' } },
      );
      const code =
        typeof container.status_code === 'string' ? container.status_code : '';
      if (code === 'FINISHED') {
        const done = await call(
          ctx,
          'Instagram media_publish',
          `${userPath(input)}/media_publish`,
          {
            method: 'POST',
            form: { creation_id: input.containerId },
          },
        );
        const mediaId = typeof done.id === 'string' ? done.id : null;
        if (!mediaId)
          throw new PermanentError(
            'Instagram media_publish: yanıtta media id yok',
          );
        return await mediaDetails(ctx, mediaId);
      }
      if (code === 'PUBLISHED') return await recover(ctx, input);
      if (code === 'EXPIRED') {
        await ctx.checkpoint({ containerId: null, containerCreatedAt: null });
        throw new TransientError(
          'Instagram container süresi doldu; yeniden oluşturulacak',
        );
      }
      if (code === 'ERROR') {
        const detail =
          typeof container.status === 'string'
            ? `: ${container.status.replace(/https?:\/\/\S+/g, '[url]').slice(0, 120)}`
            : '';
        throw new PermanentError(`Instagram video işlenemedi${detail}`);
      }
      const started = input.containerCreatedAt?.getTime() ?? ctx.now.getTime();
      if (
        ctx.now.getTime() - started >
        config.instagram.maxContainerMinutes * 60_000
      ) {
        throw new PermanentError(
          `Instagram video işleme ${config.instagram.maxContainerMinutes} dakikayı aştı`,
        );
      }
      return {
        kind: 'pending',
        retryAfterSeconds: config.instagram.pollSeconds,
      };
    },
  };
}

export const instagramPublisher = createInstagramPublisher();
