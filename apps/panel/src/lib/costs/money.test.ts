import { describe, expect, it } from 'vitest';
import {
  MissingRateError,
  compareDecimals,
  convert,
  formatMoney,
  fromMinor,
  sumDecimals,
  sumInCurrency,
  toMinor,
} from './money';

describe('toMinor / fromMinor', () => {
  it('string ve number kabul eder, 4 basamakta tutar', () => {
    expect(toMinor('12.3456')).toBe(123456n);
    expect(toMinor(12.3456)).toBe(123456n);
    expect(toMinor('7')).toBe(70000n);
    expect(fromMinor(123456n)).toBe('12.3456');
    expect(fromMinor(5n)).toBe('0.0005');
  });

  it('5. basamaktan yarım-yukarı yuvarlar', () => {
    expect(toMinor('0.00005')).toBe(1n);
    expect(toMinor('0.00004')).toBe(0n);
  });

  it('geçersiz girdiyi reddeder', () => {
    expect(() => toMinor('1,5')).toThrow(RangeError);
    expect(() => toMinor('abc')).toThrow(RangeError);
    expect(() => toMinor(Number.NaN)).toThrow(RangeError);
  });
});

describe('sumDecimals', () => {
  it('float hatası yapmaz (0.1 + 0.2)', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumDecimals(['0.1', '0.2'])).toBe('0.3000');
    expect(sumDecimals([0.1, 0.2])).toBe('0.3000');
  });
});

describe('convert / sumInCurrency', () => {
  it('aynı para biriminde kur istemez', () => {
    expect(convert('10', 'USD', 'USD', null)).toBe('10.0000');
  });

  it('kurla çarpar ve 4 basamağa yuvarlar', () => {
    expect(convert('400', 'TRY', 'USD', '0.025')).toBe('10.0000');
    expect(convert('1', 'USD', 'TRY', '40.12345678')).toBe('40.1235');
  });

  it('USD + TRY karışık kayıtları hedef para biriminde toplar', () => {
    const entries = [
      { amount: '10', currency: 'USD' },
      { amount: '400', currency: 'TRY' },
    ];
    expect(sumInCurrency(entries, 'USD', { TRY: '0.025' })).toBe('20.0000');
    expect(sumInCurrency(entries, 'TRY', { USD: '40' })).toBe('800.0000');
  });

  it('eksik kur hata verir, dönüşümsüz toplamaz', () => {
    expect(() =>
      sumInCurrency([{ amount: '5', currency: 'EUR' }], 'USD', {}),
    ).toThrow(MissingRateError);
  });
});

describe('compareDecimals', () => {
  it('ondalık karşılaştırır', () => {
    expect(compareDecimals('0.7999', '0.8')).toBe(-1);
    expect(compareDecimals('0.8000', 0.8)).toBe(0);
    expect(compareDecimals('1.05', '1')).toBe(1);
  });
});

describe('formatMoney', () => {
  it('2 basamakla para birimi gösterir', () => {
    expect(formatMoney('22', 'USD')).toMatch(/22,00/);
    expect(formatMoney('880.005', 'TRY')).toMatch(/880,01/);
  });

  it('değer yoksa tire gösterir (uydurma 0 değil)', () => {
    expect(formatMoney(null, 'USD')).toBe('—');
  });
});
