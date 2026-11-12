'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  analyticsSettingsSchema,
  type AnalyticsSettings,
} from '@/lib/analytics/performance';

const field =
  'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text';

/** "Takıldı" / "patladı" eşikleri (#25). Yalnız owner'a gösterilir; API de owner ister. */
export function PerformanceSettingsForm({
  settings,
}: {
  settings: AnalyticsSettings;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const parsed = analyticsSettingsSchema.safeParse({
      stuckViews: Number(data.get('stuckViews')),
      stuckWithinHours: Number(data.get('stuckWithinHours')),
      viralMultiplier: Number(
        String(data.get('viralMultiplier')).replace(',', '.'),
      ),
      baselinePosts: Number(data.get('baselinePosts')),
    });
    if (!parsed.success) {
      setMessage(
        'Değerleri kontrol edin: izlenme eşiği tam sayı, çarpan 1,1–100, kıyas 3–50 post.',
      );
      return;
    }
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/analytics/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) throw new Error('Eşikler kaydedilemedi.');
      setMessage('Eşikler kaydedildi.');
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Eşikler kaydedilemedi.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      aria-label="Eşikleri düzenle"
      className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
      onSubmit={onSubmit}
    >
      <label className="block text-xs font-medium text-muted">
        Takıldı eşiği (izlenme)
        <input
          className={field}
          defaultValue={settings.stuckViews}
          inputMode="numeric"
          min={1}
          name="stuckViews"
          required
          step={1}
          type="number"
        />
      </label>
      <label className="block text-xs font-medium text-muted">
        İlk dalga penceresi
        <select
          className={field}
          defaultValue={settings.stuckWithinHours}
          name="stuckWithinHours"
        >
          <option value={1}>İlk 1 saat</option>
          <option value={5}>İlk 5 saat</option>
        </select>
      </label>
      <label className="block text-xs font-medium text-muted">
        Patladı çarpanı (× medyan)
        <input
          className={field}
          defaultValue={settings.viralMultiplier}
          inputMode="decimal"
          name="viralMultiplier"
          required
        />
      </label>
      <label className="block text-xs font-medium text-muted">
        Kıyas grubu (son N post)
        <input
          className={field}
          defaultValue={settings.baselinePosts}
          inputMode="numeric"
          max={50}
          min={3}
          name="baselinePosts"
          required
          step={1}
          type="number"
        />
      </label>
      <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-4">
        <button
          className="button button-primary"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Kaydediliyor…' : 'Eşikleri kaydet'}
        </button>
        {message && (
          <p aria-live="polite" className="text-sm text-muted" role="status">
            {message}
          </p>
        )}
      </div>
    </form>
  );
}
