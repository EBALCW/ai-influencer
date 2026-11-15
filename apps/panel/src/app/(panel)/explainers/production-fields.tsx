'use client';

import {
  VISUAL_ROUTES,
  VISUAL_ROUTE_CAPABILITY,
  VISUAL_ROUTE_LABELS,
} from '@ai-influencer/shared';
import { field, hint, label } from './format';
import {
  CAPTION_MODES,
  VOICES,
  type ProductionValues,
} from './production-values';

/**
 * Görsel yol, stil, ses ve altyazı alanları. Seride varsayılandır; bölümde `inherit` verilirse
 * boş değer "seriden gelir" demektir ve o varsayılan gösterilir.
 */
export function ProductionFields({
  values,
  onChange,
  inherit,
}: {
  values: ProductionValues;
  onChange: (values: ProductionValues) => void;
  inherit?: Partial<ProductionValues>;
}) {
  const set = (name: keyof ProductionValues) => (value: string) =>
    onChange({ ...values, [name]: value });
  const fallback = (
    name: keyof ProductionValues,
    labels?: Record<string, string>,
  ) => {
    if (!inherit) return 'Seçilmedi';
    const value = inherit[name];
    return value ? `Seriden: ${labels?.[value] ?? value}` : 'Seride seçilmemiş';
  };
  return (
    <>
      <label className={label}>
        Görsel yol
        <select
          className={field}
          onChange={(event) => set('visual_route')(event.target.value)}
          value={values.visual_route}
        >
          <option value="">
            {fallback('visual_route', VISUAL_ROUTE_LABELS)}
          </option>
          {VISUAL_ROUTES.map((route) => (
            <option
              disabled={
                VISUAL_ROUTE_CAPABILITY[route] === null &&
                values.visual_route !== route
              }
              key={route}
              value={route}
            >
              {VISUAL_ROUTE_LABELS[route]}
              {VISUAL_ROUTE_CAPABILITY[route] === null ? ' (yakında)' : ''}
            </option>
          ))}
        </select>
        <span className={hint}>Videonun nasıl çizileceği.</span>
      </label>
      <label className={label}>
        Görsel stil anahtarı (isteğe bağlı)
        <input
          className={field}
          maxLength={80}
          onChange={(event) => set('style_key')(event.target.value)}
          placeholder={
            inherit?.style_key
              ? `Seriden: ${inherit.style_key}`
              : 'ör. blueprint'
          }
          value={values.style_key}
        />
        <span className={hint}>
          Stil paketindeki görünümün adı: küçük harf, rakam, tire.
        </span>
      </label>
      <label className={label}>
        Ses
        <input
          className={field}
          list="explainer-voices"
          maxLength={80}
          onChange={(event) => set('voice_name')(event.target.value)}
          placeholder={
            inherit?.voice_name
              ? `Seriden: ${inherit.voice_name}`
              : 'tr-TR-AhmetNeural'
          }
          value={values.voice_name}
        />
        <datalist id="explainer-voices">
          {VOICES.map((voice) => (
            <option key={voice.name} label={voice.label} value={voice.name} />
          ))}
        </datalist>
        <span className={hint}>Ücretsiz edge-tts sesi.</span>
      </label>
      <label className={label}>
        Konuşma hızı
        <input
          className={field}
          maxLength={5}
          onChange={(event) => set('voice_rate')(event.target.value)}
          placeholder={
            inherit?.voice_rate ? `Seriden: ${inherit.voice_rate}` : '+8%'
          }
          value={values.voice_rate}
        />
        <span className={hint}>“+8%” ya da “-10%” biçiminde.</span>
      </label>
      <label className={label}>
        Altyazı stili
        <select
          className={field}
          onChange={(event) => set('caption_mode')(event.target.value)}
          value={values.caption_mode}
        >
          {CAPTION_MODES.map((mode) => (
            <option key={mode.value} value={mode.value}>
              {mode.value === '' && inherit
                ? fallback(
                    'caption_mode',
                    Object.fromEntries(
                      CAPTION_MODES.map((item) => [item.value, item.label]),
                    ),
                  )
                : mode.label}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
