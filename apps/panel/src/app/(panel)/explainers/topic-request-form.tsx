'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  EXPLAINER_KINDS,
  EXPLAINER_KIND_LABELS,
  EXPLAINER_LIMITS,
} from '@ai-influencer/shared';
import { topicRequestSchema } from '@/lib/explainer/schemas';
import { ErrorText, api, field, hint, label, useAction } from './shared';

/**
 * Konu isteği: kısa bir alan ya da soru. Öneriler sonraki ekranda eklenir: bugün elle, #217 ile
 * aynı ekranda yapay zekâ tarafından.
 */
export function TopicRequestForm({
  series,
  initialSeriesId,
}: {
  series: Array<{ id: string; name: string }>;
  initialSeriesId: string;
}) {
  const router = useRouter();
  const { pending, error, setError, run } = useAction();
  const [seriesId, setSeriesId] = useState(initialSeriesId);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = topicRequestSchema.safeParse({
      prompt: String(data.get('prompt') ?? ''),
      series_id: seriesId || null,
      kind: String(data.get('kind') ?? '') || null,
    });
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? 'Form geçersiz.');
    void run(
      () =>
        api<{ request: { id: string } }>(
          '/api/explainers/topic-requests',
          'POST',
          parsed.data,
        ),
      (result) => router.push(`/explainers/topics/${result.request.id}`),
    );
  }

  return (
    <form
      aria-label="Konu isteği"
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={onSubmit}
    >
      <label className={`${label} sm:col-span-2`}>
        Ne hakkında video istiyorsunuz?
        <textarea
          className={field}
          maxLength={EXPLAINER_LIMITS.prompt}
          name="prompt"
          placeholder="ör. Havacılıkta az bilinen mühendislik çözümleri"
          required
          rows={3}
        />
        <span className={hint}>
          Bir alan (“havacılık”) ya da belirli bir soru olabilir.
        </span>
      </label>
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
          Seçilen öneri bu serinin sıradaki bölümü olur.
        </span>
      </label>
      <label className={label}>
        Tür tercihi
        <select className={field} defaultValue="" name="kind">
          <option value="">Karışık (olay ve nasıl çalışır)</option>
          {EXPLAINER_KINDS.map((value) => (
            <option key={value} value={value}>
              Yalnız: {EXPLAINER_KIND_LABELS[value]}
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
          {pending ? 'Açılıyor…' : 'İsteği aç ve önerilere geç'}
        </button>
        <Link className="button button-quiet" href="/explainers">
          Vazgeç
        </Link>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}
