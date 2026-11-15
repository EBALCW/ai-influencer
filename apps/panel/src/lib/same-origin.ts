import type { NextRequest } from 'next/server';

/**
 * Durum değiştiren API isteği panelin kendi sayfasından mı geliyor? (CSRF koruması)
 *
 * `lib/oauth` uçlarındaki kuralın aynısı: `Origin` başlığı isteğin kendi origin'i olmalı.
 * `next start` yerel adresi `localhost` olarak görürken tarayıcı `127.0.0.1` kullanabildiği
 * için `request.nextUrl.origin`'e ek olarak isteğin geldiği sunucu adı (`Host`) da kabul edilir.
 * `Origin` yoksa ya da başka bir siteyse istek reddedilir.
 */
export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  if (origin === request.nextUrl.origin) return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = request.headers.get('host');
  return host !== null && host !== '' && url.host === host;
}
