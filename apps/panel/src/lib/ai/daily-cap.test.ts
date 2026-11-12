import { describe, expect, it } from 'vitest';
import { utcDay } from './daily-cap';

describe('utcDay', () => {
  it('UTC gün başlangıcını ve kalan süreyi verir', () => {
    expect(utcDay(new Date('2026-10-24T23:59:30Z'))).toEqual({
      start: '2026-10-24T00:00:00.000Z',
      secondsLeft: 30,
    });
    expect(utcDay(new Date('2026-10-24T00:00:00Z')).secondsLeft).toBe(86_400);
  });
});
