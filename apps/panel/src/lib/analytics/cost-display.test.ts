import { describe, expect, it } from 'vitest';
import type { PostCost } from '@/lib/costs/post-cost';
import { postCostDisplay } from './cost-display';

const base: PostCost = {
  postId: 'p',
  allocation: 'direct',
  total: '12.5',
  currency: 'USD',
  entryCount: 2,
  missingRateCount: 0,
  generationCount: 2,
};

describe('postCostDisplay', () => {
  it('doğrudan maliyet tutarı ve üretim sayısı', () => {
    const shown = postCostDisplay(base);
    expect(shown.value).toContain('12,50');
    expect(shown.detail).toBe('Doğrudan: 2 bağlı üretim');
  });
  it('ortalama dağıtım tahmini olarak belirtilir', () => {
    expect(
      postCostDisplay({ ...base, allocation: 'average', generationCount: 0 })
        .detail,
    ).toMatch(/^Tahmini/);
  });
  it('eksik kurda tutar gösterilmez', () => {
    expect(
      postCostDisplay({ ...base, total: null, missingRateCount: 1 }),
    ).toEqual({
      value: '—',
      detail:
        'Eksik kur: 1 kaydın USD kuru tanımlı değil · Doğrudan: 2 bağlı üretim',
    });
  });
  it('veri yoksa 0 yazılmaz', () => {
    expect(postCostDisplay({ ...base, total: '0', entryCount: 0 }).detail).toBe(
      'Doğrudan: 2 bağlı üretim · maliyet kaydı yok',
    );
    expect(postCostDisplay({ ...base, total: null }).value).toBe('—');
    expect(postCostDisplay(null).value).toBe('—');
  });
});
