// TikTok toplayıcısı (#52): TikTok Display API v2 (user/info, video/list, video/query).
// Ayrıntılar, alan eşlemesi ve sınırlar: `collectors/README.md` → "TikTok".
//
// Token: orkestratör Vault'tan (`read_social_token`) okuyup `ctx.token` olarak verir. Access
// token yenileme (24 sa ömürlü) #49'un işidir; süresi dolmuş token → TokenExpiredError.
import {
  type CollectedPost,
  type Collector,
  type CollectorContext,
  PermanentError,
} from './types.ts';
import { tiktokRequest } from '../tiktok/client.ts';
import {
  mapUser,
  mapVideo,
  mapVideoMetrics,
  TIKTOK_MAX_BATCH,
  USER_FIELDS,
  userOf,
  VIDEO_LIST_FIELDS,
  VIDEO_METRIC_FIELDS,
  videosOf,
} from '../tiktok/map.ts';

export interface TiktokCollectorConfig {
  /** İlk senkronda (since = null) en fazla kaç video/list sayfası (20'şer video). */
  maxPagesInitial: number;
  /** Artımlı senkronda en fazla sayfa. */
  maxPagesIncremental: number;
  /** `since`'tan bu kadar geriye kadar videolar yeniden okunur (sıra kaymalarına karşı). */
  overlapMs: number;
}

export const DEFAULT_TIKTOK_CONFIG: TiktokCollectorConfig = {
  maxPagesInitial: 25,
  maxPagesIncremental: 5,
  overlapMs: 6 * 3_600_000,
};

async function getUser(ctx: CollectorContext) {
  const data = await tiktokRequest(ctx, 'user/info', USER_FIELDS);
  const user = userOf(data);
  if (!user) throw new PermanentError('TikTok kullanıcısı bulunamadı');
  // Service role RLS'i aşar: token başka bir TikTok hesabına aitse yanlış hesaba yazmayız.
  const openId = typeof user.open_id === 'string' ? user.open_id : null;
  if (ctx.account.externalId && openId && openId !== ctx.account.externalId) {
    throw new PermanentError(
      'TikTok token başka bir hesaba ait (open_id eşleşmiyor)',
    );
  }
  return user;
}

export function createTiktokCollector(
  config: Partial<TiktokCollectorConfig> = {},
): Collector {
  const cfg: TiktokCollectorConfig = { ...DEFAULT_TIKTOK_CONFIG, ...config };

  return {
    platform: 'tiktok',

    async fetchAccount(ctx) {
      const user = await getUser(ctx);
      const account = mapUser(user);
      if (!account) {
        // Sayaçlar yalnız `user.info.stats` izniyle gelir; 0 yazmak grafiği bozar.
        throw new PermanentError(
          'TikTok hesap sayaçları gelmedi (user.info.stats izni yok)',
        );
      }
      if (account.mediaCount === null) ctx.warn('TikTok video_count gelmedi');
      if (account.totalLikes === null) ctx.warn('TikTok likes_count gelmedi');
      return account;
    },

    async fetchPosts(ctx, { since }) {
      const cutoff = since ? since.getTime() - cfg.overlapMs : null;
      const maxPages = since ? cfg.maxPagesIncremental : cfg.maxPagesInitial;
      const posts: CollectedPost[] = [];
      const seen = new Set<string>();
      let cursor: number | undefined;
      let hasMore = false;
      let pages = 0;
      let reachedCutoff = false;
      do {
        const data = await tiktokRequest(
          ctx,
          'video/list',
          VIDEO_LIST_FIELDS,
          cursor === undefined
            ? { max_count: TIKTOK_MAX_BATCH }
            : { max_count: TIKTOK_MAX_BATCH, cursor },
        );
        pages += 1;
        for (const raw of videosOf(data)) {
          const post = mapVideo(raw);
          if (!post) {
            ctx.warn(
              'kimliği veya yayın zamanı olmayan TikTok videosu atlandı',
            );
            continue;
          }
          if (seen.has(post.externalId)) continue;
          // Liste yeniden eskiye sıralıdır; kesim noktasından eskiye gelince dururuz.
          if (cutoff !== null && post.publishedAt.getTime() < cutoff) {
            reachedCutoff = true;
            continue;
          }
          seen.add(post.externalId);
          posts.push(post);
        }
        hasMore = data.has_more === true;
        const next = typeof data.cursor === 'number' ? data.cursor : undefined;
        // İlerlemeyen cursor sonsuz döngü yapmasın.
        if (next === undefined || next === cursor) hasMore = false;
        cursor = next;
      } while (hasMore && !reachedCutoff && pages < maxPages);
      if (hasMore && !reachedCutoff) {
        ctx.warn(
          `TikTok videoları ${pages} sayfada kesildi; daha eski videolar sonraki çalışmalarda alınmaz`,
        );
      }
      return posts;
    },

    async fetchPostMetrics(ctx, post) {
      const data = await tiktokRequest(
        ctx,
        'video/query',
        VIDEO_METRIC_FIELDS,
        {
          filters: { video_ids: [post.externalId] },
        },
      );
      const video = videosOf(data).find(
        (v) => String(v.id) === post.externalId,
      );
      // Silinmiş/gizlenmiş video sorguda dönmez.
      if (!video) return null;
      return mapVideoMetrics(video);
    },
  };
}

export const tiktokCollector: Collector = createTiktokCollector();
