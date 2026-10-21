import { describe, expect, it } from 'vitest';
import { diffPersonas, type PersonaSnapshot } from './persona-diff';

const base: PersonaSnapshot = {
  bio: 'Merhaba',
  tone: 'samimi',
  hook_traits: ['mavi saç', 'gözlük'],
  personality: { adjectives: ['meraklı', 'esprili'] },
  audience: { age_range: '18-24', interests: ['teknoloji'] },
  appearance: { hair: 'mavi' },
};

describe('diffPersonas', () => {
  it('aynı içerik için fark döndürmez', () => {
    expect(diffPersonas(base, structuredClone(base))).toEqual([]);
  });

  it('metin alanındaki değişikliği eski → yeni olarak verir', () => {
    expect(diffPersonas(base, { ...base, tone: 'esprili' })).toEqual([
      {
        path: 'tone',
        label: 'Ton',
        kind: 'text',
        before: 'samimi',
        after: 'esprili',
      },
    ]);
  });

  it('listede eklenen ve çıkarılan öğeleri ayırır', () => {
    const [entry] = diffPersonas(base, {
      ...base,
      hook_traits: ['mavi saç', 'imza kolye'],
    });
    expect(entry).toMatchObject({
      path: 'hook_traits',
      kind: 'list',
      added: ['imza kolye'],
      removed: ['gözlük'],
    });
  });

  it('sadece sıra değiştiyse fark saymaz', () => {
    expect(
      diffPersonas(base, { ...base, hook_traits: ['gözlük', 'mavi saç'] }),
    ).toEqual([]);
  });

  it('jsonb alanında eklenen ve silinen anahtarları gösterir', () => {
    const entries = diffPersonas(base, {
      ...base,
      appearance: { eyes: 'yeşil' },
    });
    expect(entries).toEqual([
      {
        path: 'appearance.eyes',
        label: 'Görünüm · göz',
        kind: 'text',
        before: '',
        after: 'yeşil',
      },
      {
        path: 'appearance.hair',
        label: 'Görünüm · saç',
        kind: 'text',
        before: 'mavi',
        after: '',
      },
    ]);
  });

  it('jsonb içindeki listeleri öğe bazında karşılaştırır', () => {
    const entries = diffPersonas(base, {
      ...base,
      personality: { adjectives: ['meraklı', 'cesur'] },
    });
    expect(entries).toEqual([
      {
        path: 'personality.adjectives',
        label: 'Kişilik · sıfatlar',
        kind: 'list',
        added: ['cesur'],
        removed: ['esprili'],
      },
    ]);
  });

  it('bilinmeyen anahtarı anahtar adıyla etiketler, iç içe değeri JSON gösterir', () => {
    const [entry] = diffPersonas(base, {
      ...base,
      audience: { ...(base.audience as object), extra: { a: 1 } },
    });
    expect(entry).toMatchObject({
      path: 'audience.extra',
      label: 'Hedef kitle · extra',
      kind: 'text',
      after: '{"a":1}',
    });
  });

  it('boş veya nesne olmayan jsonb alanlarında hata vermez', () => {
    expect(
      diffPersonas(
        { ...base, appearance: null as never },
        { ...base, appearance: [] as never },
      ),
    ).toEqual([]);
  });
});
