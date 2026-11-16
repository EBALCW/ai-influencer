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

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Merkezi denetim (`src/proxy.ts`): `/api/**` altındaki durum değiştiren (GET/HEAD/OPTIONS
 * dışı) her istek panelin kendi sayfasından gelmelidir. `true` ise istek reddedilir (403).
 *
 * Muafiyet yoktur, çünkü bu uçların tarayıcı dışı meşru çağıranı yok (#254'te koddan sayıldı):
 * - OAuth geri dönüşleri (`/api/oauth/[platform]/callback`, `/auth/callback`) GET'tir.
 * - Webhook alan uç yok; zamanlanmış işler (pg_cron → Edge Function) ve Edge Function'lar
 *   panele değil Supabase'e bağlanır.
 * - Üretim makinesi (`apps/worker`) ve MCP sunucusu (`apps/mcp`) panel API'sini çağırmaz,
 *   Supabase RPC'lerini kullanır.
 * Yeni bir makine-makine ucu gerekirse buraya gerekçesiyle, kendi kimlik doğrulamasıyla
 * (ör. paylaşılan sır) muaf yol olarak eklenir; denetim gevşetilmez.
 */
export function isCrossOriginApiMutation(request: NextRequest): boolean {
  if (!request.nextUrl.pathname.startsWith('/api/')) return false;
  if (SAFE_METHODS.has(request.method.toUpperCase())) return false;
  return !isSameOrigin(request);
}
