// Platform veri toplayıcı sözleşmesi (#53). Instagram (#50), YouTube (#51) ve TikTok
// toplayıcıları bu arayüzü uygular ve `collectors/index.ts`'e kaydolur. Nasıl eklenir:
// `collectors/README.md`.
//
// Toplayıcı SAF bir adaptördür: veritabanına yazmaz, token saklamaz, uyku/bekleme yapmaz.
// Zamanlama, tekrar deneme, backoff, idempotent yazım ve hesap durumunu güncelleme
// orkestratörün (`_shared/sync/orchestrator.ts`) işidir.

export type SocialPlatform = 'instagram' | 'youtube' | 'tiktok';

/** Toplanacak hesap (social_accounts satırının toplayıcıya açık alanları). */
export interface SyncAccount {
  id: string;
  influencerId: string;
  platform: SocialPlatform;
  handle: string;
  /** Platformdaki hesap/kanal id'si; bağlantı (#49) doldurur. */
  externalId: string | null;
  status: 'active' | 'error';
}

/** Vault'tan okunan token paketi (#49 `read_social_token`). Loglanmaz, döndürülmez. */
export interface SocialToken {
  accessToken: string;
  refreshToken?: string;
  tokenType?: string;
  scope?: string;
}

export interface CollectorContext {
  account: SyncAccount;
  token: SocialToken;
  /** Tüm ağ çağrıları bununla yapılır; testlerde sahte fetch verilir. */
  fetch: typeof fetch;
  /** Çalışmanın referans zamanı (UTC). */
  now: Date;
  /** API kota birimi harcandıkça çağrılır; toplam `sync_runs.quota_units`'e yazılır. */
  reportQuota(units: number): void;
  /** Uyarı logu (ör. bilinmeyen metrik adı). Token/URL/yanıt gövdesi YAZMAYIN. */
  warn(message: string): void;
}

/** account_snapshots satırı. Ölçülmeyen değer null (0 değil). */
export interface CollectedAccount {
  followers: number;
  following?: number | null;
  mediaCount?: number | null;
  reachDay?: number | null;
  profileViews?: number | null;
  /** Hesabın toplam görüntülenmesi (YouTube kanal viewCount, #51); yoksa null. */
  totalViews?: number | null;
}

/** posts satırı; (account_id, external_id) ile upsert edilir. */
export interface CollectedPost {
  externalId: string;
  url?: string | null;
  caption?: string;
  /** UTC. Yayın zamanı bilinmeyen (taslak vb.) post döndürmeyin. */
  publishedAt: Date;
  durationS?: number | null;
  isShort?: boolean;
}

/** Metrik istenen post. */
export interface PostRef {
  id: string;
  externalId: string;
  publishedAt: Date;
  /** Zamanlanmış kontrol noktası (1, 5, 24, 72, 168) ya da ad-hoc ölçüm için null. */
  targetHours: number | null;
}

/**
 * metric_snapshots alanları. Gelmeyen metrik `null`/`undefined` bırakılır; orkestratör
 * NOT NULL kolonlara 0 yazar ve adını `raw._unmeasured` listesine ekler (ölçülmedi ≠ sıfır).
 */
export interface CollectedMetrics {
  views?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  avgWatchTimeS?: number | null;
  /** 0–1 aralığında (YouTube averageViewPercentage / 100). */
  completionRate?: number | null;
  /** Ham API yanıtı (kişisel/gizli alan içermeyen kısmı); metrik adları değişirse veri kaybolmaz. */
  raw: Record<string, unknown>;
}

export interface Collector {
  readonly platform: SocialPlatform;
  /** Hesap istatistikleri (günlük snapshot). */
  fetchAccount(ctx: CollectorContext): Promise<CollectedAccount>;
  /**
   * Hesabın postları. `since` bilinen en yeni yayın zamanıdır (null = ilk senkron);
   * toplayıcı sayfalamayı en az bu tarihe kadar sürdürür, makul bir üst sınır uygular.
   */
  fetchPosts(
    ctx: CollectorContext,
    opts: { since: Date | null },
  ): Promise<CollectedPost[]>;
  /** Tek postun metrikleri. Post platformda yoksa (silinmiş) null. */
  fetchPostMetrics(
    ctx: CollectorContext,
    post: PostRef,
  ): Promise<CollectedMetrics | null>;
}

// ── Tipli hatalar ──────────────────────────────────────────────────────────
// Mesajlara token, istek URL'i (?access_token=) veya sağlayıcı yanıt gövdesi KOYMAYIN.

export class CollectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Token süresi dolmuş/iptal edilmiş. Hesap durumu güncellenir, hesabın işi durur. */
export class TokenExpiredError extends CollectorError {
  constructor(
    message = 'Token geçersiz veya süresi dolmuş',
    /** 'expired': süre doldu; 'error': iptal/izin kaybı (sync_failed uyarısı üretir). */
    readonly accountStatus: 'expired' | 'error' = 'expired',
  ) {
    super(message);
  }
}

/** Rate limit / kota. Kısa bekleme süresinde tekrar denenir, değilse sonraki çalışmaya kalır. */
export class RateLimitedError extends CollectorError {
  constructor(
    message = 'Rate limit',
    /** Sağlayıcının önerdiği bekleme (saniye); bilinmiyorsa null. */
    readonly retryAfterSeconds: number | null = null,
    /** 'platform': kota tüm uygulamada (YouTube projesi) → bu çalışmada platformun diğer hesapları da atlanır. */
    readonly scope: 'account' | 'platform' = 'account',
  ) {
    super(message);
  }
}

/** Geçici hata (5xx, ağ). Üstel backoff ile tekrar denenir. */
export class TransientError extends CollectorError {}

/** Kalıcı hata (4xx, beklenmeyen yanıt). Tekrar denenmez. */
export class PermanentError extends CollectorError {}

/** Retry-After başlığı: saniye ya da HTTP tarihi. */
export function parseRetryAfter(
  value: string | null,
  now: Date = new Date(),
): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const at = Date.parse(value);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - now.getTime()) / 1000));
}

/**
 * Başarısız HTTP yanıtı için varsayılan hata sınıflandırması. Platforma özgü durumları
 * (ör. Instagram 400 + code 190 = token) toplayıcı bundan önce kendisi ele alır.
 */
export function errorForResponse(
  response: Response,
  label: string,
): CollectorError {
  const status = response.status;
  if (status === 401)
    return new TokenExpiredError(`${label}: yetki reddedildi (401)`);
  if (status === 429) {
    return new RateLimitedError(
      `${label}: rate limit (429)`,
      parseRetryAfter(response.headers.get('retry-after')),
    );
  }
  if (status >= 500 || status === 408) {
    return new TransientError(`${label}: geçici hata (${status})`);
  }
  return new PermanentError(`${label}: istek reddedildi (${status})`);
}
