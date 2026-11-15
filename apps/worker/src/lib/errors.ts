// Hata sınıfları ve veritabanı hatalarının makine davranışına çevrilmesi.

/** Aşama kalıcı olarak başarısız: yeniden denemek sonucu değiştirmez (ör. geçersiz parametre). */
export class PermanentError extends Error {
  override name = 'PermanentError';
}

/** Aşama geçici olarak başarısız: iş kuyruğa dönüp yeniden denenebilir (ör. ağ, zaman aşımı). */
export class TransientError extends Error {
  override name = 'TransientError';
}

/** İş iptal edildi ya da makine duruyor: işleyici çalışmayı bırakmalı. */
export class AbortedError extends Error {
  override name = 'AbortedError';
}

/** Supabase REST/RPC hatası. `code` Postgres SQLSTATE'i ya da PostgREST kodu, `hint` çekirdeğin ipucu. */
export class ApiError extends Error {
  override name = 'ApiError';
  readonly status: number;
  readonly code: string | null;
  readonly hint: string | null;
  constructor(
    message: string,
    fields: { status: number; code?: string | null; hint?: string | null },
  ) {
    super(message);
    this.status = fields.status;
    this.code = fields.code ?? null;
    this.hint = fields.hint ?? null;
  }
}

/** Ağ hatası, zaman aşımı, 5xx ya da 429: çağrı sonra yeniden denenebilir. */
export class NetworkError extends Error {
  override name = 'NetworkError';
}

/** Giriş reddedildi (yanlış bilgi, süresi dolmuş bağlantı, çok fazla deneme). */
export class LoginError extends Error {
  override name = 'LoginError';
}

/** Oturum geçersiz (yenileme reddedildi): yeniden giriş gerekir. */
export class SessionError extends Error {
  override name = 'SessionError';
}

export function isRetryableApiFailure(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  return (
    error instanceof ApiError &&
    (error.status >= 500 || error.status === 429 || error.status === 408)
  );
}

/**
 * Makine RPC'sinin hatası ne anlama geliyor?
 *  - `retry`: geçici; aynı çağrı yeniden denenir
 *  - `lease_lost`: iş artık bu makinede değil; işleyici durdurulur, başka çağrı yapılmaz
 *  - `cancel_requested`: iptal istendi; işleyici durdurulur ve iptal onaylanır
 *  - `revoked`: makinenin yetkisi kaldırıldı ya da oturum makineye bağlı değil; program durur
 *  - `fatal`: beklenmeyen; iş bırakılır (kira dolunca kuyruğa döner)
 */
export type RpcFailure =
  'retry' | 'lease_lost' | 'cancel_requested' | 'revoked' | 'fatal';

export function classifyRpcFailure(error: unknown): RpcFailure {
  if (isRetryableApiFailure(error)) return 'retry';
  if (error instanceof SessionError) return 'revoked';
  if (!(error instanceof ApiError)) return 'fatal';
  if (error.hint === 'lease_lost') return 'lease_lost';
  if (error.hint === 'cancel_requested') return 'cancel_requested';
  if (
    error.hint === 'worker_revoked' ||
    error.hint === 'worker_session_required' ||
    error.status === 401
  )
    return 'revoked';
  // Makine RPC'sinde 42501: üyelik ya da rol kalktı
  if (error.code === '42501') return 'revoked';
  // İş bulunamadı ya da durum uymuyor: iş başka yerde ilerlemiş
  if (error.code === 'P0002' || error.code === '55000') return 'lease_lost';
  return 'fatal';
}

/** İşleyicinin fırlattığı hata `fail_stage`'e nasıl bildirilir? */
export function isRetryableStageError(error: unknown): boolean {
  if (error instanceof PermanentError) return false;
  if (error instanceof TransientError) return true;
  // Şema hatası (zod): girdi değişmeden sonuç değişmez
  if (error instanceof Error && error.name === 'ZodError') return false;
  // Bilinmeyen hata: sınırlı sayıda yeniden denenir (max_attempts veritabanında)
  return true;
}
