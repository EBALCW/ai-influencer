// Yayın ayarları (#58). Platform limitleri ve API sürümleri değişebildiği için koda gömülmez:
// varsayılanlar burada, ortam değişkeniyle (Edge Function secret) değiştirilebilir.
//
// Doğrulama (okuma tarihi 2026-10-22):
// * YouTube videos.insert: status.containsSyntheticMedia (AI/altered içerik açıklaması),
//   status.selfDeclaredMadeForKids, paidProductPlacementDetails.hasPaidProductPlacement.
//   https://developers.google.com/youtube/v3/docs/videos
//   Not: Denetimden (audit) geçmemiş API projelerinin yüklemeleri platform tarafından "private"
//   kilitlenir; YOUTUBE_PRIVACY_STATUS=public bunu aşmaz.
// * Instagram Content Publishing (Instagram Login): Reels container (media_type=REELS,
//   video_url) → status_code yoklama (dakikada bir, en çok ~5 dk önerilir) → media_publish.
//   `is_ai_generated=true` AI etiketi. Ücretli ortaklık etiketi (is_paid_partnership) yalnız
//   Facebook Login ile; bu proje Instagram Login kullandığı için desteklenmez → manual_required.
//   24 saatlik yayın limiti sabit değildir; her container öncesi `content_publishing_limit`
//   uç noktasından okunur.
//   https://developers.facebook.com/docs/instagram-platform/content-publishing
// * Trend/lisanslı ses API ile eklenemez; ses videoya gömülü gelir (docs/data-model.md).
import type { PublishPlatform, PublisherCapabilities } from './types.ts';

export const PLATFORM_CAPABILITIES: Record<
  PublishPlatform,
  PublisherCapabilities
> = {
  youtube: { aiLabel: true, paidPartnership: true },
  instagram: { aiLabel: true, paidPartnership: false },
};

export type YoutubePrivacy = 'public' | 'unlisted' | 'private';

export interface PublishConfig {
  youtube: {
    privacyStatus: YoutubePrivacy;
    /** 22 = People & Blogs. */
    categoryId: string;
    /** Short ise açıklamaya #Shorts eklenir (yoksa). */
    addShortsTag: boolean;
  };
  instagram: {
    graphBase: string;
    version: string;
    /** Container durumunu yoklama aralığı (saniye). */
    pollSeconds: number;
    /** Container bu süreden uzun işlenirse iş başarısız sayılır (dakika). */
    maxContainerMinutes: number;
    shareToFeed: boolean;
  };
  /** Storage `assets` bucket'ının sınırıyla aynı (100 MB). */
  maxVideoBytes: number;
  /** Instagram'ın videoyu çekeceği imzalı adresin ömrü (saniye). */
  signedUrlSeconds: number;
}

export const DEFAULT_PUBLISH_CONFIG: PublishConfig = {
  youtube: { privacyStatus: 'public', categoryId: '22', addShortsTag: true },
  instagram: {
    graphBase: 'https://graph.instagram.com',
    version: 'v23.0',
    pollSeconds: 60,
    maxContainerMinutes: 30,
    shareToFeed: true,
  },
  maxVideoBytes: 104857600,
  signedUrlSeconds: 2 * 60 * 60,
};

type Env = { get(key: string): string | undefined };

const privacy = new Set(['public', 'unlisted', 'private']);

/** Ortam değişkenlerinden yapılandırma; geçersiz değer varsayılana düşer. */
export function publishConfigFromEnv(env: Env): PublishConfig {
  const d = DEFAULT_PUBLISH_CONFIG;
  const p = env.get('YOUTUBE_PRIVACY_STATUS')?.trim();
  const v = env.get('INSTAGRAM_GRAPH_VERSION')?.trim();
  const max = Number(env.get('PUBLISH_MAX_VIDEO_BYTES') ?? '');
  return {
    youtube: {
      ...d.youtube,
      privacyStatus: p && privacy.has(p) ? (p as YoutubePrivacy) : 'public',
    },
    instagram: {
      ...d.instagram,
      version: v && /^v\d{1,3}\.\d$/.test(v) ? v : d.instagram.version,
    },
    maxVideoBytes:
      Number.isInteger(max) && max > 0
        ? max
        : DEFAULT_PUBLISH_CONFIG.maxVideoBytes,
    signedUrlSeconds: d.signedUrlSeconds,
  };
}
