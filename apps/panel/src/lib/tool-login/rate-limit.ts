/**
 * Giriş kodu üretimi için kullanıcı başına, süreç içi hız sınırı (docs/AUTH.md → "Araç girişi").
 *
 * Panel ekip bilgisayarında tek süreç olarak çalışır; sınır o sürecin belleğindedir ve yeniden
 * başlatınca sıfırlanır. Amaç kötüye kullanımı pahalılaştırmaktır, tek savunma değildir: uç
 * ayrıca oturum, rol, istek kaynağı ve "insan oturumu" denetimlerinden geçer. Anahtar istemcinin
 * yazabildiği bir başlık değil, sunucunun doğruladığı kullanıcı kimliğidir.
 */
export const TOOL_LOGIN_LIMIT = 5;
export const TOOL_LOGIN_WINDOW_MS = 10 * 60_000;

export function createToolLoginLimiter(
  limit: number = TOOL_LOGIN_LIMIT,
  windowMs: number = TOOL_LOGIN_WINDOW_MS,
  now: () => number = Date.now,
) {
  const hits = new Map<string, number[]>();
  return {
    /** Hak varsa düşer ve true döner; pencere doluysa false. */
    take(userId: string): boolean {
      const cutoff = now() - windowMs;
      // Süresi geçen kayıtları at: harita kullanıcı sayısıyla sınırlı kalır.
      for (const [key, times] of hits) {
        const fresh = times.filter((time) => time > cutoff);
        if (fresh.length === 0) hits.delete(key);
        else hits.set(key, fresh);
      }
      const mine = hits.get(userId) ?? [];
      if (mine.length >= limit) return false;
      hits.set(userId, [...mine, now()]);
      return true;
    },
  };
}
