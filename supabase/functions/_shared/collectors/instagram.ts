// #50: sync-dispatch üzerinden çalışan Instagram Login adaptörü.
// DB yazımı, token okuma, tekrar deneme ve backoff ortak orkestratördedir.
import {
  type Collector,
  type CollectorContext,
  type CollectedPost,
  PermanentError,
  TransientError,
} from './types.ts';
import { instagramError } from '../comments/instagram.ts';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {};
const count = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
const str = (v: unknown): string | null =>
  typeof v === 'string' && v !== '' ? v : null;

const COMMON_METRICS = [
  'views',
  'reach',
  'likes',
  'comments',
  'shares',
  'saved',
  'total_interactions',
];
const REEL_METRICS = [
  'ig_reels_avg_watch_time',
  'ig_reels_video_view_total_time',
];

/** Yalnız sayısal metrik verisi saklanır; sağlayıcı açıklamaları/URL/token saklanmaz. */
export function instagramMetrics(
  body: Json,
  expected: string[],
  warn: (message: string) => void,
) {
  if (!Array.isArray(body.data))
    throw new PermanentError('Instagram insights: veri listesi yok');
  const values: Record<string, number | null> = {};
  for (const item of body.data) {
    const row = obj(item);
    const name = str(row.name);
    if (!name) continue;
    const entries = Array.isArray(row.values) ? row.values : [];
    const value =
      count(obj(row.total_value).value) ??
      count(obj(entries[entries.length - 1]).value);
    // Bilinmeyen metrik adı loga konmaz; sağlayıcı girdisi gizli bilgi içerebilir.
    if (!expected.includes(name)) warn('Instagram: bilinmeyen metrik alındı');
    values[name] = value;
  }
  for (const name of expected) {
    if (values[name] === undefined || values[name] === null)
      warn(`Instagram: ${name} ölçülmedi`);
  }
  return values;
}

export interface InstagramCollectorConfig {
  baseUrl: string;
  maxPages: number;
}

