'use client';

import {
  EXPLAINER_LIMITS,
  MIN_SOURCES_PER_CLAIM,
  hasFactGaps,
  unsourcedClaimCount,
} from '@ai-influencer/shared';
import {
  emptyFactNote,
  emptySource,
  missingSources,
  normalizeFactNotes,
  type FactNoteDraft,
  type SourceDraft,
} from '@/lib/explainer/model';
import { Badge, SourceLink, field, hint, label } from './shared';

/**
 * İddia → kaynak tablosu (#218). Her iddia en az iki kaynak ister; eksik olanlar anında
 * işaretlenir. Sayım veritabanındaki `unsourced_claim_count` ile aynı kuraldır (boş satır kaynak
 * sayılmaz). Kaynaklar ayrışıyorsa temkinli ifade yazılır.
 */
export function FactNotesEditor({
  notes,
  onChange,
  disabled,
}: {
  notes: FactNoteDraft[];
  onChange: (notes: FactNoteDraft[]) => void;
  disabled: boolean;
}) {
  const normalized = normalizeFactNotes(notes);
  const gaps = unsourcedClaimCount(normalized);
  const update = (index: number, patch: Partial<FactNoteDraft>) =>
    onChange(
      notes.map((note, i) => (i === index ? { ...note, ...patch } : note)),
    );
  const updateSource = (
    index: number,
    sourceIndex: number,
    patch: Partial<SourceDraft>,
  ) =>
    update(index, {
      sources: notes[index]!.sources.map((source, i) =>
        i === sourceIndex ? { ...source, ...patch } : source,
      ),
    });

  return (
    <div className="grid gap-3">
      <p
        aria-live="polite"
        className="m-0 flex flex-wrap items-center gap-2 text-sm text-text"
        data-testid="fact-gap-summary"
      >
        <span>{normalized.length} iddia</span>
        {normalized.length === 0 ? (
          <Badge tone="attention">⚠ Kaynak notu yok</Badge>
        ) : gaps > 0 ? (
          <Badge tone="attention">
            ⚠ {gaps} iddianın kaynağı eksik (en az {MIN_SOURCES_PER_CLAIM}{' '}
            kaynak gerekir)
          </Badge>
        ) : (
          <Badge tone="done">✓ Her iddianın en az iki kaynağı var</Badge>
        )}
      </p>
      {disabled && notes.length === 0 && (
        <p className="m-0 text-sm text-muted">Kaynak notu yazılmamış.</p>
      )}
      <ol className="m-0 grid list-none gap-3 p-0">
        {notes.map((note, index) => {
          const missing = missingSources(note);
          const number = index + 1;
          return (
            <li key={index}>
              <fieldset
                className="grid gap-3 rounded-xl border border-line bg-surface-raised p-4"
                disabled={disabled}
              >
                <legend className="flex items-center gap-2 px-1 text-xs font-semibold text-text">
                  İddia {number}
                  {missing > 0 ? (
                    <Badge tone="attention">⚠ {missing} kaynak eksik</Badge>
                  ) : (
                    <Badge tone="done">✓ Kaynaklı</Badge>
                  )}
                </legend>
                <label className={label}>
                  İddia {number} metni
                  <textarea
                    className={field}
                    maxLength={EXPLAINER_LIMITS.claim}
                    onChange={(event) =>
                      update(index, { claim: event.target.value })
                    }
                    placeholder="Senaryoda geçen, doğrulanması gereken tek bir olgu"
                    rows={2}
                    value={note.claim}
                  />
                </label>
                <div className="grid gap-2">
                  <span className="text-xs font-medium text-muted">
                    İddia {number} kaynakları
                  </span>
                  {note.sources.map((source, sourceIndex) => (
                    <div
                      className="grid items-end gap-2 text-sm sm:grid-cols-[1fr_1fr_auto_auto]"
                      key={sourceIndex}
                    >
                      <input
                        aria-label={`İddia ${number}, kaynak ${sourceIndex + 1} adı`}
                        className={field}
                        maxLength={300}
                        onChange={(event) =>
                          updateSource(index, sourceIndex, {
                            title: event.target.value,
                          })
                        }
                        placeholder="Kaynağın adı (ör. kaza raporu)"
                        value={source.title}
                      />
                      <input
                        aria-label={`İddia ${number}, kaynak ${sourceIndex + 1} adresi`}
                        className={field}
                        inputMode="url"
                        maxLength={2000}
                        onChange={(event) =>
                          updateSource(index, sourceIndex, {
                            url: event.target.value,
                          })
                        }
                        placeholder="https://…"
                        value={source.url}
                      />
                      <label className="flex items-center gap-1 pb-2 text-xs text-muted">
                        <input
                          aria-label={`İddia ${number}, kaynak ${sourceIndex + 1} birincil kaynak`}
                          checked={source.primary}
                          onChange={(event) =>
                            updateSource(index, sourceIndex, {
                              primary: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />
                        Birincil
                      </label>
                      {!disabled && (
                        <button
                          aria-label={`İddia ${number}, kaynak ${sourceIndex + 1} satırını kaldır`}
                          className="button button-quiet"
                          onClick={() =>
                            update(index, {
                              sources: note.sources.filter(
                                (_, i) => i !== sourceIndex,
                              ),
                            })
                          }
                          type="button"
                        >
                          Kaldır
                        </button>
                      )}
                    </div>
                  ))}
                  {disabled && (
                    <ul className="m-0 list-disc space-y-1 pl-5 text-sm">
                      {note.sources
                        .filter((source) => source.title || source.url)
                        .map((source, i) => (
                          <li key={i}>
                            <SourceLink source={source} />
                          </li>
                        ))}
                    </ul>
                  )}
                  {!disabled && (
                    <div>
                      <button
                        aria-label={`İddia ${number} için kaynak ekle`}
                        className="button button-quiet"
                        disabled={
                          note.sources.length >=
                          EXPLAINER_LIMITS.sourcesPerClaim
                        }
                        onClick={() =>
                          update(index, {
                            sources: [...note.sources, emptySource()],
                          })
                        }
                        type="button"
                      >
                        Kaynak ekle
                      </button>
                    </div>
                  )}
                </div>
                <label className={label}>
                  İddia {number} için temkinli ifade (kaynaklar ayrışıyorsa)
                  <input
                    className={field}
                    maxLength={1000}
                    onChange={(event) =>
                      update(index, { cautious_wording: event.target.value })
                    }
                    placeholder="ör. “Resmî rapora göre…”, “Kesin sayı bilinmiyor; kaynaklar 40 ile 60 arasında veriyor.”"
                    value={note.cautious_wording}
                  />
                  <span className={hint}>
                    Kaynaklar aynı şeyi söylemiyorsa senaryoda kesin konuşmayın;
                    kullanılacak ifadeyi buraya yazın.
                  </span>
                </label>
                <label className={label}>
                  İddia {number} notu (isteğe bağlı)
                  <input
                    className={field}
                    maxLength={1000}
                    onChange={(event) =>
                      update(index, { note: event.target.value })
                    }
                    value={note.note}
                  />
                </label>
                {!disabled && (
                  <div>
                    <button
                      className="button button-quiet"
                      onClick={() =>
                        onChange(notes.filter((_, i) => i !== index))
                      }
                      type="button"
                    >
                      İddia {number} satırını kaldır
                    </button>
                  </div>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>
      {!disabled && (
        <div>
          <button
            className="button"
            disabled={notes.length >= EXPLAINER_LIMITS.factNotes}
            onClick={() => onChange([...notes, emptyFactNote()])}
            type="button"
          >
            İddia ekle
          </button>
        </div>
      )}
      {!disabled && hasFactGaps(normalized) && (
        <p className="m-0 text-xs text-muted">
          Kaynak eksiğiyle de kaydedebilirsiniz; onay sırasında eksiği
          bildiğinizi ayrıca işaretlemeniz istenir.
        </p>
      )}
    </div>
  );
}
