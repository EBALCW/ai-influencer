// Zamanlama hesapları: yeniden deneme beklemesi, kira yenileme aralığı, token yenileme anı.
// Saf fonksiyonlar; saat ve rastgelelik dışarıdan verilir.

/** Veritabanının kabul ettiği kira aralığı (private.lease_interval ile aynı). */
export const LEASE_MIN_SECONDS = 30;
export const LEASE_MAX_SECONDS = 900;

export function clampLeaseSeconds(seconds: number): number {
  if (!Number.isFinite(seconds)) return 120;
  return Math.min(
    LEASE_MAX_SECONDS,
    Math.max(LEASE_MIN_SECONDS, Math.round(seconds)),
  );
}

/**
 * Kirayı ne sıklıkla uzatmalı: sürenin üçte biri. Böylece arka arkaya iki yenileme kaçsa bile
 * kira dolmadan üçüncü deneme yapılır. En az 1 saniye.
 */
export function leaseRenewIntervalMs(leaseSeconds: number): number {
  return Math.max(
    1000,
    Math.floor((clampLeaseSeconds(leaseSeconds) * 1000) / 3),
  );
}

/** Kira bitişine `marginMs`'ten az kaldıysa (ya da geçtiyse) iş bırakılmalıdır. */
export function leaseExpired(
  leaseExpiresAt: string | null,
  nowMs: number,
  marginMs = 0,
): boolean {
  if (!leaseExpiresAt) return true;
  const at = Date.parse(leaseExpiresAt);
  return !Number.isFinite(at) || at - marginMs <= nowMs;
}

export interface BackoffOptions {
  baseMs?: number;
  maxMs?: number;
  /** 0..1 arası değer döndüren kaynak (test için sabitlenir). */
  random?: () => number;
}

/**
 * Üstel bekleme + tam titreşim (full jitter): `attempt` 1'den başlar.
 * Aralık [taban/2, taban] × 2^(deneme-1), üst sınır `maxMs`.
 */
export function backoffMs(
  attempt: number,
  options: BackoffOptions = {},
): number {
  const base = options.baseMs ?? 1000;
  const max = options.maxMs ?? 60_000;
  const random = options.random ?? Math.random;
  const exponent = Math.min(Math.max(Math.floor(attempt), 1) - 1, 20);
  const ceiling = Math.min(max, base * 2 ** exponent);
  return Math.round(ceiling / 2 + (ceiling / 2) * random());
}

/**
 * Erişim token'ı ne zaman yenilenmeli: ömrünün son beşte biri ya da son 5 dakikası (hangisi
 * daha erkense). Dönen değer epoch milisaniyedir.
 */
export function refreshAtMs(issuedAtMs: number, expiresAtMs: number): number {
  const lifetime = Math.max(0, expiresAtMs - issuedAtMs);
  const margin = Math.max(Math.min(lifetime / 5, 5 * 60_000), 5000);
  return expiresAtMs - margin;
}

/** İlerleme değeri: 0..100 tamsayı. */
export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}
