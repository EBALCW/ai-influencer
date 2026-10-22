import { describe, expect, it } from 'vitest';
import {
  buildRevenueReport,
  monthBounds,
  monthRange,
  pipelineTotals,
  type RevenueDeal,
} from './revenue';

const deal = (overrides: Partial<RevenueDeal>): RevenueDeal => ({
  id: crypto.randomUUID(),
  stage: 'paid',
  paid_at: '2026-09-15',
  fee: '100.00',
  converted_fee: '100.0000',
  ...overrides,
});

describe('monthRange / monthBounds', () => {
  it('yıl sınırını geçen ay listesi üretir', () => {
    expect(monthRange('2026-02', 4)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });
  it('ayın son gününü doğru verir (artık yıl dahil)', () => {
    expect(monthBounds('2028-02')).toEqual({
      from: '2028-02-01',
      to: '2028-02-29',
    });
    expect(monthBounds('2026-09').to).toBe('2026-09-30');
  });
});

describe('buildRevenueReport', () => {
  const months = ['2026-09', '2026-10'];
  const costs = [
    { month: '2026-09', total: '50.5000', missingRateCount: 0 },
    { month: '2026-10', total: '0', missingRateCount: 0 },
  ];

  it('paid_at ay sınırına göre gruplar (30 Eylül eylül, 1 Ekim ekim)', () => {
    const report = buildRevenueReport({
      months,
      costs,
      deals: [
        deal({ paid_at: '2026-09-30', converted_fee: '10.1000' }),
        deal({ paid_at: '2026-10-01', converted_fee: '20.0000' }),
      ],
    });
    expect(report.rows[0]).toMatchObject({
      month: '2026-09',
      revenue: '10.1000',
      dealCount: 1,
      cost: '50.5000',
      profit: '-40.4000',
    });
    expect(report.rows[1]).toMatchObject({
      revenue: '20.0000',
      profit: '20.0000',
    });
  });

  it('lost ve ödenmemiş deal gelire girmez', () => {
    const report = buildRevenueReport({
      months,
      costs,
      deals: [
        deal({ converted_fee: '0.1000' }),
        deal({ converted_fee: '0.2000' }),
        deal({ stage: 'lost', converted_fee: '999.0000' }),
        deal({ stage: 'delivered', paid_at: null, converted_fee: '5.0000' }),
      ],
    });
    // 0.1 + 0.2 tam 0.3 (float yok)
    expect(report.rows[0]?.revenue).toBe('0.3000');
    expect(report.rows[0]?.dealCount).toBe(2);
  });

  it('farklı para birimi kuru yoksa toplamı gizler ve sayar (dönüşümsüz toplamaz)', () => {
    const report = buildRevenueReport({
      months,
      costs,
      deals: [deal({}), deal({ fee: '70.00', converted_fee: null })],
    });
    expect(report.rows[0]).toMatchObject({
      revenue: null,
      missingRateCount: 1,
      profit: null,
    });
    expect(report.totals.revenue).toBeNull();
    expect(report.totals.missingRateCount).toBe(1);
  });

  it('ücreti boş deal sayılır ama tutara girmez; eksik kurlu maliyet kârı gizler', () => {
    const report = buildRevenueReport({
      months,
      costs: [
        { month: '2026-09', total: null, missingRateCount: 2 },
        { month: '2026-10', total: '1', missingRateCount: 0 },
      ],
      deals: [deal({ fee: null, converted_fee: null }), deal({})],
    });
    expect(report.rows[0]).toMatchObject({
      revenue: '100.0000',
      unpricedCount: 1,
      cost: null,
      costMissingRateCount: 2,
      profit: null,
    });
    expect(report.rows[1]).toMatchObject({
      revenue: '0.0000',
      profit: '-1.0000',
    });
  });

  it('toplamlar ayların toplamıdır', () => {
    const report = buildRevenueReport({
      months,
      costs,
      deals: [
        deal({ converted_fee: '100.0000' }),
        deal({ paid_at: '2026-10-05', converted_fee: '25.2500' }),
      ],
    });
    expect(report.totals).toMatchObject({
      revenue: '125.2500',
      cost: '50.5000',
      profit: '74.7500',
      dealCount: 2,
    });
  });
});

describe('pipelineTotals', () => {
  it('lost ve ücretsiz deal hariç, para birimi başına ayrı toplar', () => {
    expect(
      pipelineTotals([
        { stage: 'lead', fee: '100.10', currency: 'USD' },
        { stage: 'paid', fee: '0.20', currency: 'USD' },
        { stage: 'lost', fee: '5000', currency: 'USD' },
        { stage: 'signed', fee: null, currency: 'USD' },
        { stage: 'negotiation', fee: '300', currency: 'TRY' },
      ]),
    ).toEqual([
      { currency: 'TRY', total: '300.0000', count: 1 },
      { currency: 'USD', total: '100.3000', count: 2 },
    ]);
  });
});