export function createInstagramCollector(
  config: Partial<InstagramCollectorConfig> = {},
): Collector {
  const cfg = {
    baseUrl: 'https://graph.instagram.com/v23.0',
    maxPages: 10,
    ...config,
  };
  if (!Number.isInteger(cfg.maxPages) || cfg.maxPages < 1)
    throw new Error('maxPages pozitif tam sayı olmalı');
  const base = cfg.baseUrl.replace(/\/+$/, '');
  const accountId = (ctx: CollectorContext) => {
    if (!ctx.account.externalId)
      throw new PermanentError(
        'Instagram: hesap kimliği eksik; hesabı yeniden bağlayın',
      );
    return encodeURIComponent(ctx.account.externalId);
  };
  async function get(
    ctx: CollectorContext,
    path: string,
    params: Record<string, string> = {},
  ): Promise<Json> {
    const url = new URL(`${base}/${path}`);
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await ctx.fetch(url.toString(), {
        headers: {
          authorization: `Bearer ${ctx.token.accessToken}`,
          accept: 'application/json',
        },
      });
    } catch {
      throw new TransientError('Instagram: ağ hatası');
    }
    ctx.reportQuota(1);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok || obj(body).error)
      throw instagramError(response, body, 'Instagram', ctx.now);
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new PermanentError('Instagram: beklenmeyen yanıt biçimi');
    return body as Json;
  }
  return {
    platform: 'instagram',
    async fetchAccount(ctx) {
      const id = accountId(ctx);
      const profile = await get(ctx, id, {
        fields: 'id,followers_count,follows_count,media_count',
      });
      if (profile.id !== ctx.account.externalId)
        throw new PermanentError('Instagram: hesap kimliği eşleşmiyor');
      const followers = count(profile.followers_count);
      if (followers === null)
        throw new PermanentError('Instagram: takipçi sayısı ölçülemedi');
      const until = Math.floor(ctx.now.getTime() / 1000);
      const insights = await get(ctx, `${id}/insights`, {
        metric: 'reach',
        metric_type: 'total_value',
        period: 'day',
        since: String(until - 86400),
        until: String(until),
      });
      const metrics = instagramMetrics(insights, ['reach'], ctx.warn);
      return {
        followers,
        following: count(profile.follows_count),
        mediaCount: count(profile.media_count),
        reachDay: metrics.reach ?? null,
        profileViews: null,
      };
    },
    async fetchPosts(ctx, { since }) {
      const out: CollectedPost[] = [];
      const seen = new Set<string>();
      const cursors = new Set<string>();
      let after: string | null = null;
      for (let page = 0; page < cfg.maxPages; page++) {
        const body = await get(ctx, `${accountId(ctx)}/media`, {
          fields:
            'id,caption,permalink,timestamp,media_type,media_product_type',
          limit: '50',
          ...(after ? { after } : {}),
        });
        if (!Array.isArray(body.data))
          throw new PermanentError('Instagram media: veri listesi yok');
        // Sıralama garantisine güvenilmez: eski kayıt görülse bile sonraki sayfalar okunur.
        for (const item of body.data) {
          const row = obj(item);
          const id = str(row.id);
          const at = str(row.timestamp);
          const publishedAt = at ? new Date(at) : null;
          if (
            !id ||
            !publishedAt ||
            Number.isNaN(publishedAt.getTime()) ||
            seen.has(id)
          )
            continue;
          seen.add(id);
          if (since && publishedAt.getTime() < since.getTime() - 6 * 3600000)
            continue;
          const link = str(row.permalink);
          let url: string | null = null;
          if (link) {
            try {
              const parsed = new URL(link);
              if (
                parsed.protocol === 'https:' &&
                ['instagram.com', 'www.instagram.com'].includes(parsed.hostname)
              ) {
                parsed.search = '';
                parsed.hash = '';
                url = parsed.toString();
              }
            } catch {
              /* Geçersiz permalink yayın bilgisini kaybettirmez. */
            }
          }
          out.push({
            externalId: id,
            caption: str(row.caption) ?? '',
            publishedAt,
            url,
            isShort: row.media_product_type === 'REELS',
            durationS: null,
          });
        }
        const paging = obj(body.paging);
        if (!str(paging.next)) return out;
        // paging.next güvenilmeyen bir URL'dir: takip edilmez, yalnız cursor alınır.
        after = str(obj(paging.cursors).after);
        if (!after || cursors.has(after))
          throw new PermanentError('Instagram media: sayfalama ilerlemiyor');
        cursors.add(after);
      }
      throw new PermanentError(
        'Instagram media: sayfa sınırı aşıldı; maxPages değerini artırın',
      );
    },
    async fetchPostMetrics(ctx, post) {
      const id = encodeURIComponent(post.externalId);
      let media: Json;
      try {
        media = await get(ctx, id, {
          fields: 'id,media_type,media_product_type,owner',
        });
      } catch (error) {
        if (
          error instanceof PermanentError &&
          /nesne bulunamadı/.test(error.message)
        )
          return null;
        throw error;
      }
      if (
        media.id !== post.externalId ||
        str(obj(media.owner).id) !== ctx.account.externalId
      )
        throw new PermanentError(
          'Instagram: medya hesap eşleşmesi doğrulanamadı',
        );
      const expected = [
        ...COMMON_METRICS,
        ...(media.media_product_type === 'REELS' ? REEL_METRICS : []),
      ];
      const body = await get(ctx, `${id}/insights`, {
        metric: expected.join(','),
      });
      const m = instagramMetrics(body, expected, ctx.warn);
      return {
        views: m.views ?? null,
        reach: m.reach ?? null,
        likes: m.likes ?? null,
        comments: m.comments ?? null,
        shares: m.shares ?? null,
        saves: m.saved ?? null,
        avgWatchTimeS:
          m.ig_reels_avg_watch_time == null
            ? null
            : m.ig_reels_avg_watch_time / 1000,
        completionRate: null,
        raw: {
          metrics: m,
          mediaType: str(media.media_type),
          mediaProductType: str(media.media_product_type),
        },
      };
    },
  };
}

export const instagramCollector = createInstagramCollector();
