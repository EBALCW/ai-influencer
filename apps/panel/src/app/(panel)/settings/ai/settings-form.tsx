'use client';
import { useEffect, useState } from 'react';
import { DEFAULT_AI_DAILY_LIMIT } from '@/lib/ai/daily-cap';
import { aiSettingsSchema, type AiSettings } from '@/lib/ai/settings-schema';
const fields = [
  ['inputPerMTok', 'Giriş'],
  ['outputPerMTok', 'Çıkış'],
  ['cacheReadPerMTok', 'Önbellek okuma'],
  ['cacheWritePerMTok', 'Önbellek yazma (5 dk)'],
  ['cacheWrite1hPerMTok', 'Önbellek yazma (1 saat)'],
] as const;
const empty: AiSettings = {
  model: '',
  pricing: {
    currency: 'USD',
    inputPerMTok: '',
    outputPerMTok: '',
    cacheReadPerMTok: '',
    cacheWritePerMTok: '',
    cacheWrite1hPerMTok: '',
  },
};
export function AiSettingsForm() {
  const [settings, setSettings] = useState(empty),
    [canEdit, setCanEdit] = useState(false),
    [hasKey, setHasKey] = useState(false),
    [busy, setBusy] = useState(true),
    [message, setMessage] = useState('');
  useEffect(() => {
    let live = true;
    void fetch('/api/ai/settings')
      .then(async (r) => {
        if (!r.ok) throw Error('AI ayarları okunamadı.');
        const d = await r.json();
        if (live) {
          setSettings(d.settings ?? empty);
          setCanEdit(d.canEdit === true);
          setHasKey(d.hasKey === true);
        }
      })
      .catch(() => {
        if (live) setMessage('AI ayarları okunamadı.');
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, []);
  return (
    <section className="section-card space-y-4">
      <p className="text-sm text-muted">
        API anahtarı{' '}
        {hasKey
          ? 'sunucuda tanımlı.'
          : 'sunucuda tanımlı değil; ANTHROPIC_API_KEY gerekir.'}{' '}
        Anahtar bu forma girilmez.
      </p>
      <p className="text-sm text-muted">
        Model ve fiyatları{' '}
        <a
          className="underline"
          href="https://platform.claude.com/docs/en/about-claude/models/overview"
          target="_blank"
          rel="noreferrer"
        >
          resmi model listesi
        </a>{' '}
        ve{' '}
        <a
          className="underline"
          href="https://platform.claude.com/docs/en/about-claude/pricing"
          target="_blank"
          rel="noreferrer"
        >
          fiyat sayfasından
        </a>{' '}
        kontrol edin. Sonraki çağrılar kaydedilen fiyatı kullanır; geçmiş
        maliyetler değişmez.
      </p>
      {message && <p role="status">{message}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const p = aiSettingsSchema.safeParse(settings);
          if (!p.success) {
            setMessage(
              'Model ID ve fiyatları kontrol edin. Fiyat en fazla 4 ondalık içerebilir.',
            );
            return;
          }
          setBusy(true);
          setMessage('');
          void fetch('/api/ai/settings', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(p.data),
          })
            .then(async (r) => {
              if (!r.ok) throw Error('AI ayarları kaydedilemedi.');
              setMessage('AI ayarları kaydedildi.');
            })
            .catch(() => setMessage('AI ayarları kaydedilemedi.'))
            .finally(() => setBusy(false));
        }}
      >
        <fieldset disabled={!canEdit || busy} className="space-y-4">
          <label className="block text-sm text-muted">
            Model ID
            <input
              className="mt-2 w-full rounded-xl border border-line bg-surface p-3 text-text"
              required
              value={settings.model}
              onChange={(e) =>
                setSettings((v) => ({ ...v, model: e.target.value }))
              }
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {fields.map(([key, label]) => (
              <label className="block text-sm text-muted" key={key}>
                {label} (USD / milyon token)
                <input
                  className="mt-2 w-full rounded-xl border border-line bg-surface p-3 text-text"
                  required
                  inputMode="decimal"
                  value={settings.pricing[key]}
                  onChange={(e) =>
                    setSettings((v) => ({
                      ...v,
                      pricing: { ...v.pricing, [key]: e.target.value },
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <label className="block text-sm text-muted">
            Kullanıcı başına günlük AI isteği (UTC günü; boşsa{' '}
            {DEFAULT_AI_DAILY_LIMIT})
            <input
              className="mt-2 w-full rounded-xl border border-line bg-surface p-3 text-text sm:w-48"
              type="number"
              min={1}
              max={10000}
              step={1}
              inputMode="numeric"
              value={settings.dailyLimitPerUser ?? ''}
              onChange={(e) =>
                setSettings((v) => ({
                  ...v,
                  dailyLimitPerUser:
                    e.target.value === '' ? undefined : Number(e.target.value),
                }))
              }
            />
          </label>
          {canEdit && (
            <button className="button button-primary" type="submit">
              AI ayarlarını kaydet
            </button>
          )}
        </fieldset>
      </form>
    </section>
  );
}
