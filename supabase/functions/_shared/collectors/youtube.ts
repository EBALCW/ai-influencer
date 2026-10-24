// YouTube toplayıcısı (#51): YouTube Data API v3 + YouTube Analytics API v2.
// Ayrıntılar, alan eşlemesi ve kota tahmini: `collectors/README.md` → "YouTube".
//
// Token: orkestratör Vault'tan (`read_social_token`) okuyup `ctx.token` olarak verir. Access
// token yenileme #49'un işidir (`refresh-tokens`); süresi dolmuş token 401 → TokenExpiredError.
import {
  type CollectedPost,
  type Collector,
  type CollectorContext,
  PermanentError,
  type PostRef,
} from './types.ts';
import { analyticsQuery, dataGet } from '../youtube/client.ts';
import {
  ANALYTICS_METRICS,
  DEFAULT_SHORTS_RULE,
  items,
  mapAnalyticsReport,
  mapChannel,
  mapMetrics,
  mapPlaylistItem,
  mapVideo,
  mapVideoStatistics,
  type ShortsRule,
  uploadsPlaylistId,
} from '../youtube/map.ts';
import { pacificDate, YOUTUBE_MAX_BATCH } from '../youtube/quota.ts';

export interface YoutubeCollectorConfig {
  shorts: ShortsRule;
  /** İlk senkronda (since = null) en fazla kaç playlistItems sayfası (50'şer video). */
  maxPagesInitial: number;
  /** Artımlı senkronda en fazla sayfa. */
  maxPagesIncremental: number;
  /** `since`'tan bu kadar geriye kadar videolar yeniden okunur (sıra kaymalarına karşı). */
  overlapMs: number;
  /** Analytics yalnız bu kontrol noktasından itibaren sorgulanır (24–48 sa gecikme). */
  analyticsFromHours: number;
  /** player.embedWidth/embedHeight (en-boy oranı) için istenen yükseklik. */
  playerMaxHeight: number;
}

export const DEFAULT_YOUTUBE_CONFIG: YoutubeCollectorConfig = {
  shorts: DEFAULT_SHORTS_RULE,
  maxPagesInitial: 10,
  maxPagesIncremental: 4,
  overlapMs: 6 * 3_600_000,
  analyticsFromHours: 24,
  playerMaxHeight: 640,
};

const ANALYTICS_SCOPE = 'yt-analytics.readonly';

/** Kanal seçimi: bağlantı (#49) external_id'yi doldurduysa id, yoksa token sahibinin kanalı. */
function channelParams(ctx: CollectorContext) {
  return ctx.account.externalId
    ? { id: ctx.account.externalId }
    : { mine: 'true' };
}

async function getChannel(ctx: CollectorContext, part: string) {
  const body = await dataGet(ctx, 'channels.list', {
    part,
    ...channelParams(ctx),
    maxResults: 1,
  });
  const channel = items(body)[0];
  if (!channel) throw new PermanentError('YouTube kanalı bulunamadı');
  return channel;
}

/** Analytics sorgulanmalı mı? 1/5 sa noktalarında veri yok; ad-hoc ölçümde post yaşı. */
export function wantsAnalytics(
  post: PostRef,
  now: Date,
  fromHours = DEFAULT_YOUTUBE_CONFIG.analyticsFromHours,
): boolean {
  if (post.targetHours !== null) return post.targetHours >= fromHours;
  return now.getTime() - post.publishedAt.getTime() >= fromHours * 3_600_000;
}

/** Token kapsamı biliniyorsa ve Analytics içermiyorsa false. */
function analyticsAllowed(ctx: CollectorContext): boolean {
  const scope = ctx.token.scope;
  return typeof scope !== 'string' || scope.includes(ANALYTICS_SCOPE);
}

