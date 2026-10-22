// TikTok Display API v2 yanıtları → toplayıcı tipleri (#52). Saf fonksiyonlar, ağ yok.
// Alan listesi: developers.tiktok.com/doc/tiktok-api-v2-get-user-info ve
// .../tiktok-api-v2-video-object (22 Eki 2026'da doğrulandı). Display API izlenme süresi,
// tamamlama oranı, erişim ve kaydetme (favori) sayısı VERMEZ; bunlar null kalır ve elle
// girilebilir (panel → post detayı → "Elle metrik gir").
import type {
  CollectedAccount,
  CollectedMetrics,
  CollectedPost,
} from '../collectors/types.ts';

/** user/info: `user.info.basic` (open_id, display_name) + `user.info.stats` (sayaçlar). */
export const USER_FIELDS = [
  'open_id',
  'display_name',
  'follower_count',
  'following_count',
  'likes_count',
  'video_count',
] as const;

/** video/list (`video.list` izni): post kaydı için gereken alanlar. */
export const VIDEO_LIST_FIELDS = [
  'id',
  'create_time',
  'title',
  'video_description',
  'duration',
  'height',
  'width',
  'share_url',
] as const;

/** video/query (`video.list` izni): metrik alanları. */
export const VIDEO_METRIC_FIELDS = [
  'id',
  'view_count',
  'like_count',
  'comment_count',
  'share_count',
] as const;

/** video/list `max_count` ve video/query `video_ids` üst sınırı. */
export const TIKTOK_MAX_BATCH = 20;

/** Display API'de olmayan metrikler (raw_payload'a not düşülür). */
export const TIKTOK_UNAVAILABLE_METRICS = [
  'saves',
  'reach',
  'avg_watch_time_s',
  'completion_rate',
] as const;

/** Kısa video kuralı: TikTok'ta Shorts benzeri ayrı tür yok; süre ≤ 180 sn ise kısa. */
export const TIKTOK_SHORT_MAX_S = 180;

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** Negatif olmayan tam sayı; değilse null (0 uydurulmaz). */
export function count(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0
    ? Math.round(n)
    : null;
}

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function userOf(data: Obj): Obj | null {
  return isObj(data.user) ? data.user : null;
}

export function videosOf(data: Obj): Obj[] {
  return Array.isArray(data.videos) ? data.videos.filter(isObj) : [];
}

/** `user.info.stats` izni yoksa sayaç alanları hiç gelmez → null. */
export function mapUser(user: Obj): CollectedAccount | null {
  const followers = count(user.follower_count);
  if (followers === null) return null;
  return {
    followers,
    following: count(user.following_count),
    mediaCount: count(user.video_count),
    totalLikes: count(user.likes_count),
  };
}

/** Paylaşım bağlantısı: izleme parametreleri (`utm_*`, kullanıcı kodu) atılır. */
export function cleanShareUrl(v: unknown): string | null {
  if (typeof v !== 'string' || v === '') return null;
  try {
    const url = new URL(v);
    if (url.protocol !== 'https:') return null;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

/** video/list öğesi → post. Kimliği veya yayın zamanı (`create_time`, Unix sn) yoksa null. */
export function mapVideo(video: Obj): CollectedPost | null {
  // TikTok video id'si 64 bit; JSON'da string gelir (number olsa hassasiyet kaybolurdu).
  const id = typeof video.id === 'string' ? video.id.trim() : '';
  const created = count(video.create_time);
  if (!id || !created) return null;
  const durationS = count(video.duration);
  const description = text(video.video_description);
  const title = text(video.title);
  // Açıklama genelde başlığı da içerir; ayrı başlık varsa ve açıklamada yoksa öne eklenir.
  const caption =
    title && !description.includes(title)
      ? description
        ? `${title}\n\n${description}`
        : title
      : description;
  return {
    externalId: id,
    url: cleanShareUrl(video.share_url),
    caption,
    publishedAt: new Date(created * 1000),
    durationS,
    isShort: durationS === null || durationS <= TIKTOK_SHORT_MAX_S,
  };
}

/** video/query öğesi → metrikler. Gelmeyen sayaç null (orkestratör `_unmeasured` yazar). */
export function mapVideoMetrics(video: Obj): CollectedMetrics {
  const counts = {
    view_count: count(video.view_count),
    like_count: count(video.like_count),
    comment_count: count(video.comment_count),
    share_count: count(video.share_count),
  };
  return {
    views: counts.view_count,
    likes: counts.like_count,
    comments: counts.comment_count,
    shares: counts.share_count,
    saves: null,
    reach: null,
    avgWatchTimeS: null,
    completionRate: null,
    raw: {
      source: 'tiktok.display.video.query',
      counts,
      unavailable: [...TIKTOK_UNAVAILABLE_METRICS],
    },
  };
}
