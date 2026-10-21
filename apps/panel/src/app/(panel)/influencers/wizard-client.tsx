'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import {
  appearanceFields,
  parseCaptionList,
  parseTagList,
  toPersonaInput,
  type AppearanceKey,
  type PersonaInput,
} from '@/lib/persona';
import {
  buildCharacterPrompt,
  influencerDraftSchema,
  slugifyInfluencerName,
  wizardPersonaSchema,
} from '@/lib/influencer-wizard';

type Draft = {
  id: string;
  name: string;
  slug: string;
  niche: string | null;
  language: string;
  persona: PersonaInput | null;
  promptBody: string | null;
  referenceCount: number;
  avatarAssetId: string | null;
};

const inputClass =
  'mt-2 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm text-text outline-none focus:border-accent';
const labelClass = 'block text-sm font-medium text-muted';

async function responseError(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return body?.error ?? 'İşlem tamamlanamadı.';
}

export function InfluencerWizard({
  initial,
  initialStep = 1,
}: {
  initial: Draft | null;
  initialStep?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedSlug = searchParams.get('inf') ?? '';
  const infParam = selectedSlug
    ? `&inf=${encodeURIComponent(selectedSlug)}`
    : '';
  const [step, setStep] = useState(Math.min(6, Math.max(1, initialStep)));
  const [draft, setDraft] = useState(initial);
  const [name, setName] = useState(initial?.name ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(Boolean(initial?.slug));
  const [niche, setNiche] = useState(initial?.niche ?? '');
  const [language, setLanguage] = useState(initial?.language ?? 'tr');
  const [persona, setPersona] = useState<PersonaInput>(
    () => initial?.persona ?? toPersonaInput(null),
  );
  const [savedPersona, setSavedPersona] = useState<PersonaInput | null>(
    initial?.persona ?? null,
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  const updateStep = (next: number) => {
    setStep(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('step', String(next));
    router.replace(`${window.location.pathname}?${params.toString()}`, {
      scroll: false,
    });
  };

  const updatePersona = (key: keyof PersonaInput, value: string) => {
    if (key === 'sampleCaptions') {
      setPersona((current) => ({ ...current, sampleCaptions: parseCaptionList(value) }));
    } else if (key === 'bio' || key === 'tone' || key === 'changeNote') {
      setPersona((current) => ({ ...current, [key]: value }));
    }
  };

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    const parsed = influencerDraftSchema.safeParse({
      name,
      slug,
      niche,
      language,
    });
    if (!parsed.success) {
      setMessage(
        parsed.error.issues[0]?.message ?? 'Temel bilgileri kontrol edin.',
      );
      setPending(false);
      return;
    }
    const response = draft
      ? await fetch(`/api/influencers/${draft.id}/draft`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(parsed.data),
        })
      : await fetch('/api/influencers', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(parsed.data),
        });
    if (!response.ok) {
      setMessage(await responseError(response));
      setPending(false);
      return;
    }
    const result = (await response.json()) as {
      influencer: { id: string; slug: string };
    };
    const nextDraft = {
      ...parsed.data,
      ...result.influencer,
      persona,
      promptBody: draft?.promptBody ?? null,
      referenceCount: draft?.referenceCount ?? 0,
      avatarAssetId: draft?.avatarAssetId ?? null,
    };
    setDraft(nextDraft);
    setPending(false);
    router.push(
      `/influencers/${encodeURIComponent(result.influencer.slug)}/setup?step=2${infParam}`,
    );
    router.refresh();
  }

  async function savePersona(nextStep: number) {
    if (!draft) return;
    const parsed = wizardPersonaSchema.safeParse(persona);
    if (!parsed.success) {
      setMessage(
        parsed.error.issues[0]?.message ?? 'Persona bilgilerini kontrol edin.',
      );
      return false;
    }
    const unchanged =
      savedPersona &&
      JSON.stringify({ ...parsed.data, changeNote: '' }) ===
        JSON.stringify({ ...savedPersona, changeNote: '' });
    if (!unchanged) {
      const response = await fetch(
        `/api/influencers/${draft.id}/wizard-persona`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(parsed.data),
        },
      );
      if (!response.ok) {
        setMessage(await responseError(response));
        return false;
      }
      const saved = { ...parsed.data, changeNote: '' };
      setSavedPersona(saved);
      setPersona(saved);
    }
    updateStep(nextStep);
    return true;
  }

  async function finish() {
    if (!draft) return;
    setPending(true);
    setMessage('');
    const parsed = wizardPersonaSchema.safeParse(persona);
    if (!parsed.success) {
      setMessage(
        parsed.error.issues[0]?.message ?? 'Görünüm bilgilerini kontrol edin.',
      );
      setPending(false);
      return;
    }
    const prompt = buildCharacterPrompt(name, parsed.data);
    const personaUnchanged =
      savedPersona &&
      JSON.stringify({ ...parsed.data, changeNote: '' }) ===
        JSON.stringify({ ...savedPersona, changeNote: '' });
    if (!personaUnchanged) {
      const response = await fetch(
        `/api/influencers/${draft.id}/wizard-persona`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(parsed.data),
        },
      );
      if (!response.ok) {
        setMessage(await responseError(response));
        setPending(false);
        return;
      }
      const saved = { ...parsed.data, changeNote: '' };
      setSavedPersona(saved);
      setPersona(saved);
    }
    if (prompt !== draft.promptBody) {
      const response = await fetch(
        `/api/influencers/${draft.id}/character-prompt`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            body: prompt,
            variables: parsed.data.appearance,
          }),
        },
      );
      if (!response.ok) {
        setMessage(await responseError(response));
        setPending(false);
        return;
      }
      setDraft({ ...draft, promptBody: prompt });
    }
    setDraft((current) =>
      current ? { ...current, promptBody: prompt } : current,
    );
    setPending(false);
    updateStep(4);
  }

  async function completeDraft() {
    if (!draft) return;
    setPending(true);
    setMessage('');
    const response = await fetch(
      `/api/influencers/${draft.id}/complete-wizard`,
      { method: 'POST' },
    );
    if (!response.ok) {
      setMessage(await responseError(response));
      setPending(false);
      return;
    }
    setPending(false);
    router.push(
      `/influencers/${encodeURIComponent(draft.slug)}?inf=${encodeURIComponent(draft.slug)}`,
    );
    router.refresh();
  }

  const setAppearance = (key: AppearanceKey, value: string) =>
    setPersona((current) => ({
      ...current,
      appearance: { ...current.appearance, [key]: value },
    }));
  const setAudience = (key: keyof PersonaInput['audience'], value: string) => {
    if (key === 'interests') {
      setPersona((current) => ({
        ...current,
        audience: { ...current.audience, interests: parseTagList(value) },
      }));
    } else {
      setPersona((current) => ({
        ...current,
        audience: { ...current.audience, [key]: value },
      }));
    }
  };
  const setTags = (key: 'adjectives' | 'hookTraits', value: string) =>
    setPersona((current) => ({ ...current, [key]: parseTagList(value) }));

  return (
    <div className="page-stack max-w-4xl">
      <header className="page-heading">
        <div>
          <p className="eyebrow">INFLUENCER STUDIO</p>
          <h1>Yeni influencer oluştur</h1>
          <p>
            Altı adımda karakter taslağını oluştur. İlerlemeniz her adımda
            kaydedilir.
          </p>
        </div>
        {draft && <span className="soft-badge">Taslak · {draft.slug}</span>}
      </header>

      <ol
        aria-label="Influencer oluşturma adımları"
        className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6"
      >
        {['Temel', 'Persona', 'Görünüm', 'Referans', 'Avatar', 'Özet'].map(
          (title, index) => (
            <li
              key={title}
              className={`rounded-xl border px-4 py-3 text-sm ${step === index + 1 ? 'border-accent bg-surface-raised text-text' : 'border-line bg-surface text-muted'}`}
            >
              <span className="mr-2 font-semibold">{index + 1}.</span>
              {title}
            </li>
          ),
        )}
      </ol>

      {message && (
        <p
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-text"
        >
          {message}
        </p>
      )}

      {step === 1 && (
        <form className="section-card space-y-5" onSubmit={saveProfile}>
          <div>
            <h2 className="text-lg font-semibold">Temel bilgiler</h2>
            <p className="mt-1 text-sm text-muted">
              Taslak hemen oluşturulur; daha sonra kaldığınız yerden devam
              edebilirsiniz.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Karakter adı
              <input
                autoComplete="off"
                className={inputClass}
                maxLength={80}
                onChange={(event) => {
                  const value = event.target.value;
                  setName(value);
                  if (!slugEdited) setSlug(slugifyInfluencerName(value));
                }}
                required
                value={name}
              />
            </label>
            <label className={labelClass}>
              URL slug
              <input
                autoComplete="off"
                className={inputClass}
                maxLength={60}
                onChange={(event) => {
                  setSlug(event.target.value);
                  setSlugEdited(true);
                }}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                required
                value={slug}
              />
              <span className="mt-1 block text-xs">
                Küçük harf, rakam ve tire kullanın.
              </span>
            </label>
            <label className={labelClass}>
              Niş
              <input
                className={inputClass}
                maxLength={100}
                onChange={(event) => setNiche(event.target.value)}
                placeholder="Moda, teknoloji…"
                value={niche}
              />
            </label>
            <label className={labelClass}>
              Dil kodu
              <input
                className={inputClass}
                maxLength={8}
                onChange={(event) => setLanguage(event.target.value)}
                placeholder="tr"
                required
                value={language}
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              className="button button-primary"
              disabled={pending}
              type="submit"
            >
              {pending ? 'Kaydediliyor…' : 'Kaydet ve devam et'}
            </button>
          </div>
        </form>
      )}

      {step === 2 && (
        <form
          className="section-card space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            setPending(true);
            setMessage('');
            void savePersona(3).finally(() => setPending(false));
          }}
        >
          <div>
            <h2 className="text-lg font-semibold">Persona ve hedef kitle</h2>
            <p className="mt-1 text-sm text-muted">
              Bu bilgiler persona v1 olarak kaydedilir.
            </p>
          </div>
          <label className={labelClass}>
            Karakter hikâyesi
            <textarea
              className={inputClass}
              maxLength={5000}
              onChange={(event) => updatePersona('bio', event.target.value)}
              required
              rows={4}
              value={persona.bio}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Kişilik sıfatları
              <input
                className={inputClass}
                onChange={(event) => setTags('adjectives', event.target.value)}
                placeholder="meraklı, enerjik"
                value={persona.adjectives.join(', ')}
              />
            </label>
            <label className={labelClass}>
              Ses tonu
              <input
                className={inputClass}
                maxLength={200}
                onChange={(event) => updatePersona('tone', event.target.value)}
                required
                value={persona.tone}
              />
            </label>
            <label className={labelClass}>
              Hedef yaş aralığı
              <input
                className={inputClass}
                maxLength={40}
                onChange={(event) =>
                  setAudience('ageRange', event.target.value)
                }
                placeholder="18–30"
                value={persona.audience.ageRange}
              />
            </label>
            <label className={labelClass}>
              İlgi alanları
              <input
                className={inputClass}
                onChange={(event) =>
                  setAudience('interests', event.target.value)
                }
                placeholder="moda, seyahat"
                value={persona.audience.interests.join(', ')}
              />
            </label>
          </div>
          <label className={labelClass}>
            Hedef kitle açıklaması
            <textarea
              className={inputClass}
              maxLength={1000}
              onChange={(event) =>
                setAudience('description', event.target.value)
              }
              required
              rows={3}
              value={persona.audience.description}
            />
          </label>
          <label className={labelClass}>
            İmza/kanca özellikleri
            <input
              className={inputClass}
              onChange={(event) => setTags('hookTraits', event.target.value)}
              placeholder="kırmızı gözlük, kısa mizahi yorum"
              value={persona.hookTraits.join(', ')}
            />
          </label>
          <label className={labelClass}>
            Örnek caption’lar (her satıra bir tane)
            <textarea
              className={inputClass}
              maxLength={22000}
              onChange={(event) => updatePersona('sampleCaptions', event.target.value)}
              placeholder={"Bugün küçük bir kaçamak yaptım…\nSence bu kombin nasıl olmuş?"}
              rows={4}
              value={persona.sampleCaptions.join('\n')}
            />
            <span className="mt-1 block text-xs">
              En fazla 10 örnek; her biri en fazla 2.200 karakter.
            </span>
          </label>
          <div className="flex justify-between">
            <button
              className="button"
              onClick={() => updateStep(1)}
              type="button"
            >
              Geri
            </button>
            <button
              className="button button-primary"
              disabled={pending}
              type="submit"
            >
              {pending ? 'Kaydediliyor…' : 'Kaydet ve devam et'}
            </button>
          </div>
        </form>
      )}

      {step === 3 && (
        <section className="section-card space-y-5">
          <div>
            <h2 className="text-lg font-semibold">
              Görünüm ve karakter prompt’u
            </h2>
            <p className="mt-1 text-sm text-muted">
              Görünüm alanları persona ile birlikte versiyonlanır. Prompt
              önizlemesi girdiğiniz alanlardan oluşturulur.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {appearanceFields.map(([key, label]) => (
              <label className={labelClass} key={key}>
                {label}
                <input
                  className={inputClass}
                  maxLength={200}
                  onChange={(event) => setAppearance(key, event.target.value)}
                  value={persona.appearance[key]}
                />
              </label>
            ))}
          </div>
          <div className="rounded-xl border border-line bg-surface-raised p-4">
            <h3 className="text-sm font-semibold">Prompt önizlemesi</h3>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-muted">
              {buildCharacterPrompt(name, persona)}
            </pre>
          </div>
          <div className="flex justify-between">
            <button
              className="button"
              onClick={() => updateStep(2)}
              type="button"
            >
              Geri
            </button>
            <button
              className="button button-primary"
              disabled={pending}
              onClick={() => void finish()}
              type="button"
            >
              {pending ? 'Kaydediliyor…' : 'Prompt’u kaydet ve devam et'}
            </button>
          </div>
        </section>
      )}
      {step === 4 && draft && (
        <section className="section-card space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Referans görselleri</h2>
            <p className="mt-1 text-sm text-muted">
              Görselleri medya kütüphanesine yükleyin. Görsel başına bir
              referans sürümü (v1, v2…) atanır.
            </p>
          </div>
          <p className="soft-badge" role="status">
            {draft.referenceCount} referans yüklendi
          </p>
          <a
            className="button button-primary"
            href={`/influencers/${encodeURIComponent(draft.slug)}/assets?wizard=4`}
          >
            Medya kütüphanesinde yükle
          </a>
          <div className="flex justify-between">
            <button
              className="button"
              onClick={() => updateStep(3)}
              type="button"
            >
              Geri
            </button>
            <button
              className="button button-primary"
              disabled={draft.referenceCount === 0}
              onClick={() => updateStep(5)}
              type="button"
            >
              Avatar seçimine devam et
            </button>
          </div>
          {draft.referenceCount === 0 && (
            <p className="text-sm text-muted">
              Devam etmek için en az bir referans görsel yükleyin.
            </p>
          )}
        </section>
      )}

      {step === 5 && draft && (
        <section className="section-card space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Referans setini seçin</h2>
            <p className="mt-1 text-sm text-muted">
              Medya kütüphanesinde sürümleri karşılaştırın ve bir görseli
              influencer avatarı olarak belirleyin.
            </p>
          </div>
          <p className="soft-badge" role="status">
            {draft.avatarAssetId
              ? 'Avatar belirlendi'
              : 'Avatar henüz seçilmedi'}
          </p>
          <a
            className="button button-primary"
            href={`/influencers/${encodeURIComponent(draft.slug)}/assets?wizard=5`}
          >
            Seti karşılaştır ve avatarı belirle
          </a>
          <div className="flex justify-between">
            <button
              className="button"
              onClick={() => updateStep(4)}
              type="button"
            >
              Geri
            </button>
            <button
              className="button button-primary"
              disabled={!draft.avatarAssetId}
              onClick={() => updateStep(6)}
              type="button"
            >
              Özeti gör
            </button>
          </div>
          {!draft.avatarAssetId && (
            <p className="text-sm text-muted">
              Devam etmeden önce medya kütüphanesinde bir avatar seçin.
            </p>
          )}
        </section>
      )}

      {step === 6 && draft && (
        <section className="section-card space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Taslak özeti</h2>
            <p className="mt-1 text-sm text-muted">
              Kontrol edin ve influencer taslağını tamamlayın.
            </p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-muted">Ad</dt>
              <dd>{draft.name}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Slug</dt>
              <dd>{draft.slug}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Niş</dt>
              <dd>{draft.niche || 'Belirtilmedi'}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Dil</dt>
              <dd>{draft.language}</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Referans</dt>
              <dd>{draft.referenceCount} görsel</dd>
            </div>
            <div>
              <dt className="text-sm text-muted">Avatar</dt>
              <dd>{draft.avatarAssetId ? 'Seçildi' : 'Seçilmedi'}</dd>
            </div>
          </dl>
          <div className="rounded-xl border border-line bg-surface-raised p-4">
            <h3 className="text-sm font-semibold">Karakter prompt’u</h3>
            <pre className="mt-3 whitespace-pre-wrap font-sans text-sm text-muted">
              {draft.promptBody}
            </pre>
          </div>
          <div className="flex justify-between">
            <button
              className="button"
              onClick={() => updateStep(5)}
              type="button"
            >
              Geri
            </button>
            <button
              className="button button-primary"
              disabled={
                pending || draft.referenceCount === 0 || !draft.avatarAssetId
              }
              onClick={() => void completeDraft()}
              type="button"
            >
              {pending ? 'Kaydediliyor…' : 'Taslağı tamamla'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
