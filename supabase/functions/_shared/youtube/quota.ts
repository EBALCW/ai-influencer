// YouTube Data API v3 kota birimleri (#51). Tek doğruluk kaynağı bu tablodur.
// Kaynak (doğrulandı 22 Eki 2026): https://developers.google.com/youtube/v3/determine_quota_cost
//   - Okuma (list) çağrıları 1 birim; `part` sayısı maliyeti DEĞİŞTİRMEZ.
//   - search.list 100 birim (ayrıca günde 100 çağrılık kendi kovası var); kullanılmıyor.
//   - Proje başına günlük 10.000 birim; sayaç Pasifik saatiyle gece yarısı sıfırlanır.
// YouTube Analytics API (youtubeanalytics.googleapis.com) bu kotaya dahil DEĞİLDİR,
// kendi istek sınırı vardır; bu yüzden `reportQuota`'ya yazılmaz.

export const YOUTUBE_QUOTA_COST = {
  'channels.list': 1,
  'playlistItems.list': 1,
  'videos.list': 1,
  'search.list': 100,
  // Yorum gelen kutusu (#61): okuma 1, yanıt yazma 50 birim.
  'commentThreads.list': 1,
  'comments.insert': 50,
} as const;

export type YoutubeDataEndpoint = keyof typeof YOUTUBE_QUOTA_COST;

/** Varsayılan günlük proje kotası (Google Cloud konsolundan artırılabilir). */
export const YOUTUBE_DAILY_QUOTA = 10_000;

/** videos.list / playlistItems.list tek istekte en fazla bu kadar id/öğe alır. */
export const YOUTUBE_MAX_BATCH = 50;

export function quotaCost(endpoint: YoutubeDataEndpoint, calls = 1): number {
  return YOUTUBE_QUOTA_COST[endpoint] * calls;
}

/**
 * Tek hesabın bir çalışmasının tahmini maliyeti (README'deki tablo bununla üretildi).
 * - posts: channels.list (uploads listesi) + playlistItems sayfaları + videos.list (50'lik)
 * - accounts: channels.list
 * - metrics: post başına videos.list
 */
export function estimateRunUnits(
  job: 'posts' | 'accounts' | 'metrics',
  opts: { newVideos?: number; duePosts?: number } = {},
): number {
  if (job === 'accounts') return quotaCost('channels.list');
  if (job === 'metrics') return quotaCost('videos.list', opts.duePosts ?? 0);
  const n = Math.max(0, opts.newVideos ?? 0);
  const pages = Math.max(1, Math.ceil(n / YOUTUBE_MAX_BATCH));
  const batches = Math.ceil(n / YOUTUBE_MAX_BATCH);
  return (
    quotaCost('channels.list') +
    quotaCost('playlistItems.list', pages) +
    quotaCost('videos.list', batches)
  );
}

const pacificParts = (now: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    seconds:
      Number(get('hour')) * 3600 +
      Number(get('minute')) * 60 +
      Number(get('second')),
  };
};

/** Pasifik saatine göre gün (YYYY-MM-DD): kota günü ve Analytics rapor tarihleri. */
export function pacificDate(now: Date): string {
  return pacificParts(now).date;
}

/** Günlük kotanın sıfırlanmasına (Pasifik gece yarısı) kalan saniye. */
export function secondsUntilQuotaReset(now: Date): number {
  return Math.max(1, 86_400 - pacificParts(now).seconds);
}
