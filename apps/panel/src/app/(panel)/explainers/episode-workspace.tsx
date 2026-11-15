'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  EXPLAINER_LIMITS,
  MIN_SOURCES_PER_CLAIM,
  SENSITIVITY_FLAGS,
  SENSITIVITY_FLAG_LABELS,
  canApproveScript,
  canEditScript,
  hasFactGaps,
  isEpisodeStatus,
  unsourcedClaimCount,
  type FactNote,
} from '@ai-influencer/shared';
import { ConfirmDialog, Toast } from '@/components/ui';
import {
  emptySource,
  normalizeFactNotes,
  toFactNoteDrafts,
  type FactNoteDraft,
} from '@/lib/explainer/model';
import type { EpisodeDetail, VersionItem } from '@/lib/explainer/queries';
import {
  scriptApprovalSchema,
  scriptSaveSchema,
} from '@/lib/explainer/schemas';
import { DiffView } from './diff-view';
import { FactNotesEditor } from './fact-notes-editor';
import {
  ApiError,
  Badge,
  ErrorText,
  api,
  field,
  formatDate,
  hint,
  label,
} from './shared';

/** Senaryo paketinin sunucudaki hâli: taslak bunun üstüne yazılır, kilit bu sürüme bakar. */
type Snapshot = {
  version: number;
  text: string;
  notes: FactNote[];
  flags: string[];
  sensitivityNote: string;
  scriptJson: string;
};
type Draft = {
  text: string;
  notes: FactNoteDraft[];
  flags: string[];
  sensitivityNote: string;
  scriptJson: string;
};
type ScriptRow = {
  script_text: string;
  script: unknown;
  fact_notes: unknown;
  sensitivity_flags: string[];
  sensitivity_note: string | null;
  script_version: number;
};

function snapshot(row: ScriptRow): Snapshot {
  return {
    version: row.script_version,
    text: row.script_text,
    notes: normalizeFactNotes(toFactNoteDrafts(row.fact_notes)),
    flags: [...row.sensitivity_flags].sort(),
    sensitivityNote: row.sensitivity_note ?? '',
    scriptJson: row.script ? JSON.stringify(row.script, null, 2) : '',
  };
}
/** Taslakta her iddia en az iki kaynak satırıyla açılır (kural: iddia başına iki kaynak). */
const toDraft = (base: Snapshot): Draft => ({
  text: base.text,
  notes: toFactNoteDrafts(base.notes).map((note) => ({
    ...note,
    sources: [
      ...note.sources,
      ...Array.from(
        { length: Math.max(0, MIN_SOURCES_PER_CLAIM - note.sources.length) },
        emptySource,
      ),
    ],
  })),
  flags: base.flags,
  sensitivityNote: base.sensitivityNote,
  scriptJson: base.scriptJson,
});
const fingerprint = (value: {
  text: string;
  notes: readonly FactNote[];
  flags: readonly string[];
  sensitivityNote: string;
  scriptJson: string;
}) =>
  JSON.stringify([
    value.text,
    value.notes,
    [...value.flags].sort(),
    value.sensitivityNote.trim(),
    value.scriptJson.trim(),
  ]);

const REAL_EVENT_RULES = [
  'Saygılı ve sakin anlatım: abartılı başlık, geri sayım, sömürü dili yok.',
  'Mahremiyet: kamuya açık olmayan ayrıntı, yaralanma görüntüsü ve aileyi hedef gösteren bilgi kullanılmaz; reşit olmayanların adı verilmez.',
  'Suçlama yalnız resmî bulguya dayanır; soruşturma sürüyorsa bunu söyleyin.',
  'Sonunda olaydan çıkan dersi ya da değişen kuralı verin.',
];

/**
 * Bölümün senaryo çalışma alanı (#218 arayüzü): senaryo metni, iddia → kaynak tablosu,
 * hassasiyet, iyimser kilitli kayıt, sürüm geçmişi / geri yükleme ve onay.
 * Başka biri araya girerse kayıt reddedilir ve kullanıcı iki sürümü görüp kendi karar verir;
 * hiçbir zaman sessizce üstüne yazılmaz.
 */
