import { describe, expect, it } from 'vitest';
import {
  learningInputSchema,
  parseCompareIds,
  parseTargetHours,
} from './schemas';

const a = '30000000-0000-4000-8000-000000000001';
const b = '30000000-0000-4000-8000-000000000002';
const c = '30000000-0000-4000-8000-000000000003';
const d = '30000000-0000-4000-8000-000000000004';
const e = '30000000-0000-4000-8000-000000000005';

describe('parseCompareIds', () => {
  it('2–4 farklı uuid kabul eder', () => {
    expect(parseCompareIds(`${a},${b}`)).toEqual({ ok: true, ids: [a, b] });
    expect(parseCompareIds(` ${a} , ${b},${c},${d} `)).toEqual({
      ok: true,
      ids: [a, b, c, d],
    });
  });
  it('tek id ve eksik parametre anlamlı hata verir', () => {
    expect(parseCompareIds(a)).toEqual({
      ok: false,
      error: 'Karşılaştırma için en az 2 post seçin.',
    });
    expect(parseCompareIds(undefined).ok).toBe(false);
  });
  it('5 id reddedilir', () => {
    expect(parseCompareIds([a, b, c, d, e].join(','))).toEqual({
      ok: false,
      error: 'En fazla 4 post karşılaştırılabilir.',
    });
  });
  it('geçersiz veya tekrarlanan id reddedilir', () => {
    expect(parseCompareIds(`${a},abc`)).toEqual({
      ok: false,
      error: 'Geçersiz post kimliği.',
    });
    expect(parseCompareIds(`${a},${a}`)).toEqual({
      ok: false,
      error: 'Aynı post birden fazla kez seçilmiş.',
    });
  });
  it('tekrarlanan ?ids= parametrelerini birleştirir', () => {
    expect(parseCompareIds([a, b])).toEqual({ ok: true, ids: [a, b] });
  });
});

describe('parseTargetHours', () => {
  it('geçerli kontrol noktaları, aksi halde 24', () => {
    expect(parseTargetHours('5')).toBe(5);
    expect(parseTargetHours('168')).toBe(168);
    expect(parseTargetHours('3')).toBe(24);
    expect(parseTargetHours(undefined)).toBe(24);
  });
});

describe('learningInputSchema', () => {
  it('metni kırpar, etiket varsayılanı boş', () => {
    expect(learningInputSchema.parse({ body: '  not  ', postId: a })).toEqual({
      body: 'not',
      postId: a,
      tags: [],
    });
  });
  it('boş metin, 2000+ karakter ve bağlamsız not reddedilir', () => {
    expect(
      learningInputSchema.safeParse({ body: '   ', postId: a }).success,
    ).toBe(false);
    expect(
      learningInputSchema.safeParse({ body: 'x'.repeat(2001), postId: a })
        .success,
    ).toBe(false);
    expect(learningInputSchema.safeParse({ body: 'not' }).success).toBe(false);
  });
});
