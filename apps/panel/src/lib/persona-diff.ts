import type { Json } from '@ai-influencer/shared';
import type { PersonaRow } from './persona';

export type PersonaSnapshot = Pick<
  PersonaRow,
  | 'bio'
  | 'tone'
  | 'hook_traits'
  | 'sample_captions'
  | 'personality'
  | 'audience'
  | 'appearance'
>;

export type DiffEntry =
  | { path: string; label: string; kind: 'text'; before: string; after: string }
  | {
      path: string;
      label: string;
      kind: 'list';
      added: string[];
      removed: string[];
    };

const groupLabels = {
  personality: 'Kişilik',
  audience: 'Hedef kitle',
  appearance: 'Görünüm',
} as const;

const keyLabels: Record<string, string> = {
  adjectives: 'sıfatlar',
  age_range: 'yaş aralığı',
  interests: 'ilgi alanları',
  description: 'açıklama',
  hair: 'saç',
  skin: 'ten',
  eyes: 'göz',
  face: 'yüz yapısı',
  body: 'vücut / boyun',
  signature: 'imza aksesuar',
};

function isObject(
  value: Json | null | undefined,
): value is { [key: string]: Json | undefined } {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isStringList(value: Json | undefined): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function display(value: Json | undefined): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function listDiff(
  path: string,
  label: string,
  before: string[],
  after: string[],
): DiffEntry | null {
  const added = after.filter((item) => !before.includes(item));
  const removed = before.filter((item) => !after.includes(item));
  // Sadece sıra değiştiyse anlamlı bir fark yok sayılır
  if (!added.length && !removed.length) return null;
  return { path, label, kind: 'list', added, removed };
}

function valueDiff(
  path: string,
  label: string,
  before: Json | undefined,
  after: Json | undefined,
): DiffEntry | null {
  if (isStringList(before ?? []) && isStringList(after ?? [])) {
    return listDiff(
      path,
      label,
      (before as string[] | undefined) ?? [],
      (after as string[] | undefined) ?? [],
    );
  }
  const a = display(before);
  const b = display(after);
  return a === b ? null : { path, label, kind: 'text', before: a, after: b };
}

/**
 * İki persona versiyonu arasındaki farkları alan alan döndürür (eski → yeni).
 * jsonb alanları bir seviye açılır; listeler eklenen/çıkarılan öğe olarak gösterilir.
 */
export function diffPersonas(
  older: PersonaSnapshot,
  newer: PersonaSnapshot,
): DiffEntry[] {
  const entries: Array<DiffEntry | null> = [
    valueDiff('bio', 'Biyografi', older.bio, newer.bio),
    valueDiff('tone', 'Ton', older.tone, newer.tone),
    listDiff(
      'hook_traits',
      'Kanca özellikleri',
      older.hook_traits,
      newer.hook_traits,
    ),
    listDiff(
      'sample_captions',
      'Örnek caption’lar',
      older.sample_captions,
      newer.sample_captions,
    ),
  ];

  for (const group of ['personality', 'audience', 'appearance'] as const) {
    const before = isObject(older[group]) ? older[group] : {};
    const after = isObject(newer[group]) ? newer[group] : {};
    const keys = [
      ...new Set([...Object.keys(before), ...Object.keys(after)]),
    ].sort();
    for (const key of keys) {
      const label = `${groupLabels[group]} · ${keyLabels[key] ?? key}`;
      entries.push(
        valueDiff(`${group}.${key}`, label, before[key], after[key]),
      );
    }
  }

  return entries.filter((entry): entry is DiffEntry => entry !== null);
}
