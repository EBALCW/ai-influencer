/**
 * Ay seçimi (`?month=YYYY-MM`). Bütçe ve özetler `incurred_on` (date) üzerinden
 * hesaplanır; saat dilimi dönüşümü yapılmaz. Tarihler metin olarak üretilir.
 */
export type MonthPeriod = { month: string; from: string; to: string };

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function parseMonth(
  value: string | undefined,
  today: string,
): MonthPeriod {
  const fallback = today.slice(0, 7);
  const month = value && MONTH.test(value) ? value : fallback;
  const [y, m] = month.split('-').map(Number) as [number, number];
  // Ayın son günü: bir sonraki ayın 0. günü (UTC ile hesaplanır, saat dilimi yok)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    month,
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
  };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
