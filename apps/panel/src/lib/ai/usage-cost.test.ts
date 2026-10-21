import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { estimateAiCost, recordAiUsage } = await import('./usage-cost');

const pricing = {
  currency: 'USD',
  inputPerMTok: '5',
  outputPerMTok: '25',
  cacheReadPerMTok: '0.5',
};

describe('estimateAiCost', () => {
  it('token başına maliyeti ondalık hesaplar', () => {
    expect(
      estimateAiCost(
        { inputTokens: 1_000_000, outputTokens: 0, cacheReadInputTokens: 0 },
        pricing,
      ),
    ).toBe('5.0000');
    expect(
      estimateAiCost(
        { inputTokens: 1200, outputTokens: 800, cacheReadInputTokens: 10_000 },
        pricing,
      ),
    ).toBe('0.0310'); // 0.006 + 0.02 + 0.005
  });

  it('kullanılan cache fiyatı yoksa eksik maliyet hesaplamaz', () => {
    expect(() =>
      estimateAiCost(
        { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 5000 },
        { currency: 'USD', inputPerMTok: '5', outputPerMTok: '25' },
      ),
    ).toThrow(/fiyatı eksik/);
  });

  it('geçersiz token sayısını reddeder', () => {
    expect(() =>
      estimateAiCost(
        { inputTokens: -1, outputTokens: 0, cacheReadInputTokens: 0 },
        pricing,
      ),
    ).toThrow(RangeError);
  });
});

describe('recordAiUsage', () => {
  function client(result: { data: unknown; error: unknown }) {
    const insert = vi.fn<(values: Record<string, unknown>) => unknown>(() => ({
      select: () => ({ single: async () => result }),
    }));
    return { insert, supabase: { from: vi.fn(() => ({ insert })) } };
  }

  const usage = {
    inputTokens: 1000,
    outputTokens: 1000,
    cacheReadInputTokens: 0,
  };

  it('ai_api kategorisiyle ve hesaplanan tutarla yazar', async () => {
    const { supabase, insert } = client({ data: { id: 'c1' }, error: null });
    const result = await recordAiUsage(supabase as never, {
      influencerId: 'inf-1',
      model: 'claude-opus-5-5',
      usage,
      pricing,
      incurredOn: '2026-10-22',
    });
    expect(result).toEqual({ id: 'c1', amount: '0.0300' });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'ai_api',
        amount: '0.0300',
        currency: 'USD',
        influencer_id: 'inf-1',
        incurred_on: '2026-10-22',
      }),
    );
    // created_by istemciden gönderilmez (trigger doldurur)
    expect(insert.mock.calls[0]?.[0]).not.toHaveProperty('created_by');
  });

  it('hatayı yutmaz', async () => {
    const { supabase } = client({
      data: null,
      error: { message: 'new row violates row-level security policy' },
    });
    await expect(
      recordAiUsage(supabase as never, {
        influencerId: 'inf-1',
        model: 'm',
        usage,
        pricing,
        incurredOn: '2026-10-22',
      }),
    ).rejects.toThrow(/kaydedilemedi/);
  });
});

it('iki cache yazma fiyatını ayrı hesaplar', () => {
  expect(
    estimateAiCost(
      {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 1_000_000,
        cacheCreation1hInputTokens: 1_000_000,
      },
      { ...pricing, cacheWritePerMTok: '5', cacheWrite1hPerMTok: '8' },
    ),
  ).toBe('13.0000');
});

it('toplamı bir kez yuvarlar', () => {
  expect(
    estimateAiCost(
      { inputTokens: 10, outputTokens: 10, cacheReadInputTokens: 0 },
      { currency: 'USD', inputPerMTok: '5', outputPerMTok: '5' },
    ),
  ).toBe('0.0001');
});
