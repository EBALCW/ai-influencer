'use client';

import { useActionState, useMemo, useState } from 'react';
import { Toast } from '@/components/ui';
import { renderTemplate, extractVariables } from '@/lib/prompt-template';
import {
  aspectRatios,
  imageResolutions,
  modeFields,
  modeLabels,
  resolutions,
  testModeLabel,
  videoDurations,
  type GenerationMode,
} from '@/lib/generation-queue';
import { enqueueGeneration } from '../actions';
import { fieldClass, labelClass } from '../prompt-form';

/** Değişkenleri doldurup önizleme; editor için uygun kategorilerde üretime gönderme. */
export function PreviewPanel({
  promptId,
  body,
  negative,
  defaults,
  canGenerate,
  influencers,
  fixedInfluencer,
  defaultInfluencerId,
  mode,
  assets,
  isOwner,
}: {
  promptId: string;
  body: string;
  negative: string;
  defaults: Record<string, string>;
  /** Editor + görsel/video kategorisi. */
  canGenerate: boolean;
  influencers: Array<{ id: string; name: string }>;
  /** Influencer'a özel prompt: üretim sadece o influencer için. */
  fixedInfluencer: { id: string; name: string } | null;
  defaultInfluencerId: string | null;
  /** Kategoriden gelen üretim modu (görsel / görselden video / video-to-video). */
  mode: GenerationMode | null;
  /** Referans olarak seçilebilecek dosyalar (influencer'a göre süzülür). */
  assets: Array<{
    id: string;
    influencerId: string;
    label: string;
    mimeType: string;
  }>;
  isOwner: boolean;
}) {
  const names = useMemo(() => extractVariables(body), [body]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(names.map((name) => [name, defaults[name] ?? ''])),
  );
  const preview = renderTemplate(body, values);
  const [state, action, pending] = useActionState(enqueueGeneration, null);
  const [influencerId, setInfluencerId] = useState(
    fixedInfluencer?.id ?? defaultInfluencerId ?? '',
  );
  const [testMode, setTestMode] = useState(true);
  const choices = assets.filter((asset) => asset.influencerId === influencerId);
  const fields = mode ? modeFields[mode] : null;

  return (
    <form action={action} className="space-y-4" aria-label="Önizleme ve üretim">
      <input name="promptId" type="hidden" value={promptId} />
      {names.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {names.map((name) => (
            <label className={labelClass} key={name}>
              {name}
              <input
                className={fieldClass}
                maxLength={2000}
                name={`value:${name}`}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [name]: event.target.value,
                  }))
                }
                value={values[name] ?? ''}
              />
            </label>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">Bu şablonda değişken yok.</p>
      )}

      <div>
        <h3 className="text-xs font-medium text-muted">Önizleme</h3>
        <pre
          aria-label="Doldurulmuş prompt"
          className="mt-2 whitespace-pre-wrap rounded-lg border border-line bg-canvas p-3 font-mono text-sm text-text"
        >
          {preview.text}
        </pre>
        {negative && (
          <p className="mt-2 text-xs text-muted">
            Negatif: <span className="font-mono">{negative}</span>
          </p>
        )}
        {preview.missing.length > 0 && (
          <p className="mt-2 text-xs text-muted" role="status">
            Eksik değişken: {preview.missing.join(', ')}
          </p>
        )}
      </div>

      {canGenerate && (
        <fieldset className="space-y-3 rounded-lg border border-line p-3">
          <legend className="px-1 text-xs font-medium text-muted">
            Üretim parametreleri
          </legend>
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              checked={testMode}
              name="testMode"
              onChange={(event) => setTestMode(event.target.checked)}
              type="checkbox"
            />
            Test modu ({mode ? testModeLabel[mode] : '480p'}, düşük maliyet)
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            {fields?.image && (
              <>
                <label className={labelClass}>
                  Görsel çözünürlüğü
                  <select
                    className={fieldClass}
                    defaultValue="2K"
                    disabled={testMode}
                    name="imageResolution"
                  >
                    {imageResolutions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  En-boy oranı
                  <select
                    className={fieldClass}
                    defaultValue="9:16"
                    name="aspectRatio"
                  >
                    {aspectRatios.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
            {fields?.resolution && (
              <label className={labelClass}>
                Çözünürlük
                <select
                  className={fieldClass}
                  defaultValue="720p"
                  disabled={testMode}
                  name="resolution"
                >
                  {resolutions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {fields?.duration && (
              <label className={labelClass}>
                Süre (sn)
                <select
                  className={fieldClass}
                  defaultValue="5"
                  disabled={testMode}
                  name="durationSeconds"
                >
                  {videoDurations.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {mode === 'text_to_image' && negative && (
            <p className="text-xs text-muted">
              Görsel modeli negatif prompt ve seed desteklemiyor; negatif metin
              gönderilmez.
            </p>
          )}
          <div>
            <p className="text-xs font-medium text-muted">Referans dosyalar</p>
            {choices.length === 0 ? (
              <p className="mt-1 text-sm text-muted">
                {influencerId
                  ? "Bu influencer'ın kütüphanesinde dosya yok."
                  : 'Dosyaları görmek için influencer seçin.'}
              </p>
            ) : (
              <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                {choices.map((asset) => (
                  <li key={asset.id}>
                    <label className="flex items-center gap-2 text-sm text-text">
                      <input
                        name="inputAssetIds"
                        type="checkbox"
                        value={asset.id}
                      />
                      {asset.label}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {isOwner && (
            <label className="flex items-center gap-2 text-sm text-text">
              <input name="overrideBudget" type="checkbox" />
              Bütçe dolduysa owner olarak onaylıyorum
            </label>
          )}
        </fieldset>
      )}
      {canGenerate && (
        <div className="flex flex-wrap items-end gap-3">
          {fixedInfluencer ? (
            <>
              <input
                name="influencerId"
                type="hidden"
                value={fixedInfluencer.id}
              />
              <p className="text-sm text-muted">
                Üretim: {fixedInfluencer.name}
              </p>
            </>
          ) : (
            <label className={labelClass}>
              Influencer
              <select
                className={fieldClass}
                name="influencerId"
                onChange={(event) => setInfluencerId(event.target.value)}
                required
                value={influencerId}
              >
                <option disabled value="">
                  Seçin
                </option>
                {influencers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode && (
            <p className="text-sm text-muted">Mod: {modeLabels[mode]}</p>
          )}
          <button
            className="button button-primary"
            disabled={pending || preview.missing.length > 0}
            type="submit"
          >
            {pending ? 'Gönderiliyor…' : 'Üretime gönder'}
          </button>
        </div>
      )}
      {state && (
        <Toast message={state.message} tone={state.ok ? 'success' : 'error'} />
      )}
    </form>
  );
}
