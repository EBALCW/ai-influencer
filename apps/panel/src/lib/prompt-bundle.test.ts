import { describe, expect, it } from 'vitest';
import {
  buildPromptBundle,
  isSamePromptContent,
  MAX_BUNDLE_PROMPTS,
  parsePromptBundle,
  promptBundleFileName,
  PROMPT_BUNDLE_FORMAT,
} from './prompt-bundle';

const entry = {
  category: 'character',
  key: 'kombin',
  title: 'Kombin',
  body: '{{kıyafet}} giyen karakter, {{mekan}} arka planı',
  negative: 'bulanık',
  variables: { mekan: { default: 'kafe' } },
  influencer: null,
};
const bundle = (prompts: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    format: PROMPT_BUNDLE_FORMAT,
    version: 1,
    prompts,
    ...extra,
  });

describe('parsePromptBundle', () => {
  it('geçerli paketi varsayılanlarla okur', () => {
    const result = parsePromptBundle(
      bundle([
        entry,
        { category: 'caption', key: 'ai-caption', title: 'AI', body: 'Kısa' },
      ]),
    );
    expect(result).toEqual({
      ok: true,
      prompts: [
        {
          ...entry,
          variables: { kıyafet: {}, mekan: { default: 'kafe' } },
          changeNote: '',
        },
        {
          category: 'caption',
          key: 'ai-caption',
          title: 'AI',
          body: 'Kısa',
          negative: '',
          variables: {},
          influencer: null,
          changeNote: '',
        },
      ],
    });
  });

  it.each([
    ['JSON değil', 'merhaba', /geçerli bir JSON/],
    [
      'yanlış format',
      JSON.stringify({ prompts: [entry] }),
      /prompt paketi değil/,
    ],
    ['boş paket', bundle([]), /en az bir prompt/],
    [
      'çok fazla prompt',
      bundle(Array.from({ length: MAX_BUNDLE_PROMPTS + 1 }, () => entry)),
      /en fazla/,
    ],
    ['bilinmeyen kategori', bundle([{ ...entry, category: 'x' }]), /category/],
    ['geçersiz anahtar', bundle([{ ...entry, key: 'Büyük Harf' }]), /Anahtar/],
    ['boş metin', bundle([{ ...entry, body: '  ' }]), /Prompt metni gerekli/],
    [
      'kullanılmayan değişken',
      bundle([{ ...entry, variables: { yok: {} } }]),
      /kullanılmıyor/,
    ],
    [
      'fazladan alan (ör. id, created_by)',
      bundle([{ ...entry, created_by: 'x' }]),
      /1\. prompt/,
    ],
    [
      'geçersiz influencer slug',
      bundle([{ ...entry, influencer: '../evil' }]),
      /slug/,
    ],
    [
      'aynı soy iki kez',
      bundle([entry, { ...entry, title: 'İkinci' }]),
      /birden fazla/,
    ],
    ['1 MB üstü', 'x'.repeat(1_000_001), /1 MB/],
  ])('%s reddedilir', (_name, text, message) => {
    const result = parsePromptBundle(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.join(' ')).toMatch(message);
  });

  it('bir hatalı kayıt tüm paketi reddeder ve sırasını söyler', () => {
    const result = parsePromptBundle(
      bundle([entry, { ...entry, key: 'iki', title: '' }]),
    );
    expect(result).toEqual({
      ok: false,
      errors: [expect.stringMatching(/^2\. prompt: Başlık gerekli/)],
    });
  });
});

describe('buildPromptBundle', () => {
  it('son versiyonları slug ile taşır ve geri okunabilir', () => {
    const built = buildPromptBundle(
      [
        {
          category: 'caption',
          key: 'ozel',
          title: 'Özel',
          body: '{{konu}} hakkında',
          negative: null,
          variables: { konu: {}, bozuk: 1 },
          version: 3,
          change_note: 'not',
          influencer: { slug: 'demo-creator' },
        },
        {
          category: null,
          key: null,
          title: null,
          body: null,
          negative: null,
          variables: null,
          version: null,
          change_note: null,
          influencer: null,
        },
      ],
      new Date('2026-10-22T10:00:00Z'),
    );
    expect(built).toMatchObject({
      format: PROMPT_BUNDLE_FORMAT,
      exportedAt: '2026-10-22T10:00:00.000Z',
      prompts: [
        {
          key: 'ozel',
          influencer: 'demo-creator',
          version: 3,
          negative: '',
          variables: {},
        },
      ],
    });
    expect(built.prompts).toHaveLength(1);
    expect(JSON.stringify(built)).not.toMatch(/"id"|created_by|influencer_id/);
    const back = parsePromptBundle(JSON.stringify(built));
    expect(back.ok).toBe(true);
  });

  it('dosya adı .gitignore kalıbına uyar', () => {
    expect(promptBundleFileName(new Date('2026-10-22T10:00:00Z'))).toBe(
      'ai-influencer-prompts-2026-10-22.json',
    );
  });
});

describe('isSamePromptContent', () => {
  const latest = {
    title: 'Kombin',
    body: entry.body,
    negative: 'bulanık',
    variables: { mekan: { default: 'kafe' } },
  };
  const parsed = { ...entry, changeNote: '' } as const;
  it('aynı içerik tekrar versiyon oluşturmaz', () => {
    expect(isSamePromptContent(parsed, latest)).toBe(true);
  });
  it('metin, negatif veya varsayılan değişirse yeni versiyon gerekir', () => {
    expect(isSamePromptContent({ ...parsed, body: 'x' }, latest)).toBe(false);
    expect(isSamePromptContent({ ...parsed, negative: '' }, latest)).toBe(
      false,
    );
    expect(
      isSamePromptContent(
        { ...parsed, variables: { mekan: { default: 'park' } } },
        latest,
      ),
    ).toBe(false);
  });
});
