// Instagram yorum adaptörü (#61). Yalnız yorum okuma/yanıt; Instagram veri toplayıcısı (#50)
// ve OAuth bağlantısı (#49) ayrı dosyalardadır ve bu adaptöre bağlı değildir.
//
// Uç noktalar (Instagram API with Instagram Login; #50 Facebook Login seçerse `baseUrl`
// graph.facebook.com olarak verilir, yol ve alanlar aynıdır):
//   GET  /{ig-media-id}/comments?fields=id,text,timestamp,username,like_count&limit=50
//   POST /{ig-comment-id}/replies   (message=...)
// İzin: okuma `instagram_business_basic`, yanıt `instagram_business_manage_comments`.
// Token `Authorization: Bearer` başlığında gider, URL'e yazılmaz.
import {
  type CollectorContext,
  type CollectorError,
  errorForResponse,
  parseRetryAfter,
  PermanentError,
  RateLimitedError,
  TokenExpiredError,
  TransientError,
} from '../collectors/types.ts';
import type {
  CollectedComment,
  CommentAdapter,
  CommentPostRef,
} from './types.ts';

export interface InstagramCommentConfig {
  baseUrl: string;
  pageSize: number;
  maxPages: number;
}

export const DEFAULT_INSTAGRAM_COMMENT_CONFIG: InstagramCommentConfig = {
  baseUrl: 'https://graph.instagram.com/v23.0',
  pageSize: 50,
  maxPages: 5,
};

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | null =>
  typeof v === 'string' && v !== '' ? v : null;
const count = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;

