/**
 * Yayıncı klipleri (#173) için saf yardımcılar: YouTube linkinden video id'si,
 * kanonik link ve `mm:ss` zaman girişi. Veritabanı kanonik linki zorunlu tutar
 * (`supabase/migrations/20261112100000_streamer_clips.sql`).
 */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const WATCH_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
]);
const PATH_PREFIXES = ['shorts', 'live', 'embed', 'v'];

/** YouTube linkinden 11 karakterli video id'sini çıkarır; tanınmayan link `null`. */
export function parseYouTubeVideoId(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase();
  const segments = url.pathname.split('/').filter(Boolean);
  let id: string | null | undefined;
  if (host === 'youtu.be') id = segments[0];
  else if (WATCH_HOSTS.has(host)) {
    if (segments[0] === 'watch') id = url.searchParams.get('v');
    else if (segments[0] && PATH_PREFIXES.includes(segments[0]))
      id = segments[1];
  }
  return id && VIDEO_ID.test(id) ? id : null;
}

/** Veritabanında tutulan tek biçim. */
export function canonicalVideoUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/** Klibin başladığı saniyeye giden link (içerik kartındaki `source_url` ile aynı). */
export function clipUrl(videoUrl: string, startSeconds: number) {
  return `${videoUrl}&t=${startSeconds}s`;
}

/**
 * `ss`, `mm:ss` veya `h:mm:ss` girişini saniyeye çevirir. Boş ya da geçersiz
 * giriş `null`. İki nokta kullanıldığında ilk parça dışındakiler 59'u aşamaz;
 * `mm:ss` biçiminde dakika serbesttir (ör. `95:10`).
 */
export function parseTimestamp(input: string): number | null {
  const value = input.trim();
  if (!/^\d{1,5}(:\d{1,2}){0,2}$/.test(value)) return null;
  const parts = value.split(':').map(Number);
  if (parts.slice(1).some((part) => part > 59)) return null;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** Saniyeyi `m:ss` (bir saatten uzunsa `h:mm:ss`) olarak yazar. */
export function formatTimestamp(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
