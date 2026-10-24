'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { SocialPlatform } from '@ai-influencer/shared';
import type { ManualSnapshot } from '@/lib/analytics/manual-queries';
import {
  CHECKPOINT_HOURS,
  checkpointLabel,
  formatCount,
  formatDateTime,
  formatPercent,
} from '@/lib/analytics/metrics';

const field =
  'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text';
const label = 'block text-xs font-medium text-muted';

/** Platform API'sinin vermediği metrikler (README'lerde doğrulandı). */
const apiGaps: Partial<Record<SocialPlatform, string>> = {
  tiktok:
    'TikTok API izlenme süresi, tamamlama oranı, kaydetme ve erişim vermez; bunları buradan girebilirsiniz.',
  youtube:
    'YouTube’da kaydetme ve erişim metriği yoktur; izlenme süresi Analytics gecikmesiyle gelir.',
};

/** Boş alan → null, sayı değilse NaN (sunucu 400 döner). */
function numberOrNull(value: FormDataEntryValue | null): number | null {
  const text = String(value ?? '').trim();
  return text === '' ? null : Number(text.replace(',', '.'));
}

/**
 * Elle metrik girişi (#52): API erişimi olmayan hesaplar ve API'nin vermediği
 * metrikler için. Liste herkese, form editor/owner'a görünür.
 */
export function ManualMetricsPanel({
  postId,
  platform,
  entries,
  canWrite,
}: {
  postId: string;
  platform: SocialPlatform;
  entries: ManualSnapshot[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const target = String(data.get('targetHours') ?? '');
    const completion = numberOrNull(data.get('completionPercent'));
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(`/api/posts/${postId}/manual-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetHours: target === '' ? null : Number(target),
          views: numberOrNull(data.get('views')),
          likes: numberOrNull(data.get('likes')),
          comments: numberOrNull(data.get('comments')),
          shares: numberOrNull(data.get('shares')),
          saves: numberOrNull(data.get('saves')),
          reach: numberOrNull(data.get('reach')),
          avgWatchTimeS: numberOrNull(data.get('avgWatchTimeS')),
          completionRate: completion === null ? null : completion / 100,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!response.ok)
        throw new Error(
          response.status === 400
            ? 'Değerler geçersiz: sayaçlar 0 veya pozitif tam sayı, tamamlama %0–100 olmalı.'
            : (result.message ?? result.error ?? 'Metrik kaydedilemedi.'),
        );
      form.reset();
      setMessage(result.message ?? 'Metrik kaydedildi.');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Metrik kaydedilemedi.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="section-card" aria-labelledby="manual-metrics-title">
      <h2 id="manual-metrics-title" className="text-base font-semibold">
        Elle girilen metrikler
      </h2>
      <p className="mt-1 text-sm text-muted">
        {apiGaps[platform] ??
          'API erişimi olmayan hesaplar için ölçümleri buradan girebilirsiniz.'}{' '}
        API’den ölçülmüş kontrol noktasının üzerine yazılmaz; elle girilen değer
        sonraki senkronizasyonda ezilmez.
      </p>
      {entries.length ? (
        <div className="mt-3 overflow-x-auto">
          <table
            aria-label="Elle girilen ölçümler"
            className="w-full text-left text-sm"
          >
            <thead className="text-xs text-muted">
              <tr>
                <th scope="col" className="p-2">
                  Nokta
                </th>
                <th scope="col" className="p-2">
                  İzlenme
                </th>
                <th scope="col" className="p-2">
                  Beğeni · yorum · paylaşım · kayıt
                </th>
                <th scope="col" className="p-2">
                  Ort. izlenme süresi
                </th>
                <th scope="col" className="p-2">
                  Tamamlama
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr className="border-t border-line" key={e.id}>
                  <th scope="row" className="p-2 font-normal">
                    {e.targetHours === null
                      ? formatDateTime(e.capturedAt)
                      : checkpointLabel(e.targetHours)}
                  </th>
                  <td className="p-2">{formatCount(e.views)}</td>
                  <td className="p-2">
                    {formatCount(e.likes)} · {formatCount(e.comments)} ·{' '}
                    {formatCount(e.shares)} · {formatCount(e.saves)}
                  </td>
                  <td className="p-2">
                    {e.avgWatchTimeS === null
                      ? '—'
                      : `${e.avgWatchTimeS.toLocaleString('tr-TR')} sn`}
                  </td>
                  <td className="p-2">{formatPercent(e.completionRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Bu post için elle girilmiş ölçüm yok.
        </p>
      )}
      {canWrite && (
        <form
          aria-label="Elle metrik gir"
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={onSubmit}
        >
          <label className={label}>
            Kontrol noktası
            <select className={field} defaultValue="24" name="targetHours">
              {CHECKPOINT_HOURS.map((h) => (
                <option key={h} value={h}>
                  {checkpointLabel(h)}
                </option>
              ))}
              <option value="">Şimdi (ara ölçüm)</option>
            </select>
          </label>
          {(
            [
              ['views', 'İzlenme'],
              ['likes', 'Beğeni'],
              ['comments', 'Yorum'],
              ['shares', 'Paylaşım'],
            ] as const
          ).map(([name, text]) => (
            <label className={label} key={name}>
              {text}
              <input
                className={field}
                inputMode="numeric"
                min={0}
                name={name}
                required
                step={1}
                type="number"
              />
            </label>
          ))}
          <label className={label}>
            Kaydetme (isteğe bağlı)
            <input
              className={field}
              min={0}
              name="saves"
              step={1}
              type="number"
            />
          </label>
          <label className={label}>
            Erişim (isteğe bağlı)
            <input
              className={field}
              min={0}
              name="reach"
              step={1}
              type="number"
            />
          </label>
          <label className={label}>
            Ort. izlenme süresi, sn (isteğe bağlı)
            <input
              className={field}
              min={0}
              name="avgWatchTimeS"
              step="0.1"
              type="number"
            />
          </label>
          <label className={label}>
            Tamamlama, % (isteğe bağlı)
            <input
              className={field}
              max={100}
              min={0}
              name="completionPercent"
              step="0.1"
              type="number"
            />
          </label>
          <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
            <button
              className="button button-primary"
              disabled={pending}
              type="submit"
            >
              {pending ? 'Kaydediliyor…' : 'Metriği kaydet'}
            </button>
            {message && (
              <p
                aria-live="polite"
                className="text-sm text-muted"
                role="status"
              >
                {message}
              </p>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