/** Graph API hata gövdesi → tipli hata. Mesaja token/URL/gövde konmaz. */
export function instagramError(
  response: Response,
  body: unknown,
  label: string,
  now: Date,
): CollectorError {
  const err = obj(obj(body).error);
  const code = typeof err.code === 'number' ? err.code : null;
  const sub = typeof err.error_subcode === 'number' ? err.error_subcode : null;
  const tag = code === null ? '' : `, code ${code}`;
  if (code === 190) {
    return new TokenExpiredError(`${label}: token geçersiz (code 190)`);
  }
  // 4: uygulama düzeyi, 17/32/613: kullanıcı/hesap düzeyi istek sınırı.
  if (code === 4) {
    return new RateLimitedError(
      `${label}: uygulama istek sınırı (code 4)`,
      parseRetryAfter(response.headers.get('retry-after'), now),
      'platform',
    );
  }
  if (code === 17 || code === 32 || code === 613) {
    return new RateLimitedError(
      `${label}: hesap istek sınırı (code ${code})`,
      parseRetryAfter(response.headers.get('retry-after'), now),
      'account',
    );
  }
  if (code === 10 || (code !== null && code >= 200 && code < 300)) {
    return new PermanentError(`${label}: izin yok (code ${code})`);
  }
  if (code === 100 && sub === 33) {
    return new PermanentError(`${label}: nesne bulunamadı (code 100/33)`);
  }
  if (response.status >= 500 || code === 1 || code === 2) {
    return new TransientError(
      `${label}: geçici hata (${response.status}${tag})`,
    );
  }
  const fallback = errorForResponse(response, label);
  return fallback instanceof PermanentError && tag
    ? new PermanentError(
        `${label}: istek reddedildi (${response.status}${tag})`,
      )
    : fallback;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

const normalizeHandle = (h: string | null | undefined) =>
  (h ?? '').trim().replace(/^@/, '').toLowerCase();

/** Graph API yorum öğesi → yorum. Hesabın kendi yorumu ve tarihsiz öğe null. */
export function mapInstagramComment(
  raw: Record<string, unknown>,
  ownHandle: string,
): CollectedComment | null {
  const id = str(raw.id);
  const timestamp = str(raw.timestamp);
  if (!id || !timestamp) return null;
  const at = new Date(timestamp);
  if (Number.isNaN(at.getTime())) return null;
  const username = str(raw.username) ?? str(obj(raw.from).username) ?? '';
  if (ownHandle && normalizeHandle(username) === ownHandle) return null;
  return {
    externalId: id,
    parentExternalId: str(raw.parent_id),
    authorName: username.slice(0, 100),
    text: str(raw.text) ?? '',
    publishedAt: at,
    likeCount: count(raw.like_count),
  };
}

export function createInstagramCommentAdapter(
  config: Partial<InstagramCommentConfig> = {},
): CommentAdapter {
  const cfg = { ...DEFAULT_INSTAGRAM_COMMENT_CONFIG, ...config };
  const base = cfg.baseUrl.replace(/\/+$/, '');

  async function get(ctx: CollectorContext, url: URL, label: string) {
    let response: Response;
    try {
      response = await ctx.fetch(url.toString(), {
        headers: {
          authorization: `Bearer ${ctx.token.accessToken}`,
          accept: 'application/json',
        },
      });
    } catch {
      throw new TransientError(`${label}: ağ hatası`);
    }
    const body = await readJson(response);
    if (!response.ok) throw instagramError(response, body, label, ctx.now);
    if (!body || typeof body !== 'object') {
      throw new PermanentError(`${label}: beklenmeyen yanıt biçimi`);
    }
    return body as Record<string, unknown>;
  }

  return {
    platform: 'instagram',

    async fetchComments(ctx, post: CommentPostRef, { since }) {
      const ownHandle = normalizeHandle(ctx.account.handle);
      const out: CollectedComment[] = [];
      const seen = new Set<string>();
      let after: string | undefined;
      let pages = 0;
      let olderPage = false;
      do {
        const url = new URL(
          `${base}/${encodeURIComponent(post.externalId)}/comments`,
        );
        url.searchParams.set(
          'fields',
          'id,text,timestamp,username,like_count,parent_id',
        );
        url.searchParams.set('limit', String(cfg.pageSize));
        if (after) url.searchParams.set('after', after);
        let body: Record<string, unknown>;
        try {
          body = await get(ctx, url, 'Instagram comments');
        } catch (error) {
          // Silinmiş/erişilemeyen media: hata değil, boş liste.
          if (
            error instanceof PermanentError &&
            /nesne bulunamadı/.test(error.message)
          ) {
            return out;
          }
          throw error;
        }
        pages += 1;
        const data = Array.isArray(body.data) ? body.data.map(obj) : [];
        let newer = 0;
        for (const raw of data) {
          const comment = mapInstagramComment(raw, ownHandle);
          if (!comment || seen.has(comment.externalId)) continue;
          if (comment.publishedAt.getTime() < since.getTime()) continue;
          newer += 1;
          seen.add(comment.externalId);
          out.push(comment);
        }
        // Sıra garanti edilmediği için ancak sayfanın tamamı eskiyse durulur.
        olderPage = data.length > 0 && newer === 0;
        const paging = obj(body.paging);
        after =
          str(paging.next) !== null
            ? (str(obj(paging.cursors).after) ?? undefined)
            : undefined;
      } while (after && !olderPage && pages < cfg.maxPages);
      if (after && !olderPage) {
        ctx.warn(
          `yorum sayfa sınırına ulaşıldı (${cfg.maxPages}); eski yorumlar sonraki çalışmada`,
        );
      }
      return out;
    },

    async reply(ctx, { commentExternalId, text }) {
      const label = 'Instagram replies';
      const url = new URL(
        `${base}/${encodeURIComponent(commentExternalId)}/replies`,
      );
      let response: Response;
      try {
        response = await ctx.fetch(url.toString(), {
          method: 'POST',
          headers: {
            authorization: `Bearer ${ctx.token.accessToken}`,
            accept: 'application/json',
            'content-type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ message: text }).toString(),
        });
      } catch {
        throw new PermanentError(
          `${label}: ağ hatası; yanıtı platformda kontrol edin`,
        );
      }
      const body = await readJson(response);
      if (!response.ok) {
        const error = instagramError(response, body, label, ctx.now);
        if (error instanceof TransientError) {
          throw new PermanentError(
            `${error.message}; yanıtı platformda kontrol edin`,
          );
        }
        throw error;
      }
      const id = str(obj(body).id);
      if (!id) throw new PermanentError(`${label}: yanıt id’si yok`);
      return { externalId: id };
    },
  };
}

export const instagramCommentAdapter = createInstagramCommentAdapter();
