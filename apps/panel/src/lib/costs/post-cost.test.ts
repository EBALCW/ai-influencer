import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@ai-influencer/shared';
import { getPostCost, toPostCost } from './post-cost';

const row = {
  post_id: 'f6000000-0000-4000-8000-000000000001',
  allocation: 'direct',
  total: 1.5,
  currency: 'USD',
  entry_count: 2,
  missing_rate_count: 0,
  generation_count: 2,
};

function client(result: { data: unknown; error: unknown }) {
  const rpc = vi.fn(() => ({ maybeSingle: async () => result }));
  return {
    rpc,
    supabase: { rpc } as unknown as SupabaseClient<Database>,
  };
}

describe('toPostCost', () => {
  it('numeric değeri string yapar, alanları eşler', () => {
    expect(toPostCost(row)).toEqual({
      postId: row.post_id,
      allocation: 'direct',
      total: '1.5',
      currency: 'USD',
      entryCount: 2,
      missingRateCount: 0,
      generationCount: 2,
    });
  });

  it('eksik kurda toplamı null bırakır (0 yazmaz)', () => {
    expect(
      toPostCost({ ...row, total: null as never, missing_rate_count: 2 }),
    ).toMatchObject({ total: null, missingRateCount: 2 });
  });

  it('bilinmeyen dağıtım türünü reddeder', () => {
    expect(() => toPostCost({ ...row, allocation: 'split' })).toThrow();
  });
});

describe('getPostCost', () => {
  it('post_cost RPC çağırır ve ortalama dağıtımı döner', async () => {
    const { rpc, supabase } = client({
      data: { ...row, allocation: 'average', total: '1.2500' },
      error: null,
    });
    await expect(getPostCost(supabase, row.post_id, 'USD')).resolves.toEqual(
      expect.objectContaining({ allocation: 'average', total: '1.2500' }),
    );
    expect(rpc).toHaveBeenCalledWith('post_cost', {
      p_post_id: row.post_id,
      p_currency: 'USD',
    });
  });

  it('görünmeyen post için null döner', async () => {
    const { supabase } = client({ data: null, error: null });
    await expect(getPostCost(supabase, row.post_id, 'USD')).resolves.toBe(null);
  });

  it('hata ayrıntısını sızdırmadan hata atar', async () => {
    const { supabase } = client({
      data: null,
      error: { message: 'private detail' },
    });
    await expect(getPostCost(supabase, row.post_id, 'USD')).rejects.toThrow(
      'Post maliyeti alınamadı.',
    );
  });
});