export function EpisodeWorkspace({
  detail,
  canWrite,
}: {
  detail: EpisodeDetail;
  canWrite: boolean;
}) {
  const router = useRouter();
  const { episode, versions } = detail;
  const [base, setBase] = useState(() => snapshot(episode));
  const [draft, setDraft] = useState(() => toDraft(base));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [conflict, setConflict] = useState<Snapshot | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [compare, setCompare] = useState<number | null>(null);
  const [restore, setRestore] = useState<VersionItem | null>(null);

  const draftNotes = normalizeFactNotes(draft.notes);
  const dirty =
    fingerprint({ ...draft, notes: draftNotes }) !== fingerprint(base);
  // Sunucudaki sürüm ilerledi (başka sekme, başka kullanıcı ya da ayarlardan tür değişti).
  const serverAhead = episode.script_version > base.version;
  if (serverAhead && !dirty && !conflict) {
    const next = snapshot(episode);
    setBase(next);
    setDraft(toDraft(next));
  }

  const status = isEpisodeStatus(episode.status) ? episode.status : 'draft';
  const editable = canWrite && canEditScript(status);
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  function adopt(row: ScriptRow, message: string) {
    const next = snapshot(row);
    setBase(next);
    setDraft(toDraft(next));
    setConflict(null);
    setAcknowledged(false);
    setError('');
    setToast(message);
    router.refresh();
  }

  async function loadLatest() {
    const { script } = await api<{ script: ScriptRow }>(
      `/api/explainers/episodes/${episode.id}/script`,
    );
    setConflict(snapshot(script));
  }

  async function save(
    content: {
      text: string;
      notes: readonly FactNote[];
      flags: readonly string[];
      sensitivityNote: string;
      scriptJson: string;
    },
    expectedVersion: number,
    message: string,
  ) {
    // undefined: dokunma · null: temizle (alan boşaltıldı ya da geri yüklenen sürümde yok).
    let script: Record<string, unknown> | null | undefined;
    if (!content.scriptJson.trim() && base.scriptJson.trim()) {
      script = null;
    } else if (
      content.scriptJson.trim() &&
      content.scriptJson.trim() !== base.scriptJson.trim()
    ) {
      try {
        const parsed: unknown = JSON.parse(content.scriptJson);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
          throw new Error('nesne değil');
        script = parsed as Record<string, unknown>;
      } catch {
        return setError(
          'Yapılandırılmış senaryo geçerli bir JSON nesnesi olmalı.',
        );
      }
    }
    const parsed = scriptSaveSchema.safeParse({
      script_text: content.text,
      fact_notes: content.notes,
      sensitivity_flags: content.flags,
      sensitivity_note: content.sensitivityNote,
      expected_version: expectedVersion,
      ...(script !== undefined ? { script } : {}),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return setError(
        issue?.path.includes('url')
          ? 'Kaynak adresi http:// ya da https:// ile başlamalı.'
          : issue?.path.includes('claim')
            ? 'Kaynağı yazılmış her iddianın metni de olmalı (en çok 1000 karakter).'
            : issue?.path.includes('sources')
              ? 'Her kaynağın adı ya da adresi olmalı (ad en çok 300 karakter).'
              : 'Senaryo kaydedilemedi: alanları denetleyin.',
      );
    }
    setPending(true);
    setError('');
    try {
      const result = await api<{ episode: ScriptRow }>(
        `/api/explainers/episodes/${episode.id}/script`,
        'PUT',
        parsed.data,
      );
      adopt(result.episode, message);
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'version_conflict') {
        setError('');
        await loadLatest().catch(() =>
          setError('Güncel sürüm alınamadı. Sayfayı yenileyin.'),
        );
      } else {
        setError(
          cause instanceof Error ? cause.message : 'İşlem tamamlanamadı.',
        );
      }
    } finally {
      setPending(false);
    }
  }

  const saveDraft = (expectedVersion: number, message: string) =>
    save({ ...draft, notes: draftNotes }, expectedVersion, message);

  async function approve() {
    const parsed = scriptApprovalSchema.safeParse({
      script_version: base.version,
      acknowledge_fact_gaps: acknowledged,
    });
    if (!parsed.success) return;
    setPending(true);
    setError('');
    try {
      await api(
        `/api/explainers/episodes/${episode.id}/approve`,
        'POST',
        parsed.data,
      );
      setAcknowledged(false);
      setToast('Senaryo onaylandı. Artık üretime gönderilebilir.');
      router.refresh();
    } catch (cause) {
      if (cause instanceof ApiError && cause.code === 'version_conflict')
        router.refresh();
      setError(cause instanceof Error ? cause.message : 'İşlem tamamlanamadı.');
    } finally {
      setPending(false);
    }
  }

  // Onay kayıtlı sürüme verilir: eksik sayımı kayıtlı notlardan, veritabanıyla aynı kuralla.
  const savedGaps = unsourcedClaimCount(base.notes);
  const savedHasNotes = base.notes.length > 0;
  const hasGaps = hasFactGaps(base.notes);
  const approved =
    episode.script_approved_at !== null &&
    episode.script_version === base.version;
  const lastApproved = versions.find(
    (version) =>
      version.approved_at && version.version !== episode.script_version,
  );
  const sensitive = episode.kind === 'event' || draft.flags.length > 0;
  const compared = versions.find((version) => version.version === compare);

  return (
    <>
      <section aria-labelledby="episode-script" className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              SENARYO · SÜRÜM {base.version === 0 ? '—' : base.version}
            </p>
            <h2 id="episode-script">Senaryo ve kaynak notları</h2>
          </div>
          {dirty && <Badge tone="attention">Kaydedilmemiş değişiklik</Badge>}
        </div>

        {!editable && canWrite && (
          <p className="mt-4 mb-0 text-sm text-text" role="note">
            {status === 'archived'
              ? 'Bölüm arşivde: senaryo değiştirilemez. Önce arşivden çıkarın.'
              : status === 'published'
                ? 'Bölüm yayınlandı: senaryo değiştirilemez.'
                : 'Üretim sürerken senaryo değiştirilemez. Değiştirmek için önce üretim işini iptal edin.'}
          </p>
        )}

        <div className="mt-4 grid gap-5">
          <label className={label}>
            Anlatıcı metni
            <textarea
              className={`${field} font-mono leading-relaxed`}
              disabled={!editable}
              maxLength={EXPLAINER_LIMITS.scriptText}
              onChange={(event) => set({ text: event.target.value })}
              placeholder="İlk beş saniyede kanca; ardından her satır ekranda gösterilecek bir şeyi anlatsın."
              rows={14}
              value={draft.text}
            />
            <span className={hint}>
              {draft.text.length.toLocaleString('tr-TR')} /{' '}
              {EXPLAINER_LIMITS.scriptText.toLocaleString('tr-TR')} karakter ·
              seslendirilecek metin budur.
            </span>
          </label>

          {draft.scriptJson !== '' && (
            <details className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer text-sm font-medium text-text">
                Yapılandırılmış senaryo (script.json)
              </summary>
              <label className={`${label} mt-3`}>
                Motorun okuduğu sahne yapısı
                <textarea
                  className={`${field} font-mono`}
                  disabled={!editable}
                  onChange={(event) => set({ scriptJson: event.target.value })}
                  rows={12}
                  spellCheck={false}
                  value={draft.scriptJson}
                />
                <span className={hint}>
                  Geçerli bir JSON nesnesi olmalı (en çok 128 KB). Buradan
                  değiştirilebilir, kaldırılamaz.
                </span>
              </label>
            </details>
          )}

          <div>
            <h3 className="m-0 text-sm font-semibold text-text">
              İddia → kaynak tablosu
            </h3>
            <p className="mt-1 mb-3 text-xs text-muted">
              Senaryodaki her olgu için en az iki kaynak yazın. İki kaynaktan
              azı olan iddia işaretlenir ve onayda ayrıca sorulur.
            </p>
            <FactNotesEditor
              disabled={!editable}
              notes={draft.notes}
              onChange={(notes) => set({ notes })}
            />
          </div>

          <fieldset
            className="grid gap-3 rounded-xl border border-line p-4"
            disabled={!editable}
          >
            <legend className="px-1 text-xs font-semibold text-text">
              Hassasiyet (gerçek olaylar)
            </legend>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {SENSITIVITY_FLAGS.map((flag) => (
                <label
                  className="flex items-center gap-2 text-sm text-text"
                  key={flag}
                >
                  <input
                    checked={draft.flags.includes(flag)}
                    onChange={(event) =>
                      set({
                        flags: event.target.checked
                          ? [...draft.flags, flag].sort()
                          : draft.flags.filter((item) => item !== flag),
                      })
                    }
                    type="checkbox"
                  />
                  {SENSITIVITY_FLAG_LABELS[flag]}
                </label>
              ))}
            </div>
            {sensitive && (
              <div
                className="rounded-lg border border-accent bg-surface p-3 text-sm text-text"
                role="note"
              >
                <p className="m-0 font-medium">Gerçek olay anlatırken:</p>
                <ul className="mt-1 mb-0 list-disc space-y-1 pl-5">
                  {REAL_EVENT_RULES.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>
            )}
            <label className={label}>
              Hassasiyet notu (isteğe bağlı)
              <textarea
                className={field}
                maxLength={EXPLAINER_LIMITS.sensitivityNote}
                onChange={(event) =>
                  set({ sensitivityNote: event.target.value })
                }
                rows={2}
                value={draft.sensitivityNote}
              />
            </label>
          </fieldset>

          {serverAhead && dirty && !conflict && (
            <div
              className="rounded-xl border border-accent bg-surface p-4 text-sm text-text"
              role="alert"
            >
              <p className="m-0 font-medium">
                ⚠ Siz yazarken bu senaryoyu başka biri değiştirdi (sürüm{' '}
                {episode.script_version}).
              </p>
              <p className="mt-1 mb-3">
                Yazdıklarınız duruyor. Kaydetmeden önce iki sürümü
                karşılaştırın.
              </p>
              <button
                className="button"
                disabled={pending}
                onClick={() =>
                  void loadLatest().catch(() =>
                    setError('Güncel sürüm alınamadı. Sayfayı yenileyin.'),
                  )
                }
                type="button"
              >
                Güncel sürümle karşılaştır
              </button>
            </div>
          )}

          {conflict && (
            <div
              aria-labelledby="conflict-title"
              className="grid gap-3 rounded-xl border border-accent bg-surface p-4"
              role="alertdialog"
            >
              <h3
                className="m-0 text-sm font-semibold text-text"
                id="conflict-title"
              >
                ⚠ Senaryoyu bu arada başka biri değiştirdi
              </h3>
              <p className="m-0 text-sm text-text">
                Siz sürüm {base.version} üzerinde çalışıyordunuz; güncel sürüm{' '}
                {conflict.version}. Kaydınız yapılmadı ve yazdıklarınız duruyor.
                Aşağıda güncel sürüm ile sizin metniniz arasındaki farkı görüp
                karar verin.
              </p>
              <DiffView
                after={{ text: draft.text, notes: draftNotes }}
                afterLabel="Sizin metniniz"
                before={{ text: conflict.text, notes: conflict.notes }}
                beforeLabel={`Güncel sürüm ${conflict.version}`}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  className="button"
                  disabled={pending}
                  onClick={() => {
                    setBase(conflict);
                    setDraft(toDraft(conflict));
                    setConflict(null);
                    setToast('Güncel sürüm yüklendi.');
                  }}
                  type="button"
                >
                  Güncel sürümü yükle (yazdıklarımı bırak)
                </button>
                <button
                  className="button"
                  disabled={pending}
                  onClick={() =>
                    void saveDraft(
                      conflict.version,
                      'Metniniz yeni sürüm olarak kaydedildi; önceki sürüm geçmişte duruyor.',
                    )
                  }
                  type="button"
                >
                  Benim metnimi yeni sürüm olarak kaydet
                </button>
                <button
                  className="button button-quiet"
                  onClick={() => setConflict(null)}
                  type="button"
                >
                  Düzenlemeye dön
                </button>
              </div>
              <p className="m-0 text-xs text-muted">
                “Yeni sürüm olarak kaydet” diğer kişinin sürümünü silmez: sürüm
                geçmişinde kalır ve geri yüklenebilir.
              </p>
            </div>
          )}

          {editable && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="button button-primary mt-0!"
                disabled={pending || !dirty || conflict !== null}
                onClick={() =>
                  void saveDraft(
                    base.version,
                    episode.script_approved_at
                      ? 'Senaryo kaydedildi. Değiştiği için onay silindi; yeniden onay gerekir.'
                      : 'Senaryo kaydedildi.',
                  )
                }
                type="button"
              >
                {pending ? 'Kaydediliyor…' : 'Senaryoyu kaydet'}
              </button>
              {dirty && (
                <button
                  className="button button-quiet"
                  disabled={pending}
                  onClick={() => {
                    setDraft(toDraft(base));
                    setConflict(null);
                    setError('');
                  }}
                  type="button"
                >
                  Değişiklikleri geri al
                </button>
              )}
              {dirty && episode.script_approved_at && (
                <span className="text-xs text-muted">
                  Kaydederseniz mevcut onay silinir.
                </span>
              )}
            </div>
          )}
          <ErrorText>{error}</ErrorText>
        </div>
      </section>

      <section aria-labelledby="episode-approval" className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">ONAYSIZ ÜRETİM YOK</p>
            <h2 id="episode-approval">Senaryo onayı</h2>
          </div>
          {approved ? (
            <Badge tone="done">✓ Onaylı</Badge>
          ) : (
            <Badge tone={base.text.trim() ? 'attention' : 'neutral'}>
              {base.text.trim() ? 'Onay bekliyor' : 'Senaryo yok'}
            </Badge>
          )}
        </div>
        <div className="mt-4 grid gap-3 text-sm text-text">
          {approved ? (
            <>
              <p className="m-0">
                Sürüm {episode.script_approved_version}{' '}
                {formatDate(episode.script_approved_at!)} tarihinde{' '}
                {detail.approverEmail ?? 'bir ekip üyesi'} tarafından onaylandı.
              </p>
              {episode.script_approved_with_gaps && (
                <p className="m-0">
                  <Badge tone="attention">
                    ⚠ Kaynak eksiği bilinerek onaylandı
                  </Badge>
                </p>
              )}
              <p className="m-0 text-muted">
                Senaryoyu, kaynak notlarını ya da hassasiyet alanlarını
                değiştirirseniz onay silinir ve yeniden onay gerekir.
              </p>
            </>
          ) : (
            <>
              <dl className="m-0 grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">Onaylamak ne demek?</dt>
                  <dd className="m-0">
                    Okuduğunuz sürümün (sürüm {base.version || '—'}) üretime
                    girmesine izin verirsiniz. Kim, ne zaman onayladı
                    kaydedilir.
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Kim onaylayabilir?</dt>
                  <dd className="m-0">
                    Owner ve editör, panelden. İzleyici ve üretim makinesi
                    onaylayamaz.
                  </dd>
                </div>
              </dl>
              {lastApproved && (
                <p
                  className="m-0 rounded-lg border border-accent bg-surface p-3"
                  role="note"
                >
                  ⚠ Sürüm {lastApproved.version}{' '}
                  {formatDate(lastApproved.approved_at!)} tarihinde
                  onaylanmıştı. Senaryo sonra değiştiği için o onay geçersiz;
                  güncel sürüm yeniden onaylanmalı.
                </p>
              )}
              {base.text.trim() === '' ? (
                <p className="m-0 text-muted">
                  Önce senaryoyu yazıp kaydedin; onay kayıtlı sürüme verilir.
                </p>
              ) : !canWrite ? (
                <p className="m-0 text-muted">İzleyici rolü onay veremez.</p>
              ) : (
                canApproveScript(status) && (
                  <>
                    {hasGaps && (
                      <label className="flex items-start gap-2 rounded-lg border border-accent bg-surface p-3">
                        <input
                          checked={acknowledged}
                          className="mt-1"
                          onChange={(event) =>
                            setAcknowledged(event.target.checked)
                          }
                          type="checkbox"
                        />
                        <span>
                          <strong>
                            Kaynak eksiğini biliyorum, yine de onaylıyorum.
                          </strong>
                          <span className="block text-muted">
                            {savedHasNotes
                              ? `${savedGaps} iddianın iki kaynağı yok.`
                              : 'Bu senaryo için hiç kaynak notu yazılmamış.'}{' '}
                            Onay “kaynak eksiğiyle” diye kaydedilir.
                          </span>
                        </span>
                      </label>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        className="button button-primary mt-0!"
                        disabled={
                          pending || dirty || (hasGaps && !acknowledged)
                        }
                        onClick={() => void approve()}
                        type="button"
                      >
                        Senaryoyu onayla (sürüm {base.version})
                      </button>
                      {dirty && (
                        <span className="text-xs text-muted">
                          Önce değişiklikleri kaydedin: onay kayıtlı sürüme
                          verilir.
                        </span>
                      )}
                    </div>
                  </>
                )
              )}
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="episode-versions" className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">HİÇBİR SÜRÜM KAYBOLMAZ</p>
            <h2 id="episode-versions">Sürüm geçmişi</h2>
          </div>
        </div>
        {versions.length === 0 ? (
          <p className="mt-4 mb-0 text-sm text-muted">
            Henüz kayıtlı sürüm yok. Senaryo her değiştiğinde yeni bir sürüm
            açılır; eskisi burada kalır.
          </p>
        ) : (
          <ol className="mt-2 mb-0 list-none divide-y divide-line-soft p-0">
            {versions.map((version) => {
              const current = version.version === base.version;
              return (
                <li className="grid gap-3 py-3" key={version.id}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <strong>Sürüm {version.version}</strong>
                    {current && <Badge>Güncel</Badge>}
                    {version.approved_at && (
                      <Badge tone="done">
                        ✓ Onaylandı
                        {version.approved_with_gaps
                          ? ' (kaynak eksiğiyle)'
                          : ''}
                      </Badge>
                    )}
                    {version.unsourced_claim_count > 0 && (
                      <Badge tone="attention">
                        ⚠ {version.unsourced_claim_count} kaynağı eksik iddia
                      </Badge>
                    )}
                    <span className="text-xs text-muted">
                      {formatDate(version.created_at)} ·{' '}
                      {version.authorEmail ?? 'ekip üyesi'}
                    </span>
                    <span className="ml-auto flex flex-wrap gap-2">
                      {!current && (
                        <button
                          aria-expanded={compare === version.version}
                          className="button button-quiet"
                          onClick={() =>
                            setCompare(
                              compare === version.version
                                ? null
                                : version.version,
                            )
                          }
                          type="button"
                        >
                          {compare === version.version
                            ? 'Karşılaştırmayı kapat'
                            : `Sürüm ${version.version} ile güncel sürümü karşılaştır`}
                        </button>
                      )}
                      {!current && editable && (
                        <button
                          className="button"
                          disabled={pending}
                          onClick={() => setRestore(version)}
                          type="button"
                        >
                          Sürüm {version.version}: bu sürümü geri yükle
                        </button>
                      )}
                    </span>
                  </div>
                  {compared && compare === version.version && (
                    <DiffView
                      after={{ text: base.text, notes: base.notes }}
                      afterLabel={`Güncel sürüm ${base.version}`}
                      before={{
                        text: compared.script_text,
                        notes: normalizeFactNotes(
                          toFactNoteDrafts(compared.fact_notes),
                        ),
                      }}
                      beforeLabel={`Sürüm ${compared.version}`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <ConfirmDialog
        confirmLabel="Geri yükle"
        description={`Sürüm ${restore?.version ?? ''} içeriği yeni bir sürüm olarak kaydedilir; aradaki sürümler silinmez. Senaryo onaylıysa onay silinir.${
          dirty ? ' Kaydedilmemiş değişiklikleriniz kaybolur.' : ''
        }`}
        onCancel={() => setRestore(null)}
        onConfirm={() => {
          const version = restore;
          setRestore(null);
          if (!version) return;
          const row = snapshot({
            script_text: version.script_text,
            script: version.script,
            fact_notes: version.fact_notes,
            sensitivity_flags: version.sensitivity_flags,
            sensitivity_note: version.sensitivity_note,
            script_version: version.version,
          });
          void save(
            row,
            base.version,
            `Sürüm ${version.version} yeni sürüm olarak geri yüklendi.`,
          );
        }}
        open={restore !== null}
        title="Bu sürüm geri yüklensin mi?"
      />
      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </>
  );
}
