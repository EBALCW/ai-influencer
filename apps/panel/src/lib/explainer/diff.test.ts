import { describe, expect, it } from 'vitest';
import { diffFactNotes, diffLines, diffStats } from './diff';

describe('senaryo sürüm karşılaştırması', () => {
  it('eklenen ve çıkarılan satırları sırasıyla verir', () => {
    const lines = diffLines('bir\niki\nüç', 'bir\niki buçuk\nüç\ndört');
    expect(lines).toEqual([
      { type: 'same', text: 'bir' },
      { type: 'removed', text: 'iki' },
      { type: 'added', text: 'iki buçuk' },
      { type: 'same', text: 'üç' },
      { type: 'added', text: 'dört' },
    ]);
    expect(diffStats(lines)).toEqual({ added: 2, removed: 1 });
  });

  it('aynı metinde fark yoktur; boş metin satır üretmez', () => {
    expect(diffStats(diffLines('a\nb', 'a\nb'))).toEqual({
      added: 0,
      removed: 0,
    });
    expect(diffLines('', '')).toEqual([]);
    expect(diffLines('', 'yeni')).toEqual([{ type: 'added', text: 'yeni' }]);
    expect(diffLines('eski', '')).toEqual([{ type: 'removed', text: 'eski' }]);
  });

  it('farkı uygulayınca yeni metin elde edilir', () => {
    const before = 'kanca\ngiriş\ngelişme\nsonuç';
    const after = 'yeni kanca\ngiriş\nsonuç\nkapanış';
    const rebuilt = diffLines(before, after)
      .filter((line) => line.type !== 'removed')
      .map((line) => line.text)
      .join('\n');
    expect(rebuilt).toBe(after);
  });

  it('iddiaları metne göre eşleştirir: eklenen, çıkarılan, kaynağı değişen', () => {
    const before = [
      { claim: 'Planör motorsuz uçar', sources: [{ title: 'A' }] },
      { claim: 'Silinecek iddia', sources: [] },
      { claim: 'Aynı kalan', sources: [{ title: 'X' }, { title: 'Y' }] },
    ];
    const after = [
      {
        claim: 'planör motorsuz uçar ',
        sources: [{ title: 'A' }, { title: 'B' }],
      },
      { claim: 'Aynı kalan', sources: [{ title: 'X' }, { title: 'Y' }] },
      { claim: 'Yeni iddia', sources: [{ url: 'https://example.org' }] },
    ];
    expect(diffFactNotes(before, after)).toEqual([
      { type: 'changed', claim: 'planör motorsuz uçar ', before: 1, after: 2 },
      { type: 'added', claim: 'Yeni iddia', sources: 1 },
      { type: 'removed', claim: 'Silinecek iddia', sources: 0 },
    ]);
    expect(diffFactNotes(before, before)).toEqual([]);
  });

  it('temkinli ifade değişikliği de fark sayılır', () => {
    const base = { claim: 'İddia', sources: [{ title: 'A' }, { title: 'B' }] };
    expect(
      diffFactNotes([base], [{ ...base, cautious_wording: 'Rapora göre' }]),
    ).toEqual([{ type: 'changed', claim: 'İddia', before: 2, after: 2 }]);
  });
});
