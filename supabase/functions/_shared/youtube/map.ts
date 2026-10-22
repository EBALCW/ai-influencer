// YouTube API yanıtları → ortak toplayıcı tipleri (#51). Saf fonksiyonlar; ağ yok.
import type {
  CollectedAccount,
  CollectedMetrics,
  CollectedPost,
} from '../collectors/types.ts';

// ── Shorts kuralı ────────────────────────────────────────────────────────────
// Data API'de "bu video Short mu" diyen resmi bir alan YOK (doğrulandı 22 Eki 2026,
// developers.google.com/youtube/v3/docs/videos). Analytics API'deki `creatorContentType`
// boyutu (SHORTS) yalnız izlenme raporlarında var ve video filtresiyle tek başına
// sorgulanamıyor. Bu yüzden sezgisel kural:
//   1) Süre ≤ maxDurationS (15 Eki 2024'ten beri Shorts 3 dakikaya kadar) VE
//   2) Görüntü dikey veya kare (yükseklik ≥ genişlik). Boyut `player.embedWidth/embedHeight`
//      alanlarından okunur; bunlar yalnız istek `maxHeight` verdiğinde ve en-boy oranı
//      biliniyorsa döner. (`fileDetails` yalnız video sahibine açık olduğu için istenmez.)
//   3) Boyut bilinmiyorsa yalnız süre ≤ fallbackDurationS (eski 60 sn sınırı) Short sayılır.
// Canlı yayın / premiere tekrarları (`liveStreamingDetails`) Short sayılmaz.
export interface ShortsRule {
  maxDurationS: number;
  fallbackDurationS: number;
}

export const DEFAULT_SHORTS_RULE: ShortsRule = {
  maxDurationS: 180,
  fallbackDurationS: 60,
};

export function detectShort(
  input: {
    durationS: number | null;
    width?: number | null;
    height?: number | null;
    live?: boolean;
  },
  rule: ShortsRule = DEFAULT_SHORTS_RULE,
): boolean {
  const { durationS, width, height } = input;
  if (input.live || durationS === null || durationS <= 0) return false;
  if (durationS > rule.maxDurationS) return false;
  if (width && height && width > 0 && height > 0) return height >= width;
  return durationS <= rule.fallbackDurationS;
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

/** ISO 8601 süre (`PT1H2M3S`, `P1DT5M`, `PT0S`, `P0D`) → saniye. Geçersizse null. */
export function parseIsoDuration(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const m =
    /^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
      value.trim(),
    );
  if (!m || value.trim() === 'P' || value.trim().endsWith('T')) return null;
  const [, w, d, h, min, s] = m;
  return (
    Number(w ?? 0) * 604_800 +
    Number(d ?? 0) * 86_400 +
    Number(h ?? 0) * 3_600 +
    Number(min ?? 0) * 60 +
    Number(s ?? 0)
  );
}

/** Data API sayaçları string döner ("1234"). Gizli/eksik → null. */
export function toCount(value: unknown): number | null {
  const n =
    typeof value === 'string' && value.trim() !== ''
      ? Number(value)
      : typeof value === 'number'
        ? value
        : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null;
}

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
const str = (v: unknown): string | null =>
  typeof v === 'string' && v !== '' ? v : null;

export function items(
  body: Record<string, unknown>,
): Record<string, unknown>[] {
  return Array.isArray(body.items) ? body.items.map(obj) : [];
}

// ── Kanal ────────────────────────────────────────────────────────────────────

/** channels.list `statistics` → account_snapshots. */
export function mapChannel(
  channel: Record<string, unknown>,
  warn: (m: string) => void = () => {},
): CollectedAccount {
  const stats = obj(channel.statistics);
  const subscribers = toCount(stats.subscriberCount);
  if (stats.hiddenSubscriberCount === true || subscribers === null) {
    warn('kanal abone sayısı gizli veya eksik; followers = 0 yazıldı');
  }
  return {
    followers: subscribers ?? 0,
    following: null,
    mediaCount: toCount(stats.videoCount),
    totalViews: toCount(stats.viewCount),
  };
}

/** channels.list `contentDetails.relatedPlaylists.uploads`. */
export function uploadsPlaylistId(
  channel: Record<string, unknown>,
): string | null {
  return str(obj(obj(channel.contentDetails).relatedPlaylists).uploads);
}

// ── Videolar ─────────────────────────────────────────────────────────────────

/** playlistItems.list öğesi → video id + yayın zamanı (silinmiş/özel videoda tarih yok). */
export function mapPlaylistItem(
  item: Record<string, unknown>,
): { videoId: string; publishedAt: Date | null } | null {
  const cd = obj(item.contentDetails);
  const videoId =
    str(cd.videoId) ?? str(obj(obj(item.snippet).resourceId).videoId);
  if (!videoId) return null;
  const at = str(cd.videoPublishedAt);
  const date = at ? new Date(at) : null;
  return {
    videoId,
    publishedAt: date && !Number.isNaN(date.getTime()) ? date : null,
  };
}

