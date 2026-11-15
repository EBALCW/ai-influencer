'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import {
  EVIDENCE_LEVELS,
  EVIDENCE_LEVEL_LABELS,
  EXPLAINER_KINDS,
  EXPLAINER_KIND_LABELS,
  EXPLAINER_LIMITS,
  isEvidenceLevel,
  isExplainerKind,
} from '@ai-influencer/shared';
import { Toast } from '@/components/ui';
import { SUGGESTION_STATUS_LABELS } from '@/lib/explainer/model';
import type { TopicRequestDetail } from '@/lib/explainer/queries';
import {
  suggestionRejectSchema,
  suggestionsAddSchema,
} from '@/lib/explainer/schemas';
import {
  Badge,
  ErrorText,
  SimilarTopics,
  SourceLink,
  api,
  card,
  fetchSimilar,
  field,
  hint,
  label,
  useAction,
  useSimilarTopics,
  type SimilarTopic,
} from './shared';

type Suggestion = TopicRequestDetail['suggestions'][number];

const EVIDENCE_HINTS: Record<string, string> = {
  proven:
    'Benzer bir video, kendi kanalının ortancasının en az 3 katı izlenmiş.',
  format_example:
    'Bu formatın işlediğine dair örnek var; konu için ayrı kanıt yok.',
  original: 'Özgün fikir; izlenme kanıtı yok.',
};

const detailLabels: Record<string, string> = {
  views: 'İzlenme',
  median: 'Kanal ortancası',
  channel_median: 'Kanal ortancası',
  sample_size: 'Örnek sayısı',
  published_at: 'Yayın tarihi',
  checked_at: 'Bakış tarihi',
  url: 'Örnek',
  channel: 'Kanal',
};

function sources(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === 'object',
      )
    : [];
}

