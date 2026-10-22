// Platform yayıncı (publisher) sözleşmesi (#58). Instagram Reels ve YouTube Shorts adaptörleri bu
// arayüzü uygular; `publishers/index.ts`'e kaydolur.
//
// Yayıncı SAF bir adaptördür: veritabanına yazmaz, token saklamaz, beklemez. Kuyruk, tekrar
// deneme, backoff, hesap durumu ve posts yazımı `publish-scheduled/worker.ts`'in işidir.
// Hatalar collectors/types.ts'teki tipli hata sınıflarıyla fırlatılır (TokenExpiredError,
// RateLimitedError, TransientError, PermanentError). Mesajlara token, URL veya yanıt gövdesi
// konmaz.
import type { SocialToken } from '../collectors/types.ts';

export type PublishPlatform = 'instagram' | 'youtube';

/** Final video asset'i (assets satırı). */
export interface PublishVideo {
  /** Kısa ömürlü imzalı Storage adresi (Instagram videoyu buradan çeker). Loglanmaz. */
  url: string;
  mimeType: string;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

export interface PublishInput {
  jobId: string;
  account: {
    id: string;
    platform: PublishPlatform;
    /** Platformdaki hesap/kanal id'si (Instagram kullanıcı id'si). */
    externalId: string | null;
  };
  title: string;
  caption: string;
  tags: string[];
  paidPartnership: boolean;
  video: PublishVideo;
  /** Önceki çalıştırmalardan kalan sağlayıcı durumu. */
  containerId: string | null;
  containerCreatedAt: Date | null;
  uploadUrl: string | null;
}

export interface PublishCheckpoint {
  containerId?: string | null;
  containerCreatedAt?: Date | null;
  uploadUrl?: string | null;
}

export interface PublishContext {
  token: SocialToken;
  /** Tüm ağ çağrıları bununla yapılır; testlerde sahte fetch verilir. */
  fetch: typeof fetch;
  now: Date;
  /** Video baytları (YouTube yüklemesi için). */
  loadVideo(): Promise<Uint8Array<ArrayBuffer>>;
  /**
   * Sağlayıcı durumunu HEMEN kalıcı yazar (container id, upload oturumu). Worker yarıda kalsa
   * bile sonraki çalıştırma aynı container/oturumdan devam eder; çift yayın oluşmaz.
   */
  checkpoint(state: PublishCheckpoint): Promise<void>;
  warn(message: string): void;
}

export type PublishOutcome =
  | {
      kind: 'published';
      externalId: string;
      url: string | null;
      publishedAt: Date | null;
      durationS: number | null;
      isShort: boolean;
    }
  /** Sağlayıcı işliyor (Instagram container); `retryAfterSeconds` sonra tekrar yokla. */
  | { kind: 'pending'; retryAfterSeconds: number }
  /** API ile güvenle yayınlanamaz; kullanıcı uygulamadan elle yayınlar. */
  | { kind: 'manual_required'; reason: string };

export interface PublisherCapabilities {
  /** Platformun AI içerik etiketi API'den verilebiliyor mu (#32). */
  aiLabel: boolean;
  /** Ücretli ortaklık / ürün yerleştirme etiketi API'den verilebiliyor mu. */
  paidPartnership: boolean;
}

export interface Publisher {
  readonly platform: PublishPlatform;
  readonly capabilities: PublisherCapabilities;
  publish(ctx: PublishContext, input: PublishInput): Promise<PublishOutcome>;
}
