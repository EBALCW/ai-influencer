'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConfirmDialog, Toast } from '@/components/ui';
import {
  appearanceFields,
  parseCaptionList,
  parseTagList,
  type AppearanceKey,
  type PersonaInput,
} from '@/lib/persona';

const inputClass =
  'mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-text outline-none focus:border-accent';
const labelClass = 'block text-xs font-medium text-muted';

type Message = { tone: 'success' | 'error'; text: string } | null;

async function errorText(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? 'İşlem tamamlanamadı.';
}

export function PersonaEditor({
  influencerId,
  initial,
}: {
  influencerId: string;
  initial: PersonaInput;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [values, setValues] = useState(() => ({
    bio: initial.bio,
    tone: initial.tone,
    adjectives: initial.adjectives.join(', '),
    hookTraits: initial.hookTraits.join(', '),
    sampleCaptions: initial.sampleCaptions.join('\n'),
    ageRange: initial.audience.ageRange,
    interests: initial.audience.interests.join(', '),
    audienceDescription: initial.audience.description,
    appearance: { ...initial.appearance },
    changeNote: '',
  }));

  const set = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
  const setAppearance = (key: AppearanceKey, value: string) =>
    setValues((current) => ({
      ...current,
      appearance: { ...current.appearance, [key]: value },
    }));

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    const payload: PersonaInput = {
      bio: values.bio,
      tone: values.tone,
      adjectives: parseTagList(values.adjectives),
      hookTraits: parseTagList(values.hookTraits),
      sampleCaptions: parseCaptionList(values.sampleCaptions),
      audience: {
        ageRange: values.ageRange,
        interests: parseTagList(values.interests),
        description: values.audienceDescription,
      },
      appearance: values.appearance,
      changeNote: values.changeNote,
    };
    const response = await fetch(`/api/influencers/${influencerId}/persona`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!response.ok) {
      setMessage({ tone: 'error', text: await errorText(response) });
      return;
    }
    const { version } = (await response.json()) as { version: number };
    setMessage({ tone: 'success', text: `v${version} kaydedildi.` });
    setValues((current) => ({ ...current, changeNote: '' }));
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {message && (
        <Toast
          message={message.text}
          tone={message.tone}
          onDismiss={() => setMessage(null)}
        />
      )}
      {!open ? (
        <button
          className="button button-primary"
          onClick={() => setOpen(true)}
          type="button"
        >
          Personayı düzenle
        </button>
      ) : (
        <form
          aria-label="Persona düzenleme formu"
          className="space-y-4 rounded-2xl border border-line bg-surface-raised p-4"
          onSubmit={save}
        >
          <label className={labelClass}>
            Biyografi / hikaye
            <textarea
              className={`${inputClass} min-h-28`}
              maxLength={5000}
              onChange={(event) => set('bio', event.target.value)}
              value={values.bio}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Ses tonu
              <input
                className={inputClass}
                maxLength={200}
                onChange={(event) => set('tone', event.target.value)}
                value={values.tone}
              />
            </label>
            <label className={labelClass}>
              Kişilik sıfatları (virgülle)
              <input
                className={inputClass}
                onChange={(event) => set('adjectives', event.target.value)}
                value={values.adjectives}
              />
            </label>
            <label className={labelClass}>
              Kanca özellikleri (virgülle)
              <input
                className={inputClass}
                onChange={(event) => set('hookTraits', event.target.value)}
                value={values.hookTraits}
              />
            </label>
            <label className={labelClass}>
              Hedef kitle yaş aralığı
              <input
                className={inputClass}
                maxLength={40}
                onChange={(event) => set('ageRange', event.target.value)}
                value={values.ageRange}
              />
            </label>
            <label className={labelClass}>
              İlgi alanları (virgülle)
              <input
                className={inputClass}
                onChange={(event) => set('interests', event.target.value)}
                value={values.interests}
              />
            </label>
            <label className={labelClass}>
              Hedef kitle açıklaması
              <input
                className={inputClass}
                maxLength={1000}
                onChange={(event) =>
                  set('audienceDescription', event.target.value)
                }
                value={values.audienceDescription}
              />
            </label>
          </div>
          <label className={labelClass}>
            Örnek caption’lar (her satıra bir tane)
            <textarea
              className={`${inputClass} min-h-28`}
              maxLength={22000}
              onChange={(event) => set('sampleCaptions', event.target.value)}
              rows={4}
              value={values.sampleCaptions}
            />
            <span className="mt-1 block text-xs">
              En fazla 10 örnek; her biri en fazla 2.200 karakter.
            </span>
          </label>
          <fieldset className="grid gap-4 sm:grid-cols-3">
            <legend className="mb-2 text-sm font-semibold text-text">
              Görünüm
            </legend>
            {appearanceFields.map(([key, label]) => (
              <label className={labelClass} key={key}>
                {label}
                <input
                  className={inputClass}
                  maxLength={200}
                  onChange={(event) => setAppearance(key, event.target.value)}
                  value={values.appearance[key]}
                />
              </label>
            ))}
          </fieldset>
          <label className={labelClass}>
            Değişiklik notu
            <input
              className={inputClass}
              maxLength={500}
              onChange={(event) => set('changeNote', event.target.value)}
              placeholder="Ör. Ton daha esprili yapıldı"
              value={values.changeNote}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              className="button button-primary"
              disabled={saving}
              type="submit"
            >
              {saving ? 'Kaydediliyor…' : 'Yeni versiyon olarak kaydet'}
            </button>
            <button
              className="button button-quiet"
              onClick={() => setOpen(false)}
              type="button"
            >
              Vazgeç
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function RestoreVersionButton({
  influencerId,
  version,
}: {
  influencerId: string;
  version: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  async function restore() {
    setConfirming(false);
    setError('');
    const response = await fetch(
      `/api/influencers/${influencerId}/persona/restore`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ version }),
      },
    );
    if (!response.ok) {
      setError(await errorText(response));
      return;
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        aria-label={`v${version} versiyonunu geri al`}
        className="button button-quiet"
        onClick={() => setConfirming(true)}
        type="button"
      >
        Geri al
      </button>
      {error && (
        <span className="text-xs text-accent-strong" role="alert">
          {error}
        </span>
      )}
      <ConfirmDialog
        open={confirming}
        title={`v${version} geri alınsın mı?`}
        description={`v${version} içeriğiyle yeni bir versiyon oluşturulur. Mevcut geçmiş silinmez.`}
        confirmLabel="Geri al"
        onCancel={() => setConfirming(false)}
        onConfirm={restore}
      />
    </span>
  );
}
