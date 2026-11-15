import type { FactNote } from '@ai-influencer/shared';

/**
 * Senaryo sürümlerini karşılaştırma (#205): satır bazında metin farkı ve iddia bazında kaynak
 * notu farkı. Saf modül; sürüm geçmişi ve "başka biri değiştirdi" ekranı kullanır.
 */
export type DiffLine = { type: 'same' | 'added' | 'removed'; text: string };

const MAX_CELLS = 4_000_000;

/** Satır bazında fark (en uzun ortak alt dizi). `before` → `after`. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before === '' ? [] : before.split('\n');
  const b = after === '' ? [] : after.split('\n');
  // Çok uzun metinlerde tablo yerine kaba fark: hepsi silindi + hepsi eklendi.
  if (a.length * b.length > MAX_CELLS)
    return [
      ...a.map((text): DiffLine => ({ type: 'removed', text })),
      ...b.map((text): DiffLine => ({ type: 'added', text })),
    ];
  const width = b.length + 1;
  const table = new Uint32Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      table[i * width + j] =
        a[i] === b[j]
          ? table[(i + 1) * width + j + 1]! + 1
          : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ type: 'same', text: a[i]! });
      i++;
      j++;
    } else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) {
      lines.push({ type: 'removed', text: a[i++]! });
    } else {
      lines.push({ type: 'added', text: b[j++]! });
    }
  }
  while (i < a.length) lines.push({ type: 'removed', text: a[i++]! });
  while (j < b.length) lines.push({ type: 'added', text: b[j++]! });
  return lines;
}

export function diffStats(lines: readonly DiffLine[]) {
  return {
    added: lines.filter((line) => line.type === 'added').length,
    removed: lines.filter((line) => line.type === 'removed').length,
  };
}

export type FactNoteChange =
  | { type: 'added' | 'removed'; claim: string; sources: number }
  | { type: 'changed'; claim: string; before: number; after: number };

const claimKey = (claim: string) => claim.trim().toLocaleLowerCase('tr');
const sourceCount = (note: FactNote) => note.sources?.length ?? 0;
const noteBody = (note: FactNote) =>
  JSON.stringify([
    (note.sources ?? []).map((s) => [s.title ?? '', s.url ?? '', !!s.primary]),
    note.note ?? '',
    note.cautious_wording ?? '',
  ]);

/** İddia metnine göre eşleştirir: eklenen, çıkarılan ve kaynakları / notu değişen iddialar. */
export function diffFactNotes(
  before: readonly FactNote[],
  after: readonly FactNote[],
): FactNoteChange[] {
  const old = new Map(before.map((note) => [claimKey(note.claim), note]));
  const seen = new Set<string>();
  const changes: FactNoteChange[] = [];
  for (const note of after) {
    const key = claimKey(note.claim);
    seen.add(key);
    const previous = old.get(key);
    if (!previous)
      changes.push({
        type: 'added',
        claim: note.claim,
        sources: sourceCount(note),
      });
    else if (noteBody(previous) !== noteBody(note))
      changes.push({
        type: 'changed',
        claim: note.claim,
        before: sourceCount(previous),
        after: sourceCount(note),
      });
  }
  for (const note of before)
    if (!seen.has(claimKey(note.claim)))
      changes.push({
        type: 'removed',
        claim: note.claim,
        sources: sourceCount(note),
      });
  return changes;
}