function dimensions(video: Record<string, unknown>) {
  const player = obj(video.player);
  const w = toCount(player.embedWidth);
  const h = toCount(player.embedHeight);
  return w && h ? { width: w, height: h } : { width: null, height: null };
}

/** Başlık + boş satır + açıklama (posts.caption; ikisi de yoksa ''). */
export function captionOf(snippet: Record<string, unknown>): string {
  const title = (str(snippet.title) ?? '').trim();
  const description = (str(snippet.description) ?? '').trim();
  return [title, description].filter(Boolean).join('\n\n');
}

/**
 * videos.list (snippet, contentDetails, status, player, liveStreamingDetails) → posts satırı.
 * Yayımlanmamış (özel, zamanlanmış, yaklaşan/süren canlı yayın) videolar için null.
 */
export function mapVideo(
  video: Record<string, unknown>,
  rule: ShortsRule = DEFAULT_SHORTS_RULE,
): CollectedPost | null {
  const id = str(video.id);
  const snippet = obj(video.snippet);
  const status = obj(video.status);
  if (!id) return null;
  if (status.privacyStatus === 'private') return null;
  const live = str(snippet.liveBroadcastContent);
  if (live === 'upcoming' || live === 'live') return null;
  const at = str(snippet.publishedAt);
  const publishedAt = at ? new Date(at) : null;
  if (!publishedAt || Number.isNaN(publishedAt.getTime())) return null;

  const durationS = parseIsoDuration(obj(video.contentDetails).duration);
  const { width, height } = dimensions(video);
  const isShort = detectShort(
    {
      durationS,
      width,
      height,
      live: Object.keys(obj(video.liveStreamingDetails)).length > 0,
    },
    rule,
  );
  return {
    externalId: id,
    url: isShort
      ? `https://www.youtube.com/shorts/${id}`
      : `https://www.youtube.com/watch?v=${id}`,
    caption: captionOf(snippet),
    publishedAt,
    durationS,
    isShort,
  };
}

// ── Metrikler ────────────────────────────────────────────────────────────────

/** videos.list `statistics` → views/likes/comments (Data API, gerçek zamana yakın). */
export function mapVideoStatistics(video: Record<string, unknown>) {
  const stats = obj(video.statistics);
  return {
    views: toCount(stats.viewCount),
    likes: toCount(stats.likeCount),
    comments: toCount(stats.commentCount),
    raw: { statistics: stats },
  };
}

export const ANALYTICS_METRICS = [
  'views',
  'estimatedMinutesWatched',
  'averageViewDuration',
  'averageViewPercentage',
  'subscribersGained',
  'shares',
] as const;

/**
 * Analytics `reports.query` (boyutsuz, `video==ID` filtreli) → ad → değer. Satır yoksa
 * (veri henüz işlenmedi, 24–48 sa gecikme) null.
 */
export function mapAnalyticsReport(
  body: Record<string, unknown>,
): Record<string, number> | null {
  const headers = Array.isArray(body.columnHeaders)
    ? body.columnHeaders.map((h) => str(obj(h).name))
    : [];
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const row = rows[0];
  if (!Array.isArray(row) || row.length === 0) return null;
  const out: Record<string, number> = {};
  headers.forEach((name, i) => {
    const v = row[i];
    if (name && typeof v === 'number' && Number.isFinite(v)) out[name] = v;
  });
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Data API sayaçları + (varsa) Analytics → CollectedMetrics.
 * - views/likes/comments: Data API (Analytics gecikmeli olduğundan sayaçlar oradan).
 * - shares: Analytics `shares` (Data API'de yok); Analytics yoksa null.
 * - avgWatchTimeS: `averageViewDuration` (saniye).
 * - completionRate: `averageViewPercentage / 100`; Shorts döngüde %100'ü aşabilir, 1'e
 *   kırpılır (ham değer raw.analytics'te kalır).
 * - saves/reach: YouTube'da karşılığı yok → null (orkestratör `_unmeasured`'a ekler).
 */
export function mapMetrics(
  stats: ReturnType<typeof mapVideoStatistics>,
  analytics: Record<string, number> | null,
  analyticsState: 'ok' | 'empty' | 'skipped' | 'unavailable',
): CollectedMetrics {
  const pct = analytics?.averageViewPercentage;
  const completion =
    typeof pct === 'number' && pct >= 0
      ? Math.min(1, Math.round(pct * 100) / 10_000)
      : null;
  const avg = analytics?.averageViewDuration;
  const shares = analytics?.shares;
  return {
    views: stats.views,
    likes: stats.likes,
    comments: stats.comments,
    shares:
      typeof shares === 'number' && shares >= 0 ? Math.round(shares) : null,
    saves: null,
    reach: null,
    avgWatchTimeS: typeof avg === 'number' && avg >= 0 ? avg : null,
    completionRate: completion,
    raw: {
      source: 'youtube',
      ...stats.raw,
      analytics: analytics ?? null,
      analyticsState,
    },
  };
}
