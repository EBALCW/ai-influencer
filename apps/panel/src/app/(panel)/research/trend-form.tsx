'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Row } from '@ai-influencer/shared';
import { parseCount, parseDuration } from '@/lib/research/csv';
import {
  costCsvValues,
  costEstimates,
  detectPlatform,
  formatLabels,
  platformLabels,
  sourceLabels,
  statusLabels,
  trendFormats,
  trendPatchSchema,
  trendPlatforms,
  trendSchema,
  trendSources,
} from '@/lib/research/schemas';
import type { ResearchInfluencer } from '@/lib/research/queries';

const field =
  'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text';
const label = 'block text-xs font-medium text-muted';

export const scoreHints: Record<number, string> = {
  5: '5 · birebir uyarlanır, düşük maliyet',
  4: '4 · küçük uyarlamayla',
  3: '3 · konsept uyarlanır, sahne gerekir',
  2: '2 · zor uyarlanır',
  1: '1 · uyarlanamaz / telif riski',
};

type Trend = Row<'trends'>;

function numberField(data: FormData, name: string, parse = parseCount) {
  const raw = String(data.get(name) ?? '');
  try {
    return { value: parse(raw) };
  } catch (error) {
    return { error: (error as Error).message };
  }
}

/** Trend ekleme/düzenleme formu. Doğrulama sunucuyla aynı Zod şemasıyla yapılır. */
export function TrendForm({
  influencers,
  trend,
  defaultInfluencerId,
  onDone,
}: {
  influencers: ResearchInfluencer[];
  trend?: Trend;
  defaultInfluencerId?: string;
  onDone: (message: string) => void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [url, setUrl] = useState(trend?.url ?? '');
  const [platform, setPlatform] = useState(trend?.platform ?? '');
  const detected = url ? detectPlatform(url) : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const data = new FormData(event.currentTarget);
    const text = (name: string) => String(data.get(name) ?? '');
    const numbers = {
      views: numberField(data, 'views'),
      likes: numberField(data, 'likes'),
      comments: numberField(data, 'comments'),
      duration_s: numberField(data, 'duration_s', parseDuration),
    };
    const bad = Object.values(numbers).find((item) => item.error);
    if (bad?.error) return setError(bad.error);
    const score = text('adaptation_score');
    const values = {
      url: text('url'),
      ...(platform ? { platform } : {}),
      influencer_id: text('influencer_id') || null,
      captured_on: text('captured_on') || undefined,
      account_handle: text('account_handle'),
      views: numbers.views.value ?? null,
      likes: numbers.likes.value ?? null,
      comments: numbers.comments.value ?? null,
      duration_s: numbers.duration_s.value ?? null,
      format: text('format'),
      hook: text('hook'),
      sound: text('sound'),
      why_viral: text('why_viral'),
      adaptation_idea: text('adaptation_idea'),
      adaptation_score: score ? Number(score) : null,
      cost_estimate: text('cost_estimate') || null,
      ...(trend?.status === 'used' ? {} : { status: text('status') }),
      source: text('source'),
      notes: text('notes'),
    };
    const schema = trend ? trendPatchSchema : trendSchema;
    const parsed = schema.safeParse(
      trend && !platform ? { ...values, platform: detected } : values,
    );
    if (!parsed.success)
      return setError(parsed.error.issues[0]?.message ?? 'Form geçersiz.');
    setPending(true);
    try {
      const response = await fetch(
        trend ? `/api/trends/${trend.id}` : '/api/trends',
        {
          method: trend ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        },
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? 'Kaydedilemedi.');
      router.refresh();
      onDone(trend ? 'Trend güncellendi.' : 'Trend arşive eklendi.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Kaydedilemedi.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      aria-label={trend ? 'Trendi düzenle' : 'Trend ekle'}
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      onSubmit={onSubmit}
    >
      <label className={`${label} sm:col-span-2`}>
        Link
        <input
          className={field}
          name="url"
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.instagram.com/reel/…"
          required
          type="url"
          value={url}
        />
      </label>
      <label className={label}>
        Platform
        <select
          className={field}
          name="platform"
          onChange={(event) => setPlatform(event.target.value)}
          value={platform}
        >
          <option value="">
            Linkten bul{detected ? ` (${platformLabels[detected]})` : ''}
          </option>
          {trendPlatforms.map((item) => (
            <option key={item} value={item}>
              {platformLabels[item]}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Kapsam
        <select
          className={field}
          defaultValue={
            trend ? (trend.influencer_id ?? '') : (defaultInfluencerId ?? '')
          }
          name="influencer_id"
        >
          <option value="">Global (tüm karakterler)</option>
          {influencers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Kayıt tarihi
        <input
          className={field}
          defaultValue={trend?.captured_on}
          name="captured_on"
          type="date"
        />
      </label>
      <label className={label}>
        Hesap
        <input
          className={field}
          defaultValue={trend?.account_handle}
          maxLength={100}
          name="account_handle"
          placeholder="@hesap"
        />
      </label>
      <label className={label}>
        İzlenme
        <input
          className={field}
          defaultValue={trend?.views ?? ''}
          inputMode="numeric"
          name="views"
          placeholder="1,2M veya 1200000"
        />
      </label>
      <label className={label}>
        Beğeni
        <input
          className={field}
          defaultValue={trend?.likes ?? ''}
          inputMode="numeric"
          name="likes"
        />
      </label>
      <label className={label}>
        Yorum
        <input
          className={field}
          defaultValue={trend?.comments ?? ''}
          inputMode="numeric"
          name="comments"
        />
      </label>
      <label className={label}>
        Süre (sn)
        <input
          className={field}
          defaultValue={trend?.duration_s ?? ''}
          inputMode="numeric"
          name="duration_s"
          placeholder="45 veya 0:45"
        />
      </label>
      <label className={label}>
        Format
        <select
          className={field}
          defaultValue={trend?.format ?? 'other'}
          name="format"
        >
          {trendFormats.map((item) => (
            <option key={item} value={item}>
              {formatLabels[item]}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Uyarlama puanı
        <select
          className={field}
          defaultValue={trend?.adaptation_score ?? ''}
          name="adaptation_score"
        >
          <option value="">Puanlanmadı</option>
          {[5, 4, 3, 2, 1].map((item) => (
            <option key={item} value={item}>
              {scoreHints[item]}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Maliyet tahmini
        <select
          className={field}
          defaultValue={trend?.cost_estimate ?? ''}
          name="cost_estimate"
        >
          <option value="">Belirsiz</option>
          {costEstimates.map((item) => (
            <option key={item} value={item}>
              {costCsvValues[item]}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        Durum
        <select
          className={field}
          defaultValue={trend?.status ?? 'new'}
          disabled={trend?.status === 'used'}
          name="status"
        >
          {(['new', 'shortlisted', 'rejected'] as const).map((item) => (
            <option key={item} value={item}>
              {statusLabels[item]}
            </option>
          ))}
          {trend?.status === 'used' && (
            <option value="used">{statusLabels.used}</option>
          )}
        </select>
      </label>
      <label className={label}>
        Kaynak
        <select
          className={field}
          defaultValue={trend?.source ?? 'manual'}
          name="source"
        >
          {trendSources.map((item) => (
            <option key={item} value={item}>
              {sourceLabels[item]}
            </option>
          ))}
        </select>
      </label>
      <label className={`${label} sm:col-span-2 lg:col-span-3`}>
        Kanca (ilk 3 sn)
        <input
          className={field}
          defaultValue={trend?.hook}
          maxLength={500}
          name="hook"
        />
      </label>
      <label className={`${label} sm:col-span-2 lg:col-span-3`}>
        Neden viral (1 cümle)
        <textarea
          className={field}
          defaultValue={trend?.why_viral}
          maxLength={1000}
          name="why_viral"
          rows={2}
        />
      </label>
      <label className={`${label} sm:col-span-2 lg:col-span-3`}>
        Uyarlama fikri
        <textarea
          className={field}
          defaultValue={trend?.adaptation_idea}
          maxLength={2000}
          name="adaptation_idea"
          rows={2}
        />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Ses / müzik / trend notu
        <input
          className={field}
          defaultValue={trend?.sound}
          maxLength={300}
          name="sound"
        />
      </label>
      <label className={label}>
        Not
        <input
          className={field}
          defaultValue={trend?.notes}
          maxLength={3000}
          name="notes"
        />
      </label>
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
        <button className="button button-primary" disabled={pending}>
          {pending
            ? 'Kaydediliyor…'
            : trend
              ? 'Değişiklikleri kaydet'
              : 'Trendi kaydet'}
        </button>
        <button
          className="button button-quiet"
          onClick={() => onDone('')}
          type="button"
        >
          Vazgeç
        </button>
        {error && (
          <p className="text-sm text-text" role="alert">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
