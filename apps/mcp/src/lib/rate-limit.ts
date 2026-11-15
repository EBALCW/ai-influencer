// Süreç içi hız sınırı (oturum = bu sunucu süreci). Jeton kovası: okuma ve yazma ayrı kovalardır;
// yazma ayrıca oturum boyu toplam sınırla korunur. Amaç kötü niyetli ya da döngüye girmiş bir
// modelin veritabanını ve çalışma alanını çöple doldurmasını yavaşlatmaktır; veritabanındaki
// sınırların (ör. alan başına 500 seri, istek başına 20 öneri) yerine geçmez.

export type BucketConfig = {
  /** Kovanın kapasitesi (ani çağrı sayısı). */
  readonly capacity: number;
  /** Dakikada dolan jeton sayısı. */
  readonly refillPerMinute: number;
};

export type RateLimitConfig = {
  readonly read: BucketConfig;
  readonly write: BucketConfig;
  /** Süreç ömrü boyunca en çok yazma çağrısı. */
  readonly writeSessionCap: number;
};

export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  read: { capacity: 60, refillPerMinute: 120 },
  write: { capacity: 10, refillPerMinute: 20 },
  writeSessionCap: 500,
};

export type RateDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason: 'rate' | 'session_cap';
      readonly retryAfterSeconds: number;
    };

type Bucket = { tokens: number; updatedAt: number };

export class RateLimiter {
  readonly #config: RateLimitConfig;
  readonly #now: () => number;
  readonly #buckets: Record<'read' | 'write', Bucket>;
  #writes = 0;

  constructor(
    config: RateLimitConfig = DEFAULT_RATE_LIMITS,
    now: () => number = Date.now,
  ) {
    this.#config = config;
    this.#now = now;
    const at = now();
    this.#buckets = {
      read: { tokens: config.read.capacity, updatedAt: at },
      write: { tokens: config.write.capacity, updatedAt: at },
    };
  }

  take(kind: 'read' | 'write'): RateDecision {
    if (kind === 'write' && this.#writes >= this.#config.writeSessionCap) {
      return { allowed: false, reason: 'session_cap', retryAfterSeconds: 0 };
    }
    const config = this.#config[kind];
    const bucket = this.#buckets[kind];
    const now = this.#now();
    const elapsedMinutes = Math.max(0, now - bucket.updatedAt) / 60_000;
    bucket.tokens = Math.min(
      config.capacity,
      bucket.tokens + elapsedMinutes * config.refillPerMinute,
    );
    bucket.updatedAt = now;
    if (bucket.tokens < 1) {
      const missing = 1 - bucket.tokens;
      return {
        allowed: false,
        reason: 'rate',
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((missing / config.refillPerMinute) * 60),
        ),
      };
    }
    bucket.tokens -= 1;
    if (kind === 'write') this.#writes += 1;
    return { allowed: true };
  }
}
