import { describe, expect, it } from 'vitest';
import {
  generationTypeForCategory,
  parseVariableDefinitions,
  pickVariableDefinitions,
  promptCategories,
  promptVersionSchema,
  ratePromptSchema,
  toPromptKey,
} from './prompt-schemas';

describe('toPromptKey', () => {
  it('transliterates Turkish and slugifies', () => {
    expect(toPromptKey('Günlük Şık Kombin — İstanbul!')).toBe(
      'gunluk-sik-kombin-istanbul',
    );
  });

  it('never returns an empty key and respects the 64 char limit', () => {
    expect(toPromptKey('!!!')).toBe('prompt');
    const key = toPromptKey('a '.repeat(80));
    expect(key.length).toBeLessThanOrEqual(64);
    expect(key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });
});

describe('promptVersionSchema', () => {
  const base = {
    category: 'caption',
    key: 'gunluk',
    title: 'Günlük',
    body: 'Konu: {{konu}}',
    influencerId: null,
  };

  it('accepts a valid version and fills defaults', () => {
    const parsed = promptVersionSchema.parse(base);
    expect(parsed).toMatchObject({
      negative: '',
      variables: {},
      changeNote: '',
    });
  });

  it('rejects unknown categories, bad keys and variables not used in the body', () => {
    expect(
      promptVersionSchema.safeParse({ ...base, category: 'x' }).success,
    ).toBe(false);
    expect(
      promptVersionSchema.safeParse({ ...base, key: 'Büyük Harf' }).success,
    ).toBe(false);
    expect(
      promptVersionSchema.safeParse({ ...base, variables: { yok: {} } })
        .success,
    ).toBe(false);
  });

  it('rejects a non-uuid influencer id', () => {
    expect(
      promptVersionSchema.safeParse({ ...base, influencerId: "1' or 1=1" })
        .success,
    ).toBe(false);
  });
});

describe('ratePromptSchema', () => {
  it('allows integers 1-5 only', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(
      ratePromptSchema.safeParse({ promptId: id, rating: '5' }).success,
    ).toBe(true);
    for (const rating of ['0', '6', '2.5'])
      expect(ratePromptSchema.safeParse({ promptId: id, rating }).success).toBe(
        false,
      );
  });
});

describe('variable definitions', () => {
  it('keeps only variables used in the body, with trimmed defaults', () => {
    expect(
      pickVariableDefinitions('{{a}} {{b}}', { a: ' 1 ', c: 'x', b: '  ' }),
    ).toEqual({ a: { default: '1' }, b: {} });
  });

  it('ignores malformed jsonb', () => {
    expect(parseVariableDefinitions('bozuk')).toEqual({});
    expect(parseVariableDefinitions({ a: { default: 1 } })).toEqual({});
  });
});

it('maps every category to a generation type or text-only', () => {
  for (const category of promptCategories)
    expect(Object.hasOwn(generationTypeForCategory, category)).toBe(true);
  expect(generationTypeForCategory.caption).toBeNull();
  expect(generationTypeForCategory.character).toBe('image');
});