function SuggestionCard({
  suggestion,
  canWrite,
  onToast,
}: {
  suggestion: Suggestion;
  canWrite: boolean;
  onToast: (message: string) => void;
}) {
  const { pending, error, run } = useAction();
  const [similar, setSimilar] = useState<SimilarTopic[] | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const detail = Object.entries(
    suggestion.evidence_detail && typeof suggestion.evidence_detail === 'object'
      ? (suggestion.evidence_detail as Record<string, unknown>)
      : {},
  ).filter(
    ([, value]) => typeof value === 'string' || typeof value === 'number',
  );
  const candidates = sources(suggestion.source_candidates);

  const pick = () =>
    run(
      () => api(`/api/explainers/suggestions/${suggestion.id}/pick`, 'POST'),
      () => {
        setSimilar(null);
        onToast('Öneri seçildi ve bölüme çevrildi.');
      },
    );

  async function startPick() {
    // Seçmeden önce benzer eski konulara bakılır; varsa kullanıcı görüp karar verir (#202).
    const found = await fetchSimilar(suggestion.title, {
      suggestionId: suggestion.id,
    }).catch(() => []);
    if (found.length === 0) return pick();
    setSimilar(found);
  }

  function reject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = suggestionRejectSchema.safeParse(
      reason.trim() ? { reason } : {},
    );
    if (!parsed.success) return;
    void run(
      () =>
        api(
          `/api/explainers/suggestions/${suggestion.id}/reject`,
          'POST',
          parsed.data,
        ),
      () => {
        setRejecting(false);
        onToast(
          'Öneri elendi. Listede kalır; fikir değişirse yine seçilebilir.',
        );
      },
    );
  }

  return (
    <article
      aria-label={`Öneri: ${suggestion.title}`}
      className={`${card} flex h-full flex-col gap-3 ${
        suggestion.status === 'rejected' ? 'opacity-80' : ''
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="m-0 min-w-0 flex-1 text-sm font-semibold break-words">
          {suggestion.title}
        </h3>
        <Badge
          tone={
            suggestion.status === 'picked'
              ? 'done'
              : suggestion.status === 'rejected'
                ? 'muted'
                : 'attention'
          }
        >
          {SUGGESTION_STATUS_LABELS[
            suggestion.status as keyof typeof SUGGESTION_STATUS_LABELS
          ] ?? 'Bilinmiyor'}
        </Badge>
      </header>
      <p className="m-0 flex flex-wrap gap-1">
        <Badge>
          {isExplainerKind(suggestion.kind)
            ? EXPLAINER_KIND_LABELS[suggestion.kind]
            : 'Tür yok'}
        </Badge>
        <Badge
          tone={suggestion.evidence_level === 'proven' ? 'done' : 'neutral'}
        >
          Kanıt:{' '}
          {isEvidenceLevel(suggestion.evidence_level)
            ? EVIDENCE_LEVEL_LABELS[suggestion.evidence_level]
            : 'bilinmiyor'}
        </Badge>
      </p>
      <dl className="m-0 grid gap-2 text-sm">
        {(
          [
            ['Özet', suggestion.summary],
            ['Kanca', suggestion.hook],
            ['Ekranda ne gösterilecek', suggestion.visual_idea],
            ['Hassasiyet notu', suggestion.sensitivity_note ?? ''],
          ] as const
        )
          .filter(([, value]) => value.trim() !== '')
          .map(([term, value]) => (
            <div key={term}>
              <dt className="text-xs text-muted">{term}</dt>
              <dd className="m-0 break-words whitespace-pre-wrap">{value}</dd>
            </div>
          ))}
        <div>
          <dt className="text-xs text-muted">Kanıt düzeyi</dt>
          <dd className="m-0 text-muted">
            {EVIDENCE_HINTS[suggestion.evidence_level] ?? ''}
            {detail.length > 0 && (
              <span className="block text-text">
                {detail
                  .map(
                    ([key, value]) => `${detailLabels[key] ?? key}: ${value}`,
                  )
                  .join(' · ')}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Kaynak adayları</dt>
          <dd className="m-0">
            {candidates.length === 0 ? (
              <span className="text-muted">Kaynak adayı yazılmadı.</span>
            ) : (
              <ul className="m-0 list-disc space-y-1 pl-5">
                {candidates.map((source, index) => (
                  <li key={index}>
                    <SourceLink source={source} />
                  </li>
                ))}
              </ul>
            )}
          </dd>
        </div>
        {suggestion.status === 'rejected' && suggestion.rejection_reason && (
          <div>
            <dt className="text-xs text-muted">Elenme nedeni</dt>
            <dd className="m-0 break-words">{suggestion.rejection_reason}</dd>
          </div>
        )}
      </dl>

      <footer className="mt-auto flex flex-col gap-2">
        {suggestion.status === 'picked' && suggestion.episodeId && (
          <Link
            className="button"
            href={`/explainers/episodes/${suggestion.episodeId}`}
          >
            Bölümü aç
          </Link>
        )}
        {canWrite &&
          suggestion.status !== 'picked' &&
          similar === null &&
          !rejecting && (
            <div className="flex flex-wrap gap-2">
              <button
                className="button button-primary mt-0!"
                disabled={pending}
                onClick={() => void startPick()}
                type="button"
              >
                {suggestion.status === 'rejected'
                  ? 'Yine de seç'
                  : 'Bu konuyu seç'}
              </button>
              {suggestion.status === 'new' && (
                <button
                  className="button button-quiet"
                  disabled={pending}
                  onClick={() => setRejecting(true)}
                  type="button"
                >
                  Ele
                </button>
              )}
            </div>
          )}
        {similar !== null && (
          <div className="flex flex-col gap-2">
            <SimilarTopics items={similar} />
            <div className="flex flex-wrap gap-2">
              <button
                className="button button-primary mt-0!"
                disabled={pending}
                onClick={() => void pick()}
                type="button"
              >
                Yine de bölüm oluştur
              </button>
              <button
                className="button button-quiet"
                onClick={() => setSimilar(null)}
                type="button"
              >
                Vazgeç
              </button>
            </div>
          </div>
        )}
        {rejecting && (
          <form className="flex flex-col gap-2" onSubmit={reject}>
            <label className={label}>
              Neden eleniyor? (isteğe bağlı)
              <input
                autoFocus
                className={field}
                maxLength={EXPLAINER_LIMITS.rejectionReason}
                onChange={(event) => setReason(event.target.value)}
                value={reason}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button className="button" disabled={pending} type="submit">
                Öneriyi ele
              </button>
              <button
                className="button button-quiet"
                onClick={() => setRejecting(false)}
                type="button"
              >
                Vazgeç
              </button>
            </div>
          </form>
        )}
        <ErrorText>{error}</ErrorText>
      </footer>
    </article>
  );
}

type SourceRow = { title: string; url: string };

function SingleForm({
  requestId,
  defaultKind,
  onDone,
}: {
  requestId: string;
  defaultKind: string;
  onDone: (message: string) => void;
}) {
  const { pending, error, setError, run } = useAction();
  const [title, setTitle] = useState('');
  const [rows, setRows] = useState<SourceRow[]>([{ title: '', url: '' }]);
  const similar = useSimilarTopics(title);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (name: string) => String(data.get(name) ?? '').trim();
    const candidates = rows
      .filter((row) => row.title.trim() || row.url.trim())
      .map((row) => ({
        ...(row.title.trim() ? { title: row.title.trim() } : {}),
        ...(row.url.trim() ? { url: row.url.trim() } : {}),
      }));
    const parsed = suggestionsAddSchema.safeParse({
      suggestions: [
        {
          title,
          kind: text('kind') || undefined,
          evidence_level: text('evidence_level') || undefined,
          ...(text('summary') ? { summary: text('summary') } : {}),
          ...(text('hook') ? { hook: text('hook') } : {}),
          ...(text('visual_idea') ? { visual_idea: text('visual_idea') } : {}),
          ...(text('sensitivity_note')
            ? { sensitivity_note: text('sensitivity_note') }
            : {}),
          ...(candidates.length ? { source_candidates: candidates } : {}),
        },
      ],
    });
    if (!text('kind')) return setError('Tür seçin: olay ya da nasıl çalışır.');
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return setError(
        issue?.path.includes('url')
          ? 'Kaynak adresi http:// ya da https:// ile başlamalı.'
          : (issue?.message ?? 'Form geçersiz.'),
      );
    }
    void run(
      () =>
        api(
          `/api/explainers/topic-requests/${requestId}/suggestions`,
          'POST',
          parsed.data,
        ),
      () => {
        form.reset();
        setTitle('');
        setRows([{ title: '', url: '' }]);
        onDone('Öneri eklendi.');
      },
    );
  }

  return (
    <form
      aria-label="Öneri ekle"
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={onSubmit}
    >
      <label className={`${label} sm:col-span-2`}>
        Öneri başlığı
        <input
          className={field}
          maxLength={EXPLAINER_LIMITS.title}
          onChange={(event) => setTitle(event.target.value)}
          required
          value={title}
        />
      </label>
      <div className="sm:col-span-2">
        <SimilarTopics items={similar} />
      </div>
      <label className={label}>
        Tür
        <select className={field} defaultValue={defaultKind} name="kind">
          <option value="">Seçin…</option>
          {EXPLAINER_KINDS.map((value) => (
            <option key={value} value={value}>
              {EXPLAINER_KIND_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Kanıt düzeyi
        <select className={field} defaultValue="original" name="evidence_level">
          {EVIDENCE_LEVELS.map((value) => (
            <option key={value} value={value}>
              {EVIDENCE_LEVEL_LABELS[value]}
            </option>
          ))}
        </select>
        <span className={hint}>
          Konunun kısa videoda işlediğine dair örnek. Olguların doğruluğu ayrı:
          o, senaryodaki kaynak notlarıyla denetlenir.
        </span>
      </label>
      <label className={`${label} sm:col-span-2`}>
        Özet
        <textarea
          className={field}
          maxLength={EXPLAINER_LIMITS.summary}
          name="summary"
          rows={2}
        />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Kanca
        <input
          className={field}
          maxLength={EXPLAINER_LIMITS.hook}
          name="hook"
        />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Ekranda ne gösterilecek
        <textarea
          className={field}
          maxLength={EXPLAINER_LIMITS.visualIdea}
          name="visual_idea"
          placeholder="Çizilecek 3-5 şey"
          rows={2}
        />
      </label>
      <fieldset className="grid gap-2 rounded-xl border border-line p-3 sm:col-span-2">
        <legend className="px-1 text-xs font-semibold text-text">
          Kaynak adayları
        </legend>
        {rows.map((row, index) => (
          <div
            className="grid gap-2 text-sm sm:grid-cols-[1fr_1fr_auto]"
            key={index}
          >
            <input
              aria-label={`Kaynak adayı ${index + 1} adı`}
              className={field}
              maxLength={300}
              onChange={(event) =>
                setRows(
                  rows.map((item, i) =>
                    i === index ? { ...item, title: event.target.value } : item,
                  ),
                )
              }
              placeholder="Kaynağın adı"
              value={row.title}
            />
            <input
              aria-label={`Kaynak adayı ${index + 1} adresi`}
              className={field}
              inputMode="url"
              maxLength={2000}
              onChange={(event) =>
                setRows(
                  rows.map((item, i) =>
                    i === index ? { ...item, url: event.target.value } : item,
                  ),
                )
              }
              placeholder="https://…"
              value={row.url}
            />
            <button
              aria-label={`Kaynak adayı ${index + 1} satırını kaldır`}
              className="button button-quiet mt-1"
              disabled={rows.length === 1}
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
              type="button"
            >
              Kaldır
            </button>
          </div>
        ))}
        <div>
          <button
            className="button button-quiet"
            disabled={rows.length >= EXPLAINER_LIMITS.sourceCandidates}
            onClick={() => setRows([...rows, { title: '', url: '' }])}
            type="button"
          >
            Kaynak adayı ekle
          </button>
        </div>
      </fieldset>
      <label className={`${label} sm:col-span-2`}>
        Hassasiyet notu (isteğe bağlı)
        <input
          className={field}
          maxLength={500}
          name="sensitivity_note"
          placeholder="ör. Can kaybı var; soruşturma sürüyor"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          className="button button-primary mt-0!"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Ekleniyor…' : 'Öneriyi ekle'}
        </button>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}

function BatchForm({
  requestId,
  defaultKind,
  remaining,
  onDone,
}: {
  requestId: string;
  defaultKind: string;
  remaining: number;
  onDone: (message: string) => void;
}) {
  const { pending, error, setError, run } = useAction();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const kind = String(data.get('kind') ?? '');
    const titles = String(data.get('titles') ?? '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (titles.length === 0) return setError('Her satıra bir başlık yazın.');
    if (titles.length > remaining)
      return setError(`Bu isteğe en çok ${remaining} öneri daha eklenebilir.`);
    if (!kind) return setError('Tür seçin: olay ya da nasıl çalışır.');
    const parsed = suggestionsAddSchema.safeParse({
      suggestions: titles.map((title) => ({ title, kind })),
    });
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? 'Form geçersiz.');
    void run(
      () =>
        api(
          `/api/explainers/topic-requests/${requestId}/suggestions`,
          'POST',
          parsed.data,
        ),
      () => {
        form.reset();
        onDone(`${titles.length} öneri eklendi.`);
      },
    );
  }

  return (
    <form
      aria-label="Toplu öneri ekle"
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={onSubmit}
    >
      <label className={`${label} sm:col-span-2`}>
        Başlıklar (her satıra bir öneri)
        <textarea className={field} name="titles" required rows={5} />
        <span className={hint}>
          Yalnız başlıkla eklenir; özet ve kaynak adaylarını seçtikten sonra
          bölümde yazarsınız. En çok {remaining} satır.
        </span>
      </label>
      <label className={label}>
        Hepsinin türü
        <select className={field} defaultValue={defaultKind} name="kind">
          <option value="">Seçin…</option>
          {EXPLAINER_KINDS.map((value) => (
            <option key={value} value={value}>
              {EXPLAINER_KIND_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          className="button button-primary mt-0!"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Ekleniyor…' : 'Önerileri ekle'}
        </button>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}

type Mode = 'single' | 'batch';

/**
 * Bir konu isteğinin önerileri: kartlar, seç / ele ve öneri ekleme. Ekleme yolu bir "kaynak"
 * seçimidir: bugün elle (tek ya da toplu); yapay zekâ kaynağı (#217) aynı listeye bir seçenek
 * olarak eklenir, kartlar ve seçim akışı değişmez.
 */
export function Suggestions({
  detail,
  canWrite,
}: {
  detail: TopicRequestDetail;
  canWrite: boolean;
}) {
  const [mode, setMode] = useState<Mode>('single');
  const [toast, setToast] = useState('');
  const { request, suggestions, series } = detail;
  const remaining = EXPLAINER_LIMITS.suggestionsPerRequest - suggestions.length;
  const locked = series?.status === 'archived';
  const tab = (value: Mode, text: string) => (
    <button
      aria-pressed={mode === value}
      className={`button ${mode === value ? '' : 'button-quiet'}`}
      onClick={() => setMode(value)}
      type="button"
    >
      {text}
    </button>
  );

  return (
    <>
      <section aria-labelledby="topic-suggestions" className="section-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">KARŞILAŞTIR VE SEÇ</p>
            <h2 id="topic-suggestions">Öneriler</h2>
          </div>
          <span className="soft-badge">
            {suggestions.length} / {EXPLAINER_LIMITS.suggestionsPerRequest}
          </span>
        </div>
        {suggestions.length === 0 ? (
          <p className="mt-4 mb-0 text-sm text-muted">
            Henüz öneri yok.{' '}
            {canWrite
              ? 'Aşağıdan aklınızdaki konuları ekleyin; sonra yan yana karşılaştırıp birini bölüme çevirin.'
              : ''}
          </p>
        ) : (
          <ul className="mt-4 mb-0 grid list-none gap-3 p-0 lg:grid-cols-2">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <SuggestionCard
                  canWrite={canWrite && !locked}
                  onToast={setToast}
                  suggestion={suggestion}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {canWrite && !locked && (
        <section aria-labelledby="topic-add" className="section-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">ÖNERİ KAYNAĞI</p>
              <h2 id="topic-add">Öneri ekle</h2>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              aria-describedby="topic-ai-note"
              className="button"
              disabled
              type="button"
            >
              Yapay zekâdan öneri iste
            </button>
            {tab('single', 'Elle: tek öneri')}
            {tab('batch', 'Elle: toplu')}
          </div>
          <p className="mt-2 mb-4 text-xs text-muted" id="topic-ai-note">
            Yapay zekâ önerileri yakında: bağladığınız yapay zekâ bu isteğe 5-8
            öneri yazacak ve aynı kartlarda görünecek. Şimdilik önerileri elle
            ekleyin.
          </p>
          {remaining <= 0 ? (
            <p className="m-0 text-sm text-text" role="note">
              Bu istek 20 öneri sınırına ulaştı. Yeni fikirler için yeni bir
              konu isteği açın.
            </p>
          ) : mode === 'single' ? (
            <SingleForm
              defaultKind={request.kind ?? ''}
              onDone={setToast}
              requestId={request.id}
            />
          ) : (
            <BatchForm
              defaultKind={request.kind ?? ''}
              onDone={setToast}
              remaining={remaining}
              requestId={request.id}
            />
          )}
        </section>
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </>
  );
}
