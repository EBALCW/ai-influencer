'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  EXPLAINER_KINDS,
  EXPLAINER_KIND_LABELS,
  EXPLAINER_LIMITS,
} from '@ai-influencer/shared';
import type { Series } from '@/lib/explainer/queries';
import { seriesCreateSchema, seriesPatchSchema } from '@/lib/explainer/schemas';
import {
  ProductionFields,
  VOICES,
  captionMode,
  productionPatch,
  withCaptionMode,
  type ProductionValues,
} from './production-fields';
import { ErrorText, api, field, hint, label, useAction } from './shared';

export const LANGUAGES = [
  { value: 'tr', label: 'Türkçe' },
  { value: 'en', label: 'İngilizce' },
] as const;

/**
 * Seri oluşturma / düzenleme. Yeni seride makul varsayılanlar dolu gelir (stil paketi yolu,
 * Türkçe erkek ses, +8% hız); hepsi bölümde üstüne yazılabilir.
 */
export function SeriesForm({ series }: { series?: Series }) {
  const router = useRouter();
  const { pending, error, setError, run } = useAction();
  const [name, setName] = useState(series?.name ?? '');
  const [theme, setTheme] = useState(series?.theme ?? '');
  const [kind, setKind] = useState(series?.kind ?? '');
  const [language, setLanguage] = useState(series?.language ?? 'tr');
  const [production, setProduction] = useState<ProductionValues>(
    series
      ? {
          visual_route: series.visual_route ?? '',
          style_key: series.style_key ?? '',
          voice_name: series.voice_name ?? '',
          voice_rate: series.voice_rate ?? '',
          caption_mode: captionMode(series.caption_style),
        }
      : {
          visual_route: 'hyperframes',
          style_key: '',
          voice_name: VOICES[0].name,
          voice_rate: '+8%',
          caption_mode: '',
        },
  );

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const settings = {
      theme,
      kind: kind || null,
      language,
      ...productionPatch(production),
      caption_style: withCaptionMode(
        series?.caption_style,
        production.caption_mode,
      ),
    };
    const parsed = series
      ? seriesPatchSchema.safeParse({ name, ...settings })
      : seriesCreateSchema.safeParse({ name, settings });
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? 'Form geçersiz.');
    void run(
      () =>
        series
          ? api<{ series: Series }>(
              `/api/explainers/series/${series.id}`,
              'PATCH',
              parsed.data,
            )
          : api<{ series: Series }>(
              '/api/explainers/series',
              'POST',
              parsed.data,
            ),
      (result) => router.push(`/explainers/series/${result.series.id}`),
    );
  }

  return (
    <form
      aria-label={series ? 'Seriyi düzenle' : 'Yeni seri'}
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={onSubmit}
    >
      <label className={`${label} sm:col-span-2`}>
        Seri adı
        <input
          className={field}
          maxLength={EXPLAINER_LIMITS.seriesName}
          onChange={(event) => setName(event.target.value)}
          placeholder="ör. Nasıl Çalışır?"
          required
          value={name}
        />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Tema (isteğe bağlı)
        <textarea
          className={field}
          maxLength={EXPLAINER_LIMITS.theme}
          onChange={(event) => setTheme(event.target.value)}
          placeholder="Serinin ortak konusu ve bakışı: neyi anlatır, kime anlatır?"
          rows={3}
          value={theme}
        />
        <span className={hint}>
          Konu önerileri ve senaryolar bu temaya göre yazılır.
        </span>
      </label>
      <label className={label}>
        Tür tercihi
        <select
          className={field}
          onChange={(event) => setKind(event.target.value)}
          value={kind}
        >
          <option value="">Karışık (her bölümde seçilir)</option>
          {EXPLAINER_KINDS.map((value) => (
            <option key={value} value={value}>
              {EXPLAINER_KIND_LABELS[value]}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Dil
        <select
          className={field}
          onChange={(event) => setLanguage(event.target.value)}
          value={language}
        >
          {LANGUAGES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
          {!LANGUAGES.some((item) => item.value === language) && (
            <option value={language}>{language}</option>
          )}
        </select>
      </label>
      <fieldset className="grid gap-4 rounded-xl border border-line p-4 sm:col-span-2 sm:grid-cols-2">
        <legend className="px-1 text-xs font-semibold text-text">
          Üretim varsayılanları (bölümde değiştirilebilir)
        </legend>
        <ProductionFields onChange={setProduction} values={production} />
      </fieldset>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          className="button button-primary mt-0!"
          disabled={pending}
          type="submit"
        >
          {pending
            ? 'Kaydediliyor…'
            : series
              ? 'Seriyi kaydet'
              : 'Seriyi oluştur'}
        </button>
        <Link
          className="button button-quiet"
          href={series ? `/explainers/series/${series.id}` : '/explainers'}
        >
          Vazgeç
        </Link>
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}
