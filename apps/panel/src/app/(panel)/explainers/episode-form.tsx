'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  EXPLAINER_KINDS,
  EXPLAINER_KIND_LABELS,
  EXPLAINER_LIMITS,
  isExplainerKind,
} from '@ai-influencer/shared';
import { episodeCreateSchema } from '@/lib/explainer/schemas';
import {
  ErrorText,
  SimilarTopics,
  api,
  field,
  hint,
  label,
  useAction,
  useSimilarTopics,
} from './shared';

type SeriesOption = { id: string; name: string; kind: string | null };

/**
 * Yeni video: tekil (seri seçilmez) ya da bir serinin sıradaki bölümü. Başlık yazılırken benzer
 * eski konular engellemeyen bir uyarı olarak gösterilir.
 */
export function EpisodeForm({
  series,
  initialSeriesId,
}: {
  series: SeriesOption[];
  initialSeriesId: string;
}) {
  const router = useRouter();
  const { pending, error, setError, run } = useAction();
  const [title, setTitle] = useState('');
  const [seriesId, setSeriesId] = useState(initialSeriesId);
  const [kind, setKind] = useState('');
  const similar = useSimilarTopics(title);
  const selected = series.find((item) => item.id === seriesId);
  const seriesKind =
    selected?.kind && isExplainerKind(selected.kind) ? selected.kind : null;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!kind && !seriesKind)
      return setError('Tür seçin: olay ya da nasıl çalışır.');
    const parsed = episodeCreateSchema.safeParse({
      title,
      kind: kind || null,
      series_id: seriesId || null,
      summary: String(data.get('summary') ?? ''),
      hook: String(data.get('hook') ?? ''),
    });
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? 'Form geçersiz.');
    void run(
      () =>
        api<{ episode: { id: string } }>(
          '/api/explainers/episodes',
          'POST',
          parsed.data,
        ),
      (result) => router.push(`/explainers/episodes/${result.episode.id}`),
    );
  }

  return (
    <form
      aria-label="Yeni video"
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={onSubmit}
    >
      <label className={`${label} sm:col-span-2`}>
        Konu / çalışma başlığı
        <input
          className={field}
          maxLength={EXPLAINER_LIMITS.title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="ör. Planör motorsuz nasıl uçar?"
          required
          value={title}
        />
        <span className={hint}>
          Sonradan değiştirilebilir; yayın başlığı ayrıca yazılır.
        </span>
      </label>
      <div className="sm:col-span-2">
        <SimilarTopics items={similar} />
      </div>
      <label className={label}>
        Seri
        <select
          className={field}
          onChange={(event) => setSeriesId(event.target.value)}
          value={seriesId}
        >
          <option value="">Seri yok (tekil video)</option>
          {series.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <span className={hint}>
          {selected
            ? 'Serinin sıradaki bölüm numarasını alır; stil ve sesi devralır.'
            : 'Tekil video: numara yok, ayarlar video sayfasında seçilir.'}
        </span>
      </label>
      <label className={label}>
        Tür
        <select
          className={field}
          onChange={(event) => setKind(event.target.value)}
          value={kind}
        >
          <option value="">
            {seriesKind
              ? `Seriden: ${EXPLAINER_KIND_LABELS[seriesKind]}`
              : 'Seçin…'}
          </option>
          {EXPLAINER_KINDS.map((value) => (
            <option key={value} value={value}>
              {EXPLAINER_KIND_LABELS[value]}
            </option>
          ))}
        </select>
        <span className={hint}>
          Olay: gerçekten yaşanmış bir şey. Nasıl çalışır: bir mekanizma.
        </span>
      </label>
      <label className={`${label} sm:col-span-2`}>
        Özet (isteğe bağlı)
        <textarea
          className={field}
          maxLength={EXPLAINER_LIMITS.summary}
          name="summary"
          rows={2}
        />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Kanca: ilk beş saniyede ne denecek? (isteğe bağlı)
        <input
          className={field}
          maxLength={EXPLAINER_LIMITS.hook}
          name="hook"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          className="button button-primary mt-0!"
          disabled={pending}
          type="submit"
        >
          {pending
            ? 'Oluşturuluyor…'
            : selected
              ? 'Bölümü oluştur'
              : 'Videoyu oluştur'}
        </button>
        <Link
          className="button button-quiet"
          href={selected ? `/explainers/series/${selected.id}` : '/explainers'}
        >
          Vazgeç
        </Link>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}
