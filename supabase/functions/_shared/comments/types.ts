// Yorum gelen kutusu (#61) platform adaptörü sözleşmesi. Instagram ve YouTube adaptörleri bu
// arayüzü uygular ve `comments/index.ts`'e kaydolur.
//
// Adaptör, #53 toplayıcıları gibi SAF bir adaptördür: veritabanına yazmaz, token saklamaz,
// beklemez. Zamanlama, tekrar deneme, tekilleştirme ve yanıt kuyruğu `comments/runner.ts`'in
// işidir. Ağ çağrıları `ctx.fetch` ile yapılır; hata tipleri toplayıcılarla ortaktır
// (TokenExpiredError, RateLimitedError, TransientError, PermanentError).
import type { CollectorContext, SocialPlatform } from '../collectors/types.ts';

export type { CollectorContext, SocialPlatform };

/** Yorumları çekilecek post (posts satırı). */
export interface CommentPostRef {
  id: string;
  /** Platformdaki post id'si (YouTube video id, Instagram media id). */
  externalId: string;
  publishedAt: Date;
}

/**
 * Platformdan gelen yorum. Kişisel veri en aza indirilir: yazarın yalnız görünen adı alınır
 * (profil id'si, fotoğraf, e-posta YOK). Hesabın kendi yorumları adaptörde ayıklanır.
 */
export interface CollectedComment {
  externalId: string;
  /** Yanıt zincirindeki üst yorum; üst düzey yorumda null. */
  parentExternalId?: string | null;
  authorName: string;
  text: string;
  publishedAt: Date;
  likeCount?: number | null;
}

export interface CommentAdapter {
  readonly platform: SocialPlatform;
  /**
   * Postun `since`'tan yeni (veya eşit) üst düzey yorumları. Adaptör sayfalamayı `since`'a
   * ulaşınca ya da makul bir sayfa sınırında durdurur. Yorumlar kapalıysa / post silinmişse [].
   */
  fetchComments(
    ctx: CollectorContext,
    post: CommentPostRef,
    opts: { since: Date },
  ): Promise<CollectedComment[]>;
  /**
   * Yoruma yanıt yazar ve platformdaki yanıt id'sini döner. Bir kez çağrılır: platformların
   * idempotency anahtarı olmadığı için çift gönderim riski taşıyan hatalar (ağ hatası, 5xx)
   * tekrar denenmez (PermanentError).
   */
  reply(
    ctx: CollectorContext,
    input: { commentExternalId: string; text: string },
  ): Promise<{ externalId: string }>;
}
