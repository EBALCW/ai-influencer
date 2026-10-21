import { compareDecimals, type Decimal } from './money';

export type BudgetLevel = 'ok' | 'warning' | 'exceeded' | 'unknown';

/**
 * Bütçe seviyesi. Veritabanındaki `raise_budget_alerts` ile aynı kural:
 * oran >= warn_ratio -> uyarı, oran >= 1 -> aşıldı. Oran NULL ise (eksik kur) bilinmiyor.
 * Karşılaştırma ondalık olarak yapılır; 0.79999 asla 0.8 sayılmaz.
 */
export function budgetLevel(
  ratio: Decimal | null | undefined,
  warnRatio: Decimal,
): BudgetLevel {
  if (ratio === null || ratio === undefined) return 'unknown';
  if (compareDecimals(ratio, 1) >= 0) return 'exceeded';
  if (compareDecimals(ratio, warnRatio) >= 0) return 'warning';
  return 'ok';
}

/** İlerleme çubuğu için 0-100 arası yüzde (aşımda 100'de kalır). */
export function budgetPercent(ratio: Decimal | null | undefined): number {
  if (ratio === null || ratio === undefined) return 0;
  const value = Number(ratio) * 100;
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(100, Math.round(value * 10) / 10);
}
