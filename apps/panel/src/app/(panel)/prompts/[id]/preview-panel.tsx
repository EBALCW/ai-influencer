'use client';

import { useActionState, useMemo, useState } from 'react';
import { Toast } from '@/components/ui';
import { renderTemplate, extractVariables } from '@/lib/prompt-template';
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
}) {
  const names = useMemo(() => extractVariables(body), [body]);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(names.map((name) => [name, defaults[name] ?? ''])),
  );
  const preview = renderTemplate(body, values);
  const [state, action, pending] = useActionState(enqueueGeneration, null);

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
                defaultValue={defaultInfluencerId ?? ''}
                name="influencerId"
                required
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
