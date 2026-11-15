'use client';

import { useState, type FormEvent } from 'react';
import {
  EXPLAINER_KINDS,
  EXPLAINER_KIND_LABELS,
  EXPLAINER_LIMITS,
  canMoveEpisode,
  isEpisodeStatus,
} from '@ai-influencer/shared';
import { Toast } from '@/components/ui';
import type { Episode, Series } from '@/lib/explainer/queries';
import { episodePatchSchema } from '@/lib/explainer/schemas';
import { MoveEpisode } from './controls';
import {
  ProductionFields,
  captionMode,
  productionPatch,
  withCaptionMode,
  type ProductionValues,
} from './production-fields';
import {
  ErrorText,
  api,
  field,
  hint,
  label,
  useAction,
  useSimilarTopics,
  SimilarTopics,
} from './shared';

/**
 * Bölümün başlığı, özeti ve üretim ayarları. Üretim ayarları boş bırakılırsa seriden gelir.
 * Başlık, özet, kanca ve üretim ayarları senaryo onayını etkilemez; tür değişirse onay silinir.
 */
export function EpisodeSettings({
  episode,
  series,
  seriesOptions,
}: {
  episode: Episode;
  series: Series | null;
  seriesOptions: Array<{ id: string; name: string }>;
}) {
  const { pending, error, setError, run } = useAction();
  const [toast, setToast] = useState('');
  const [title, setTitle] = useState(episode.title);
  const [kind, setKind] = useState(episode.kind);
  const [production, setProduction] = useState<ProductionValues>({
    visual_route: episode.visual_route ?? '',
    style_key: episode.style_key ?? '',
    voice_name: episode.voice_name ?? '',
    voice_rate: episode.voice_rate ?? '',
    caption_mode: captionMode(episode.caption_style),
  });
  const similar = useSimilarTopics(
    title.trim() === episode.title ? '' : title,
    episode.id,
  );
  const status = isEpisodeStatus(episode.status) ? episode.status : 'draft';
  const kindLocked = !canMoveEpisode(status);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const caption = withCaptionMode(
      episode.caption_style,
      production.caption_mode,
    );
    const parsed = episodePatchSchema.safeParse({
      title,
      summary: String(data.get('summary') ?? ''),
      hook: String(data.get('hook') ?? ''),
      visual_idea: String(data.get('visual_idea') ?? ''),
      // Tür senaryo paketindedir: üretim başladıktan sonra gönderilmez.
      ...(kindLocked || kind === episode.kind ? {} : { kind }),
      ...productionPatch(production),
      caption_style: Object.keys(caption).length ? caption : null,
    });
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? 'Form geçersiz.');
    void run(
      () => api(`/api/explainers/episodes/${episode.id}`, 'PATCH', parsed.data),
      () =>
        setToast(
          kind !== episode.kind && !kindLocked
            ? 'Ayarlar kaydedildi. Tür değiştiği için senaryo onayı silindi.'
            : 'Ayarlar kaydedildi.',
        ),
    );
  }

  return (
    <section aria-labelledby="episode-settings" className="section-card">
      <div className="section-heading">
        <div>
          <p className="eyebrow">BAŞLIK · STİL · SES</p>
          <h2 id="episode-settings">Bölüm ayarları</h2>
        </div>
      </div>
      <form
        aria-label="Bölüm ayarları"
        className="mt-4 grid gap-4 sm:grid-cols-2"
        onSubmit={onSubmit}
      >
        <label className={`${label} sm:col-span-2`}>
          Çalışma başlığı
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
          <select
            className={field}
            disabled={kindLocked}
            onChange={(event) => setKind(event.target.value)}
            value={kind}
          >
            {EXPLAINER_KINDS.map((value) => (
              <option key={value} value={value}>
                {EXPLAINER_KIND_LABELS[value]}
              </option>
            ))}
          </select>
          <span className={hint}>
            {kindLocked
              ? 'Üretimi başlamış bölümün türü değiştirilemez.'
              : 'Tür senaryonun parçasıdır: değişirse onay silinir.'}
          </span>
        </label>
        <label className={label}>
          Kanca
          <input
            className={field}
            defaultValue={episode.hook}
            maxLength={EXPLAINER_LIMITS.hook}
            name="hook"
          />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Özet
          <textarea
            className={field}
            defaultValue={episode.summary}
            maxLength={EXPLAINER_LIMITS.summary}
            name="summary"
            rows={2}
          />
        </label>
        <label className={`${label} sm:col-span-2`}>
          Ekranda ne gösterilecek
          <textarea
            className={field}
            defaultValue={episode.visual_idea}
            maxLength={EXPLAINER_LIMITS.visualIdea}
            name="visual_idea"
            rows={2}
          />
        </label>
        <fieldset className="grid gap-4 rounded-xl border border-line p-4 sm:col-span-2 sm:grid-cols-2">
          <legend className="px-1 text-xs font-semibold text-text">
            Üretim ayarları
            {series ? ' (boş bırakılan seriden gelir)' : ''}
          </legend>
          <ProductionFields
            inherit={
              series
                ? {
                    visual_route: series.visual_route ?? '',
                    style_key: series.style_key ?? '',
                    voice_name: series.voice_name ?? '',
                    voice_rate: series.voice_rate ?? '',
                    caption_mode: captionMode(series.caption_style),
                  }
                : undefined
            }
            onChange={setProduction}
            values={production}
          />
        </fieldset>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button
            className="button button-primary mt-0!"
            disabled={pending}
            type="submit"
          >
            {pending ? 'Kaydediliyor…' : 'Ayarları kaydet'}
          </button>
          <ErrorText>{error}</ErrorText>
        </div>
      </form>
      {canMoveEpisode(status) && (
        <div className="mt-5 border-t border-line-soft pt-4">
          <h3 className="mt-0 mb-2 text-sm font-semibold text-text">
            {series ? `Seri: ${series.name}` : 'Tekil video'}
          </h3>
          <p className="mt-0 mb-2 text-xs text-muted">
            Üretim başlamadan bölümü başka bir seriye taşıyabilir ya da seriden
            çıkarabilirsiniz. Eski numara yeniden kullanılmaz.
          </p>
          <MoveEpisode
            currentSeriesId={episode.series_id}
            episodeId={episode.id}
            options={seriesOptions}
            title={episode.title}
          />
        </div>
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast('')} />}
    </section>
  );
}
