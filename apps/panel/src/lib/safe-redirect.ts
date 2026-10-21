/**
 * Giriş sonrası yönlendirme hedefini aynı origin'deki bir yola indirger.
 * `//evil.com`, `/\evil.com`, `https://evil.com` gibi değerler ana sayfaya döner.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/')) return '/';
  // Tarayıcılar `\` karakterini `/` gibi yorumlar; kontrol karakterleri de reddedilir
  if (/[\\\u0000-\u001f]/.test(value)) return '/';

  const base = 'http://panel.invalid';
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return '/';
  }
  if (url.origin !== base) return '/';
  return `${url.pathname}${url.search}${url.hash}`;
}
