'use client';

import { useActionState, useMemo, useState } from 'react';
import type { PromptCategory } from '@ai-influencer/shared';
import { Toast } from '@/components/ui';
import { categoryLabels, promptCategories } from '@/lib/prompt-schemas';
import { extractVariables } from '@/lib/prompt-template';
import { savePromptVersion } from './actions';

export const fieldClass =
  'mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent';
export const labelClass = 'block text-xs font-medium text-muted';

type Lineage = {
  category: PromptCategory;
  key: string;
  influencerId: string | null;
  scopeLabel: string;
};

/**
 * Yeni prompt (lineage yok) veya mevcut soya yeni versiyon (lineage var).
 * Versiyonda kategori, kapsam ve anahtar sabittir; sadece içerik değişir.
 */
export function PromptForm({
  influencers,
  defaultInfluencerId,
  lineage,
  initial,
  inf,
}: {
  influencers: Array<{ id: string; name: string }>;
  defaultInfluencerId?: string | null;
  lineage?: Lineage;
  initial?: {
    title: string;
    body: string;
    negative: string;
    defaults: Record<string, string>;
  };
  inf: string;
}) {
  const [state, action, pending] = useActionState(savePromptVersion, null);
  const [body, setBody] = useState(initial?.body ?? '');
  const variables = useMemo(() => extractVariables(body), [body]);

  return (
    <form
      action={action}
      className="space-y-4"
      aria-label={lineage ? 'Yeni versiyon' : 'Yeni prompt'}
    >
      <input name="inf" type="hidden" value={inf} />
      <input name="mode" type="hidden" value={lineage ? 'version' : 'new'} />
      {lineage && (
        <>
          <input name="category" type="hidden" value={lineage.category} />
          <input name="key" type="hidden" value={lineage.key} />
          <input
            name="influencerId"
            type="hidden"
            value={lineage.influencerId ?? ''}
          />
        </>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Başlık
          <input
            className={fieldClass}
            defaultValue={initial?.title ?? ''}
            maxLength={120}
            name="title"
            required
          />
        </label>
        {lineage ? (
          <p className={labelClass}>
            Kategori ve kapsam
            <span className="mt-2 block text-sm text-text">
              {categoryLabels[lineage.category]} · {lineage.scopeLabel}
            </span>
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Kategori
              <select
                className={fieldClass}
                defaultValue="character"
                name="category"
              >
                {promptCategories.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Kapsam
              <select
                className={fieldClass}
                defaultValue={defaultInfluencerId ?? ''}
                name="influencerId"
              >
                <option value="">Global (tüm influencer’lar)</option>
                {influencers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>

      <label className={labelClass}>
        Prompt metni
        <span className="ml-2 font-normal text-subtle">
          Değişken: {'{{degisken}}'} · düz süslü parantez: {'\\{{'}
        </span>
        <textarea
          className={`${fieldClass} min-h-40 font-mono`}
          maxLength={8000}
          name="body"
          onChange={(event) => setBody(event.target.value)}
          required
          value={body}
        />
      </label>

      <label className={labelClass}>
        Negatif prompt
        <textarea
          className={`${fieldClass} min-h-20 font-mono`}
          defaultValue={initial?.negative ?? ''}
          maxLength={4000}
          name="negative"
        />
      </label>

      {variables.length > 0 && (
        <fieldset className="space-y-3">
          <legend className={labelClass}>
            Değişkenlerin varsayılan değerleri (isteğe bağlı)
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {variables.map((name) => (
              <label className={labelClass} key={name}>
                {name}
                <input
                  className={fieldClass}
                  defaultValue={initial?.defaults[name] ?? ''}
                  maxLength={500}
                  name={`default:${name}`}
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {lineage && (
        <label className={labelClass}>
          Değişiklik notu
          <input
            className={fieldClass}
            maxLength={500}
            name="changeNote"
            placeholder="Bu versiyonda ne değişti?"
          />
        </label>
      )}

      {state && !state.ok && <Toast message={state.message} tone="error" />}
      <button
        className="button button-primary"
        disabled={pending}
        type="submit"
      >
        {pending
          ? 'Kaydediliyor…'
          : lineage
            ? 'Yeni versiyonu kaydet'
            : "Prompt'u kaydet"}
      </button>
    </form>
  );
}
