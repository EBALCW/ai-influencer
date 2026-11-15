import type { FactNote } from '@ai-influencer/shared';
import { diffFactNotes, diffLines, diffStats } from '@/lib/explainer/diff';

/**
 * İki senaryo sürümünün karşılaştırması: satır bazında metin, iddia bazında kaynak notu.
 * Eklenen / çıkarılan satır renkle değil işaretle (+ / −) ve ekran okuyucu metniyle ayrılır.
 */
export function DiffView({
  beforeLabel,
  afterLabel,
  before,
  after,
}: {
  beforeLabel: string;
  afterLabel: string;
  before: { text: string; notes: readonly FactNote[] };
  after: { text: string; notes: readonly FactNote[] };
}) {
  const lines = diffLines(before.text, after.text);
  const stats = diffStats(lines);
  const notes = diffFactNotes(before.notes, after.notes);
  const same = stats.added === 0 && stats.removed === 0;
  return (
    <div className="grid gap-3 text-sm">
      <p className="m-0 text-muted">
        {beforeLabel} → {afterLabel}:{' '}
        {same
          ? 'senaryo metni aynı.'
          : `${stats.added} satır eklendi, ${stats.removed} satır çıkarıldı.`}
      </p>
      {!same && (
        <ol
          aria-label="Senaryo metni farkı"
          className="m-0 max-h-96 list-none overflow-auto rounded-lg border border-line bg-surface p-0 font-mono text-xs"
        >
          {lines.map((line, index) => (
            <li
              className={`flex gap-2 px-3 py-1 whitespace-pre-wrap ${
                line.type === 'added'
                  ? 'border-l-2 border-mint text-text'
                  : line.type === 'removed'
                    ? 'border-l-2 border-accent text-muted line-through'
                    : 'border-l-2 border-transparent text-muted'
              }`}
              key={index}
            >
              <span aria-hidden="true" className="select-none">
                {line.type === 'added'
                  ? '+'
                  : line.type === 'removed'
                    ? '−'
                    : ' '}
              </span>
              <span>
                {line.type !== 'same' && (
                  <span className="sr-only">
                    {line.type === 'added' ? 'Eklendi: ' : 'Çıkarıldı: '}
                  </span>
                )}
                {line.text || ' '}
              </span>
            </li>
          ))}
        </ol>
      )}
      <div>
        <p className="m-0 font-medium text-text">Kaynak notları</p>
        {notes.length === 0 ? (
          <p className="m-0 text-muted">Kaynak notlarında fark yok.</p>
        ) : (
          <ul
            aria-label="Kaynak notu farkı"
            className="m-0 list-disc space-y-1 pl-5"
          >
            {notes.map((change, index) => (
              <li key={index}>
                {change.type === 'added' &&
                  `Eklendi: “${change.claim}” (${change.sources} kaynak)`}
                {change.type === 'removed' &&
                  `Çıkarıldı: “${change.claim}” (${change.sources} kaynak)`}
                {change.type === 'changed' &&
                  `Değişti: “${change.claim}” (${change.before} → ${change.after} kaynak)`}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
