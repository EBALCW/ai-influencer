// YouTube yorum adaptörü (#61): commentThreads.list (okuma, 1 birim/sayfa) ve comments.insert
// (yanıt, 50 birim). Birimler `ctx.reportQuota` ile sync_runs.quota_units'e yazılır ve #51'in
// günlük kota uyarısına sayılır. Kaynak (doğrulandı 22 Eki 2026):
//   https://developers.google.com/youtube/v3/docs/commentThreads/list
//   https://developers.google.com/youtube/v3/docs/comments/insert
// Yanıt için token kapsamı `youtube.force-ssl` gerekir (#49 bağlantısı ister).
import {
  type CollectorContext,
  PermanentError,
  TransientError,
} from '../collectors/types.ts';
import { dataGet, YOUTUBE_DATA_BASE, youtubeError } from '../youtube/client.ts';
import { items, toCount } from '../youtube/map.ts';
import { quotaCost } from '../youtube/quota.ts';
import type {
  CollectedComment,
  CommentAdapter,
  CommentPostRef,
} from './types.ts';

export interface YoutubeCommentConfig {
  /** commentThreads.list sayfa boyutu (API üst sınırı 100). */
  pageSize: number;
  /** Post başına en fazla sayfa (kota koruması). */
  maxPages: number;
}

export const DEFAULT_YOUTUBE_COMMENT_CONFIG: YoutubeCommentConfig = {
  pageSize: 100,
  maxPages: 5,
};

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | null =>
  typeof v === 'string' && v !== '' ? v : null;

/** commentThreads öğesi → yorum. Kanalın kendi yorumu ve tarihsiz öğe null. */
export function mapCommentThread(
  raw: Record<string, unknown>,
  ownChannelId: string | null,
): CollectedComment | null {
  const top = obj(obj(raw.snippet).topLevelComment);
  const s = obj(top.snippet);
  const id = str(top.id) ?? str(raw.id);
  const published = str(s.publishedAt);
  if (!id || !published) return null;
  const at = new Date(published);
  if (Number.isNaN(at.getTime())) return null;
  const author = str(obj(s.authorChannelId).value);
  if (ownChannelId && author === ownChannelId) return null;
  return {
    externalId: id,
    parentExternalId: null,
    authorName: (str(s.authorDisplayName) ?? '').slice(0, 100),
    text: str(s.textOriginal) ?? str(s.textDisplay) ?? '',
    publishedAt: at,
    likeCount: toCount(s.likeCount),
  };
}

/** Yorumu kapalı / silinmiş video: hata değil, boş liste. */
const EMPTY_REASONS = /commentsDisabled|videoNotFound/;

export function createYoutubeCommentAdapter(
  config: Partial<YoutubeCommentConfig> = {},
): CommentAdapter {
  const cfg = { ...DEFAULT_YOUTUBE_COMMENT_CONFIG, ...config };
  return {
    platform: 'youtube',

    async fetchComments(ctx, post: CommentPostRef, { since }) {
      const out: CollectedComment[] = [];
      const seen = new Set<string>();
      let pageToken: string | undefined;
      let pages = 0;
      let reachedSince = false;
      do {
        let body: Record<string, unknown>;
        try {
          body = await dataGet(ctx, 'commentThreads.list', {
            part: 'snippet',
            videoId: post.externalId,
            maxResults: cfg.pageSize,
            order: 'time',
            textFormat: 'plainText',
            pageToken,
          });
        } catch (error) {
          if (
            error instanceof PermanentError &&
            EMPTY_REASONS.test(error.message)
          ) {
            return out;
          }
          throw error;
        }
        pages += 1;
        for (const raw of items(body)) {
          const comment = mapCommentThread(raw, ctx.account.externalId);
          if (!comment || seen.has(comment.externalId)) continue;
          // order=time: yeniden eskiye; `since`'tan eskiye inince durulur.
          if (comment.publishedAt.getTime() < since.getTime()) {
            reachedSince = true;
            continue;
          }
          seen.add(comment.externalId);
          out.push(comment);
        }
        pageToken =
          typeof body.nextPageToken === 'string'
            ? body.nextPageToken
            : undefined;
      } while (pageToken && !reachedSince && pages < cfg.maxPages);
      if (pageToken && !reachedSince) {
        ctx.warn(
          `yorum sayfa sınırına ulaşıldı (${cfg.maxPages}); eski yorumlar sonraki çalışmada`,
        );
      }
      return out;
    },

    async reply(ctx: CollectorContext, { commentExternalId, text }) {
      const url = new URL(`${YOUTUBE_DATA_BASE}/comments`);
      url.searchParams.set('part', 'snippet');
      let response: Response;
      try {
        response = await ctx.fetch(url.toString(), {
          method: 'POST',
          headers: {
            authorization: `Bearer ${ctx.token.accessToken}`,
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            snippet: { parentId: commentExternalId, textOriginal: text },
          }),
        });
      } catch {
        // İstek YouTube'a ulaşmış olabilir: tekrar gönderim çift yanıt üretebilir.
        throw new PermanentError(
          'YouTube comments.insert: ağ hatası; yanıtı platformda kontrol edin',
        );
      }
      // Google geçersiz isteğe de kota yazar.
      ctx.reportQuota(quotaCost('comments.insert'));
      let body: unknown = null;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (!response.ok) {
        const error = youtubeError(
          response,
          body,
          'YouTube comments.insert',
          ctx.now,
        );
        if (error instanceof TransientError) {
          throw new PermanentError(
            `${error.message}; yanıtı platformda kontrol edin`,
          );
        }
        throw error;
      }
      const id = str(obj(body).id);
      if (!id) {
        throw new PermanentError('YouTube comments.insert: yanıt id’si yok');
      }
      return { externalId: id };
    },
  };
}

export const youtubeCommentAdapter = createYoutubeCommentAdapter();
