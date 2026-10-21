import { describe, expect, it } from 'vitest';
import { budgetLevel, budgetPercent } from './budget';

describe('budgetLevel', () => {
  it('%79.99 uyarı değil, %80 uyarı, %100 ve üstü aşıldı', () => {
    expect(budgetLevel('0.7999', '0.8')).toBe('ok');
    expect(budgetLevel('0.8', '0.8')).toBe('warning');
    expect(budgetLevel('0.9999', '0.8')).toBe('warning');
    expect(budgetLevel('1', '0.8')).toBe('exceeded');
    expect(budgetLevel('1.05', '0.8')).toBe('exceeded');
  });

  it('özel uyarı oranına uyar', () => {
    expect(budgetLevel('0.6', '0.5')).toBe('warning');
    expect(budgetLevel('0.4', '0.5')).toBe('ok');
  });

  it('oran yoksa (eksik kur) bilinmiyor', () => {
    expect(budgetLevel(null, '0.8')).toBe('unknown');
  });
});

describe('budgetPercent', () => {
  it('0-100 arasında kalır', () => {
    expect(budgetPercent('0.5')).toBe(50);
    expect(budgetPercent('1.4')).toBe(100);
    expect(budgetPercent(null)).toBe(0);
  });
});
