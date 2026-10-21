import Link from 'next/link';
import { EmptyState } from '@/components/ui';
import {
  appearanceFields,
  toPersonaInput,
  type PersonaRow,
} from '@/lib/persona';
import { diffPersonas } from '@/lib/persona-diff';
import { PersonaEditor, RestoreVersionButton } from './persona-editor';

const dateTime = (value: string) =>
  new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="whitespace-pre-wrap">{value || 'Belirtilmemiş'}</dd>
    </div>
  );
}

export function PersonaTab({
  influencerId,
  personas,
  canEdit,
  currentUserId,
  authorEmails,
  compare,
  hrefWith,
}: {
  influencerId: string;
  /** Versiyona göre azalan sırada */
  personas: PersonaRow[];
  canEdit: boolean;
  currentUserId: string;
  authorEmails: Record<string, string>;
  compare: { from?: string; to?: string; inf?: string };
  hrefWith: (params: Record<string, string>) => string;
}) {
  const current = personas.find((persona) => persona.is_current) ?? null;
  const input = toPersonaInput(current);

  const byVersion = new Map(personas.map((p) => [String(p.version), p]));
  const older = compare.from ? byVersion.get(compare.from) : undefined;
  const newer = compare.to ? byVersion.get(compare.to) : undefined;
  const diff = older && newer ? diffPersonas(older, newer) : null;
  // Varsayılan karşılaştırma: bir önceki versiyon → güncel
  const defaults = {
    from: String(personas[1]?.version ?? ''),
    to: String(personas[0]?.version ?? ''),
  };

  const author = (id: string | null) =>
    !id
      ? 'Sistem'
      : id === currentUserId
        ? 'Sen'
        : (authorEmails[id] ?? 'Eski ekip üyesi');

  return (
    <div className="page-stack">
      <section
        className="section-card space-y-4"
        aria-labelledby="persona-current"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">GÜNCEL PERSONA</p>
            <h2 className="text-lg font-semibold" id="persona-current">
              {current ? `Persona · v${current.version}` : 'Henüz persona yok'}
            </h2>
            {current?.change_note && (
              <p className="text-sm text-muted">{current.change_note}</p>
            )}
          </div>
        </div>
        {current ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Biyografi" value={input.bio} />
            <Field label="Ses tonu" value={input.tone} />
            <Field
              label="Kişilik sıfatları"
              value={input.adjectives.join(', ')}
            />
            <Field
              label="Kanca özellikleri"
              value={input.hookTraits.join(', ')}
            />
            <Field
              label="Hedef kitle yaş aralığı"
              value={input.audience.ageRange}
            />
            <Field
              label="İlgi alanları"
              value={input.audience.interests.join(', ')}
            />
            <Field
              label="Hedef kitle açıklaması"
              value={input.audience.description}
            />
            {appearanceFields.map(([key, label]) => (
              <Field
                key={key}
                label={`Görünüm · ${label}`}
                value={input.appearance[key]}
              />
            ))}
          </dl>
        ) : (
          <EmptyState
            title="Persona kaydı yok"
            description={
              canEdit
                ? 'İlk kaydı oluşturduğunda v1 olarak saklanır.'
                : 'Bir editor persona oluşturduğunda burada görüntülenecek.'
            }
          />
        )}
        {canEdit && (
          <PersonaEditor influencerId={influencerId} initial={input} />
        )}
      </section>

      <section
        className="section-card space-y-4"
        aria-labelledby="persona-history"
      >
        <div>
          <p className="eyebrow">GEÇMİŞ</p>
          <h2 className="text-lg font-semibold" id="persona-history">
            Versiyon geçmişi
          </h2>
        </div>
        {personas.length ? (
          <div className="data-table-wrap">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Versiyon</th>
                    <th>Tarih</th>
                    <th>Değiştiren</th>
                    <th>Not</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {personas.map((persona) => (
                    <tr key={persona.id}>
                      <td>
                        v{persona.version}
                        {persona.is_current && (
                          <span className="soft-badge ml-2">Güncel</span>
                        )}
                      </td>
                      <td>{dateTime(persona.created_at)}</td>
                      <td>{author(persona.created_by)}</td>
                      <td>
                        {persona.change_note || '—'}
                        {persona.restored_from_version && (
                          <span className="block text-xs text-muted">
                            Kaynak: v{persona.restored_from_version}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="inline-flex flex-wrap gap-2">
                          {current && !persona.is_current && (
                            <Link
                              className="button button-quiet"
                              href={hrefWith({
                                from: String(persona.version),
                                to: String(current.version),
                              })}
                            >
                              Güncel ile karşılaştır
                            </Link>
                          )}
                          {canEdit && !persona.is_current && (
                            <RestoreVersionButton
                              influencerId={influencerId}
                              version={persona.version}
                            />
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState
            title="Geçmiş boş"
            description="Kaydedilen her versiyon burada listelenir."
          />
        )}
      </section>

      {personas.length > 1 && (
        <section
          className="section-card space-y-4"
          aria-labelledby="persona-compare"
        >
          <div>
            <p className="eyebrow">KARŞILAŞTIRMA</p>
            <h2 className="text-lg font-semibold" id="persona-compare">
              İki versiyonu karşılaştır
            </h2>
          </div>
          {/* JS gerektirmeyen GET formu: seçim URL'de kalır, paylaşılabilir */}
          <form className="flex flex-wrap items-end gap-3" method="get">
            <input name="tab" type="hidden" value="persona" />
            {compare.inf && (
              <input name="inf" type="hidden" value={compare.inf} />
            )}
            {(['from', 'to'] as const).map((key) => (
              <label className="block text-xs font-medium text-muted" key={key}>
                {key === 'from' ? 'Eski' : 'Yeni'}
                <select
                  className="mt-2 block rounded-xl border border-line bg-surface px-3 py-2 text-sm text-text"
                  defaultValue={compare[key] ?? defaults[key]}
                  name={key}
                >
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.version}>
                      v{persona.version}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button className="button button-quiet" type="submit">
              Karşılaştır
            </button>
          </form>
          {diff && older && newer && (
            <div aria-live="polite" className="space-y-2">
              <h3 className="text-sm font-semibold">
                v{older.version} → v{newer.version}
              </h3>
              {diff.length ? (
                <ul className="space-y-2" aria-label="Versiyon farkları">
                  {diff.map((entry) => (
                    <li
                      className="rounded-xl border border-line p-3 text-sm"
                      key={entry.path}
                    >
                      <p className="font-medium">{entry.label}</p>
                      {entry.kind === 'text' ? (
                        <p className="mt-1 text-muted">
                          <del>{entry.before || '(boş)'}</del> →{' '}
                          <ins className="text-text no-underline">
                            {entry.after || '(boş)'}
                          </ins>
                        </p>
                      ) : (
                        <p className="mt-1 text-muted">
                          {entry.added.length > 0 && (
                            <>Eklendi: {entry.added.join(', ')} </>
                          )}
                          {entry.removed.length > 0 && (
                            <>Çıkarıldı: {entry.removed.join(', ')}</>
                          )}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">
                  Bu iki versiyon arasında fark yok.
                </p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
