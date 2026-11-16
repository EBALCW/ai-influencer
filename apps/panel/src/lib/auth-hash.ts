/**
 * Davet ve bazı e-posta bağlantıları oturumu adresin `#…` kısmında taşır (implicit akış):
 * `#access_token=…&refresh_token=…&type=invite`. Bu kısım sunucuya gönderilmez; tarayıcıda
 * okunur. Hata durumunda `#error=…&error_code=otp_expired&error_description=…` gelir.
 */
export type AuthHash =
  | { kind: 'session'; accessToken: string; refreshToken: string }
  | { kind: 'error'; code: string };

export function parseAuthHash(
  hash: string | null | undefined,
): AuthHash | null {
  if (!hash) return null;
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken)
    return { kind: 'session', accessToken, refreshToken };
  if (params.has('error') || params.has('error_code'))
    return {
      kind: 'error',
      code: (
        params.get('error_code') ??
        params.get('error') ??
        'unknown'
      ).slice(0, 60),
    };
  return null;
}

/** Bağlantı hatası için kullanıcıya gösterilecek metin. */
export function authHashErrorMessage(code: string): string {
  if (code === 'otp_expired' || code === 'used')
    return 'Bağlantının süresi dolmuş ya da daha önce kullanılmış. Aşağıdan yeni giriş bağlantısı iste.';
  return 'Bağlantı doğrulanamadı. Aşağıdan yeni giriş bağlantısı iste.';
}
