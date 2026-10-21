import { describe, expect, it } from 'vitest';
import { budgetSchema, costEntrySchema, rateSchema } from './schemas';

const id = '10000000-0000-4000-8000-000000000001';

describe('costEntrySchema', () => {
  const valid = {
    influencerId: id,
    category: 'subscription',
    amount: '19.99',
    currency: 'USD',
    incurredOn: '2026-10-01',
  };

  it('geçerli kaydı kabul eder', () => {
    expect(costEntrySchema.safeParse(valid).success).toBe(true);
  });

  it('float/negatif/5 basamak tutar ve küçük harf para birimi reddedilir', () => {
    for (const amount of ['-1', '1.23456', '1e3', 'abc', '']) {
      expect(costEntrySchema.safeParse({ ...valid, amount }).success).toBe(
        false,
      );
    }
    expect(costEntrySchema.safeParse({ ...valid, amount: 19.99 }).success).toBe(
      false,
    );
    expect(
      costEntrySchema.safeParse({ ...valid, currency: 'usd' }).success,
    ).toBe(false);
  });

  it('bilinmeyen kategori reddedilir', () => {
    expect(
      costEntrySchema.safeParse({ ...valid, category: 'gift' }).success,
    ).toBe(false);
  });
});

describe('budgetSchema', () => {
  it('toplam bütçe için influencerId null olabilir', () => {
    const parsed = budgetSchema.parse({
      influencerId: null,
      month: '2026-10',
      amount: '500',
      currency: 'USD',
    });
    expect(parsed.warnRatio).toBe('0.8');
  });

  it('sıfır bütçe ve 1 üstü uyarı oranı reddedilir', () => {
    const base = { influencerId: id, month: '2026-10', currency: 'USD' };
    expect(budgetSchema.safeParse({ ...base, amount: '0' }).success).toBe(
      false,
    );
    expect(
      budgetSchema.safeParse({ ...base, amount: '10', warnRatio: '1.2' })
        .success,
    ).toBe(false);
    expect(
      budgetSchema.safeParse({ ...base, amount: '10', warnRatio: '0' }).success,
    ).toBe(false);
  });
});

describe('rateSchema', () => {
  it('kur ve kredi fiyatını ayırt eder', () => {
    expect(
      rateSchema.safeParse({
        kind: 'exchange',
        currency: 'USD',
        baseCurrency: 'TRY',
        rate: '40.5',
        validOn: '2026-10-01',
      }).success,
    ).toBe(true);
    expect(
      rateSchema.safeParse({
        kind: 'credit',
        tool: 'higgsfield',
        currency: 'USD',
        rate: '0.05',
        validFrom: '2026-10-01',
      }).success,
    ).toBe(true);
    expect(
      rateSchema.safeParse({ kind: 'credit', tool: '', rate: '1' }).success,
    ).toBe(false);
  });
});
