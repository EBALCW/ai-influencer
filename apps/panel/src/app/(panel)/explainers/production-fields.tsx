'use client';

import {
  VISUAL_ROUTES,
  VISUAL_ROUTE_CAPABILITY,
  VISUAL_ROUTE_LABELS,
} from '@ai-influencer/shared';
import { field, hint, label } from './shared';

/** edge-tts sesleri (anlatım skill'i → "Türkçe seslendirme"). Listede olmayan ad da yazılabilir. */
export const VOICES = [
  { name: 'tr-TR-AhmetNeural', label: 'Ahmet (Türkçe, erkek)' },
  { name: 'tr-TR-EmelNeural', label: 'Emel (Türkçe, kadın)' },
] as const;
export const DEFAULT_VOICE_PROVIDER = 'edge-tts';

export const CAPTION_MODES = [
  { value: '', label: 'Varsayılan' },
  { value: 'line', label: 'Satır satır' },
  { value: 'word', label: 'Kelime kelime' },
] as const;

export type ProductionValues = {
  visual_route: string;
  style_key: string;
  voice_name: string;
  voice_rate: string;
  caption_mode: string;
};

export function captionMode(style: unknown): string {
  const mode =
    style && typeof style === 'object'
      ? (style as Record<string, unknown>).mode
      : undefined;
  return CAPTION_MODES.some((item) => item.value === mode)
    ? (mode as string)
    : '';
}

/** Mevcut altyazı stilinin diğer anahtarlarını korur; yalnız `mode` değişir. */
export function withCaptionMode(
  style: unknown,
  mode: string,
): Record<string, unknown> {
  const { mode: _old, ...rest } =
    style && typeof style === 'object' && !Array.isArray(style)
      ? (style as Record<string, unknown>)
      : {};
  void _old;
  return mode ? { ...rest, mode } : rest;
}

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

/** Form değerlerini RPC alanlarına çevirir: boş metin `null` (seride "temizle", bölümde "seriden"). */
export function productionPatch(values: ProductionValues) {
  const text = (value: string) => value.trim() || null;
  const voiceName = text(values.voice_name);
  return {
    visual_route: text(values.visual_route),
    style_key: text(values.style_key),
    voice_provider: voiceName ? DEFAULT_VOICE_PROVIDER : null,
    voice_name: voiceName,
    voice_rate: text(values.voice_rate),
  };
}
