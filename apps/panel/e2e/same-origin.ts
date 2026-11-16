/**
 * Değiştirici API istekleri panelin kendi origin'inden gelmelidir (CSRF denetimi, `src/proxy.ts`).
 * Tarayıcı bu başlığı kendisi ekler; Playwright'ın `request` API'si eklemez. Doğrudan API
 * çağıran testler bu başlığı gönderir. Değer `playwright.config.ts` → `baseURL` ile aynıdır.
 */
export const sameOrigin = { origin: 'http://127.0.0.1:3000' };
