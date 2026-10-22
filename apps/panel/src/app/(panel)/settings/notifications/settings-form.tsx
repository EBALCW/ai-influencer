'use client';

import { useEffect, useState } from 'react';
import {
  defaultNotificationSettings,
  notificationSettingsSchema,
  parseMilestones,
  type NotificationSettings,
} from '@/lib/alerts/settings-schema';

const channels = [
  ['ntfy', 'ntfy', 'notify_ntfy_url (ops. notify_ntfy_token)'],
  [
    'telegram',
    'Telegram',
    'notify_telegram_bot_token, notify_telegram_chat_id',
  ],
  [
    'email',
    'E-posta (Resend)',
    'notify_resend_api_key, notify_email_from, notify_email_to',
  ],
] as const;

const inputClass =
  'mt-2 w-full rounded-xl border border-line bg-surface p-3 text-text';

export function NotificationSettingsForm() {
  const [settings, setSettings] = useState<NotificationSettings>(
    defaultNotificationSettings,
  );
  const [multiplier, setMultiplier] = useState('3');
  const [milestones, setMilestones] = useState('');
  const [days, setDays] = useState('7');
  const [canEdit, setCanEdit] = useState(false);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let live = true;
    void fetch('/api/notification-settings', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('read');
        const data = (await response.json()) as {
          settings: NotificationSettings;
          canEdit: boolean;
        };
        if (!live) return;
        setSettings(data.settings);
        setMultiplier(String(data.settings.viralMultiplier));
        setMilestones(data.settings.followerMilestones.join(', '));
        setDays(String(data.settings.tokenExpiryDays));
        setCanEdit(data.canEdit === true);
      })
      .catch(() => {
        if (live) setMessage('Bildirim ayarları okunamadı.');
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = notificationSettingsSchema.safeParse({
      viralMultiplier: Number(multiplier.replace(',', '.')),
      followerMilestones: parseMilestones(milestones) ?? [],
      tokenExpiryDays: Number(days),
      channels: settings.channels,
    });
    if (!parsed.success) {
      setMessage(
        'Değerleri kontrol edin: çarpan 1,5–100, gün 1–60, en fazla 20 pozitif kilometre taşı.',
      );
      return;
    }
    setBusy(true);
    setMessage('');
    void fetch('/api/notification-settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed.data),
    })
      .then((response) => {
        if (!response.ok) throw new Error('save');
        setMilestones(parsed.data.followerMilestones.join(', '));
        setMessage('Bildirim ayarları kaydedildi.');
      })
      .catch(() => setMessage('Bildirim ayarları kaydedilemedi.'))
      .finally(() => setBusy(false));
  }

  return (
    <section className="section-card space-y-4">
      {message && <p role="status">{message}</p>}
      <form aria-label="Bildirim ayarları" onSubmit={submit}>
        <fieldset className="space-y-4" disabled={!canEdit || busy}>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm text-muted">
              Viral eşik (hesabın ilk saat ortalamasının katı)
              <input
                className={inputClass}
                inputMode="decimal"
                onChange={(event) => setMultiplier(event.target.value)}
                required
                value={multiplier}
              />
            </label>
            <label className="block text-sm text-muted">
              Token süresi uyarısı (gün önce)
              <input
                className={inputClass}
                inputMode="numeric"
                onChange={(event) => setDays(event.target.value)}
                required
                value={days}
              />
            </label>
            <label className="block text-sm text-muted">
              Takipçi kilometre taşları (virgülle)
              <input
                className={inputClass}
                onChange={(event) => setMilestones(event.target.value)}
                required
                value={milestones}
              />
            </label>
          </div>
          <p className="text-sm text-muted">
            Bütçe uyarısı her bütçenin kendi uyarı oranıyla (varsayılan %80)
            çalışır; oranı Maliyetler sayfasında bütçeyi tanımlarken belirleyin.
          </p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-text">
              Push kanalları (opsiyonel)
            </legend>
            <p className="text-sm text-muted">
              Adres ve token&apos;lar bu forma girilmez; Supabase Vault&apos;ta
              aşağıdaki adlarla tutulur. Sırrı tanımlı olmayan kanal atlanır,
              kanal hatası uyarı üretimini durdurmaz.
            </p>
            {channels.map(([key, label, secrets]) => (
              <label
                className="flex items-start gap-2 text-sm text-text"
                key={key}
              >
                <input
                  checked={settings.channels[key]}
                  className="mt-1"
                  onChange={(event) =>
                    setSettings((value) => ({
                      ...value,
                      channels: {
                        ...value.channels,
                        [key]: event.target.checked,
                      },
                    }))
                  }
                  type="checkbox"
                />
                <span>
                  {label}
                  <small className="block text-muted">Vault: {secrets}</small>
                </span>
              </label>
            ))}
          </fieldset>
          {canEdit && (
            <button className="button button-primary" type="submit">
              Bildirim ayarlarını kaydet
            </button>
          )}
        </fieldset>
      </form>
    </section>
  );
}
