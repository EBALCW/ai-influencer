/**
 * Gelir raporu ve pipeline toplamları. Saf fonksiyonlar, istemci ve sunucuda kullanılabilir.
 *
 * Para kuralları (#59 money.ts): float yok, farklı para birimleri dönüşümsüz toplanmaz.
 * Dönüşüm veritabanında (`brand_deal_revenue`, `cost_summary`) ödeme/harcama günü kuruyla
 * yapılır; kuru olmayan kayıt varsa o ayın toplamı `null` döner ve sayısı raporlanır.
 * Aylık gelir `paid_at`'e göre hesaplanır; `lost` deal'ler hiçbir toplama girmez.
 */
import {
  compareDecimals,
  fromMinor,
  sumDecimals,
  toMinor,
  type Decimal,
} from '@/lib/costs/money';
import type { DealStage } from './schemas';

export type RevenueDeal = {
  id: string;
  stage: DealStage;
  paid_at: string | null;
  fee: Decimal | null;
  /** Hedef para birimine çevrilmiş ücret; null = kur yok */
  converted_fee: Decimal | null;
};

export type MonthCost = {
  month: string;
  /** Hedef para biriminde toplam; null = eksik kur */
  total: Decimal | null;
  missingRateCount: number;
};

export type RevenueRow = {
  month: string;
  revenue: string | null;
  dealCount: number;
  /** Kuru tanımlı olmayan ödenmiş deal sayısı */
  missingRateCount: number;
  /** Ücreti girilmemiş ödenmiş deal sayısı (0 sayılır, ayrıca gösterilir) */
  unpricedCount: number;
  cost: string | null;
  costMissingRateCount: number;
  profit: string | null;
};

export type RevenueReport = {
  rows: RevenueRow[];
  totals: Omit<RevenueRow, 'month'>;
};

/** "2026-09" -> ["2026-04", …, "2026-09"] (count ay, son ay dahil) */
export function monthRange(lastMonth: string, count: number): string[] {
  const match = /^(\d{4})-(\d{2})$/.exec(lastMonth);
  if (!match) throw new RangeError(`Geçersiz ay: ${lastMonth}`);
  const end = Number(match[1]) * 12 + Number(match[2]) - 1;
  return Array.from({ length: count }, (_, index) => {
    const value = end - (count - 1 - index);
    const year = Math.floor(value / 12);
    const month = (value % 12) + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  });
}

/** Ayın ilk ve son günü (date). */
export function monthBounds(month: string): { from: string; to: string } {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, '0')}`,
  };
}

function subtract(a: string | null, b: string | null): string | null {
  if (a === null || b === null) return null;
  return fromMinor(toMinor(a) - toMinor(b));
}

export function buildRevenueReport(input: {
  months: string[];
  deals: RevenueDeal[];
  costs: MonthCost[];
}): RevenueReport {
  const rows = input.months.map((month): RevenueRow => {
    // Yalnız ödenmiş ve ödeme tarihi bu ayda olan deal'ler; lost ve diğerleri hariç
    const deals = input.deals.filter(
      (deal) =>
        deal.stage === 'paid' &&
        deal.paid_at !== null &&
        deal.paid_at.slice(0, 7) === month,
    );
    const priced = deals.filter((deal) => deal.fee !== null);
    const missing = priced.filter((deal) => deal.converted_fee === null);
    const revenue =
      missing.length > 0
        ? null
        : sumDecimals(priced.map((deal) => deal.converted_fee as Decimal));
    const cost = input.costs.find((item) => item.month === month);
    const costTotal =
      cost && cost.total !== null && cost.missingRateCount === 0
        ? fromMinor(toMinor(cost.total))
        : cost
          ? null
          : '0.0000';
    return {
      month,
      revenue,
      dealCount: deals.length,
      missingRateCount: missing.length,
      unpricedCount: deals.length - priced.length,
      cost: costTotal,
      costMissingRateCount: cost?.missingRateCount ?? 0,
      profit: subtract(revenue, costTotal),
    };
  });

  const sumOrNull = (values: Array<string | null>) =>
    values.some((value) => value === null)
      ? null
      : sumDecimals(values as string[]);
  const revenue = sumOrNull(rows.map((row) => row.revenue));
  const cost = sumOrNull(rows.map((row) => row.cost));
  return {
    rows,
    totals: {
      revenue,
      dealCount: rows.reduce((acc, row) => acc + row.dealCount, 0),
      missingRateCount: rows.reduce(
        (acc, row) => acc + row.missingRateCount,
        0,
      ),
      unpricedCount: rows.reduce((acc, row) => acc + row.unpricedCount, 0),
      cost,
      costMissingRateCount: rows.reduce(
        (acc, row) => acc + row.costMissingRateCount,
        0,
      ),
      profit: subtract(revenue, cost),
    },
  };
}

export type PipelineDeal = {
  stage: DealStage;
  fee: Decimal | null;
  currency: string;
};

/**
 * Açık + kazanılmış pipeline değeri, para birimi başına (dönüşüm yok).
 * `lost` deal'ler ve ücreti girilmemiş deal'ler toplama girmez.
 */
export function pipelineTotals(
  deals: PipelineDeal[],
): Array<{ currency: string; total: string; count: number }> {
  const groups = new Map<string, Decimal[]>();
  for (const deal of deals) {
    if (deal.stage === 'lost' || deal.fee === null) continue;
    const list = groups.get(deal.currency) ?? [];
    list.push(deal.fee);
    groups.set(deal.currency, list);
  }
  return [...groups.entries()]
    .map(([currency, fees]) => ({
      currency,
      total: sumDecimals(fees),
      count: fees.length,
    }))
    .sort(
      (a, b) =>
        compareDecimals(b.total, a.total) ||
        a.currency.localeCompare(b.currency),
    );
}