export function createYoutubeCollector(
  config: Partial<YoutubeCollectorConfig> = {},
): Collector {
  const cfg: YoutubeCollectorConfig = { ...DEFAULT_YOUTUBE_CONFIG, ...config };

  return {
    platform: 'youtube',

    async fetchAccount(ctx) {
      const channel = await getChannel(ctx, 'statistics');
      return mapChannel(channel, ctx.warn);
    },

    async fetchPosts(ctx, { since }) {
      const channel = await getChannel(ctx, 'contentDetails');
      const playlistId = uploadsPlaylistId(channel);
      if (!playlistId) {
        throw new PermanentError('YouTube yüklemeler listesi bulunamadı');
      }

      const cutoff = since ? since.getTime() - cfg.overlapMs : null;
      const maxPages = since ? cfg.maxPagesIncremental : cfg.maxPagesInitial;
      const ids: string[] = [];
      const seen = new Set<string>();
      let pageToken: string | undefined;
      let pages = 0;
      let reachedCutoff = false;
      do {
        const body = await dataGet(ctx, 'playlistItems.list', {
          part: 'contentDetails',
          playlistId,
          maxResults: YOUTUBE_MAX_BATCH,
          pageToken,
        });
        pages += 1;
        for (const raw of items(body)) {
          const item = mapPlaylistItem(raw);
          // Tarihsiz öğe: özel/zamanlanmış/silinmiş video → yayımlanmamış, atlanır.
          if (!item?.publishedAt || seen.has(item.videoId)) continue;
          if (cutoff !== null && item.publishedAt.getTime() < cutoff) {
            reachedCutoff = true;
            continue;
          }
          seen.add(item.videoId);
          ids.push(item.videoId);
        }
        pageToken =
          typeof body.nextPageToken === 'string'
            ? body.nextPageToken
            : undefined;
      } while (pageToken && !reachedCutoff && pages < maxPages);
      if (pageToken && !reachedCutoff) {
        ctx.warn(
          `yüklemeler ${pages} sayfada kesildi; daha eski videolar sonraki çalışmalarda alınmaz`,
        );
      }

      const posts: CollectedPost[] = [];
      for (let i = 0; i < ids.length; i += YOUTUBE_MAX_BATCH) {
        const batch = ids.slice(i, i + YOUTUBE_MAX_BATCH);
        const body = await dataGet(ctx, 'videos.list', {
          part: 'snippet,contentDetails,status,player,liveStreamingDetails',
          id: batch.join(','),
          maxHeight: cfg.playerMaxHeight,
          maxResults: YOUTUBE_MAX_BATCH,
        });
        for (const video of items(body)) {
          const post = mapVideo(video, cfg.shorts);
          if (post) posts.push(post);
        }
      }
      return posts;
    },

    async fetchPostMetrics(ctx, post) {
      const body = await dataGet(ctx, 'videos.list', {
        part: 'statistics',
        id: post.externalId,
      });
      const video = items(body).find((v) => v.id === post.externalId);
      if (!video) return null;
      const stats = mapVideoStatistics(video);

      if (!wantsAnalytics(post, ctx.now, cfg.analyticsFromHours)) {
        return mapMetrics(stats, null, 'skipped');
      }
      if (!analyticsAllowed(ctx)) {
        ctx.warn(
          'token Analytics kapsamı içermiyor; yalnız Data API sayaçları',
        );
        return mapMetrics(stats, null, 'unavailable');
      }
      try {
        // Analytics tarihleri Pasifik saatine göre gündür; aralık yayın gününden bugüne.
        const report = await analyticsQuery(ctx, {
          ids: 'channel==MINE',
          startDate: pacificDate(post.publishedAt),
          endDate: pacificDate(ctx.now),
          metrics: ANALYTICS_METRICS.join(','),
          filters: `video==${post.externalId}`,
        });
        const analytics = mapAnalyticsReport(report);
        return mapMetrics(stats, analytics, analytics ? 'ok' : 'empty');
      } catch (error) {
        // İzin/istek hatası Data API sayaçlarını çöpe atmasın; token, kota ve geçici
        // hatalar orkestratöre gider (yeniden dener ya da hesabı işaretler).
        if (error instanceof PermanentError) {
          ctx.warn(`Analytics alınamadı: ${error.message}`);
          return mapMetrics(stats, null, 'unavailable');
        }
        throw error;
      }
    },
  };
}

export const youtubeCollector: Collector = createYoutubeCollector();
