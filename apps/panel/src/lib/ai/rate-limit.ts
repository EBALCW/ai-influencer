/**
 * Kullanıcı başına basit, bellek içi istek sınırı (kayan pencere).
 * Süreç yeniden başlayınca sıfırlanır; kalıcı üst sınır `daily-cap.ts`'teki
 * veritabanı tabanlı günlük sınırdır (ikisi birlikte uygulanır).
 */
export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const hits = new Map<string, number[]>();

  return {
    /** İzin verildiyse `{ ok: true }`, aksi halde kaç saniye beklenmesi gerektiği. */
    check(
      key: string,
    ): { ok: true } | { ok: false; retryAfterSeconds: number } {
      const current = now();
      const windowStart = current - options.windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

      if (recent.length >= options.limit) {
        hits.set(key, recent);
        const oldest = recent[0] ?? current;
        const retryAfterMs = oldest + options.windowMs - current;
        return {
          ok: false,
          retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        };
      }

      recent.push(current);
      hits.set(key, recent);
      return { ok: true };
    },
    reset() {
      hits.clear();
    },
  };
}

/** /api/ai/* için: kullanıcı başına dakikada 10 istek. */
export const aiRateLimiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
