// Üretim ayarı alanlarının düz yardımcıları (sunucu ve istemci bileşenleri birlikte kullanır;
// bu dosya `'use client'` değildir).

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
