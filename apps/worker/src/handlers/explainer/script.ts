// İş parametreleri + onaylı senaryo sürümü → üretim planı. Girdilerin tamamı şemadan geçer.
// Kural: ekrana yalnız senaryo paketinde (metin, yapılandırılmış senaryo, kaynak notları) ve
// dondurulmuş parametrelerde bulunan bilgi çıkar; plan hiçbir olgu ya da çizim uydurmaz.
import {
  EXPLAINER_KINDS,
  VISUAL_ROUTES,
  episodeLabel,
} from '@ai-influencer/shared/explainer';
import { z } from 'zod';
import { PermanentError } from '../../lib/errors.ts';
import {
  buildSpoken,
  cleanLabel,
  cleanText,
  countWords,
  makeBeats,
  withCaptionBreaks,
} from './text.ts';

const uuid = z.string().regex(/^[0-9a-f-]{36}$/i);
const language = z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/);

/** `jobs.params` (`EpisodeJobParams`). Bilinmeyen anahtarlar yok sayılır: sunucu alan ekleyebilir. */
export const jobParamsSchema = z.object({
  episode: z.object({
    id: uuid,
    number: z.number().int().min(1).max(100000).nullable(),
    title: z.string().min(1).max(400),
    kind: z.enum(EXPLAINER_KINDS),
    language,
    script_version: z.number().int().min(1),
  }),
  series: z
    .object({
      id: uuid,
      name: z.string().max(400),
      theme: z.string().max(4000),
    })
    .nullable(),
  visual_route: z.enum(VISUAL_ROUTES).nullable(),
  style_key: z.string().max(80).nullable(),
  voice: z.object({
    provider: z.string().max(40).nullable(),
    name: z.string().max(80).nullable(),
    rate: z.string().max(8).nullable(),
  }),
  caption_style: z.record(z.string(), z.unknown()),
  params: z.record(z.string(), z.unknown()),
});
export type JobParams = z.infer<typeof jobParamsSchema>;

const factSource = z.object({
  title: z.string().max(600).optional(),
  url: z.string().max(2000).optional(),
});
const factNote = z.object({
  claim: z.string().max(2000),
  sources: z.array(factSource).max(20).optional(),
});

/** `episode_script_versions` satırının makinenin okuduğu alanları. */
export const scriptVersionSchema = z.object({
  version: z.number().int().min(1),
  kind: z.string().max(40),
  language,
  script_text: z.string().max(20000),
  script: z.unknown().optional(),
  fact_notes: z.array(factNote).max(200),
  approved_at: z.string().min(1).nullable(),
});
export type ScriptVersion = z.infer<typeof scriptVersionSchema>;

// ── Yapılandırılmış senaryo (episodes.script) ───────────────────────────────

const label = (max: number) => z.string().trim().min(1).max(max);

/** Ekran kartları: küçük, parametreli sahne türleri. Yeni tür buraya ve `sablon.js`'e eklenir. */
export const cardSchema = z.discriminatedUnion('type', [
  /** Büyük anahtar ifade ("MOTOR YOK") ve isteğe bağlı küçük not. */
  z.strictObject({
    type: z.literal('phrase'),
    text: label(60),
    note: label(80).optional(),
  }),
  /** Sayı / istatistik: değer, birim ve kısa açıklama. */
  z.strictObject({
    type: z.literal('number'),
    value: label(16),
    unit: label(24).optional(),
    label: label(60).optional(),
  }),
  /** Etiketli akış: oklarla bağlı 2-4 kutu. */
  z.strictObject({
    type: z.literal('steps'),
    title: label(40).optional(),
    items: z.array(label(40)).min(2).max(4),
  }),
]);
export type Card = z.infer<typeof cardSchema>;

/**
 * Desteklenen yapılandırılmış senaryo, sürüm 1. `beats[].text` anlatıcının söylediği metindir;
 * hepsi birleşince onaylı `script_text` ile aynı olmalıdır (boşluk farkı sayılmaz).
 */
export const structuredScriptSchema = z.strictObject({
  version: z.literal(1),
  beats: z
    .array(
      z.strictObject({
        text: z.string().trim().min(1).max(600),
        heading: label(40).optional(),
        card: cardSchema.optional(),
      }),
    )
    .min(1)
    .max(60),
  /** Yalnız sese giden okunuşlar: `{"3.000": "üç bin"}`. */
  spoken: z.record(z.string().max(40), z.string().max(120)).optional(),
});
export type StructuredScript = z.infer<typeof structuredScriptSchema>;

/** Film motorunun `script.json` biçimi (skia yolu): yalnız `text` ve `typed` okunur. */
const engineScriptSchema = z.object({
  takes: z
    .array(
      z.object({
        lines: z
          .array(
            z.object({
              text: z.string().trim().min(1).max(600),
              typed: z.string().max(200).optional(),
            }),
          )
          .min(1)
          .max(60),
      }),
    )
    .min(1)
    .max(60),
});

export interface PlanBeat {
  /** Ekranda görünen ve seslendirilen metin (temiz). */
  text: string;
  /** Aynı metin, altyazı parçası işaretleriyle (` | `). */
  marked: string;
  heading: string | null;
  card: Card | null;
}

export interface ProductionPlan {
  language: string;
  voiceProvider: VoiceProviderKey;
  voice: string;
  rate: string;
  captionMode: 'line' | 'word';
  title: string;
  kindLabel: string;
  seriesName: string | null;
  episodeLabel: string | null;
  beats: PlanBeat[];
  spoken: Record<string, string>;
  /** Kapanış kartındaki kaynak adları (kaynak notlarından; en çok 6). */
  sources: string[];
  /** Yapılandırılmış senaryo kullanıldı mı? */
  structured: 'v1' | 'engine' | 'none' | 'ignored';
  /** İstenen stil bilinmiyorsa adı; şablon yine `blueprint` ile çizer. */
  styleFallbackFrom: string | null;
}

export const SUPPORTED_STYLE = 'blueprint';
/** Ses sağlayıcı anahtarları (`series.voice_provider`). Uygulamaları: index.ts → VOICE_PROVIDERS. */
export const VOICE_PROVIDER_KEYS = ['edge-tts'] as const;
export type VoiceProviderKey = (typeof VOICE_PROVIDER_KEYS)[number];
/** `voice.py` sesi en çok 180 sn'lik bir tampona yazar; payıyla birlikte sınır. */
export const MAX_WORDS = 400;
export const MAX_BEATS = 60;

const DEFAULT_VOICES: Record<string, string> = {
  tr: 'tr-TR-AhmetNeural',
  en: 'en-US-GuyNeural',
};
const VOICE_NAME = /^[a-z]{2,3}-[A-Z]{2}(-[A-Za-z0-9]{1,24}){1,2}$/;
const VOICE_RATE = /^[+-][0-9]{1,3}%$/;

const KIND_LABELS: Record<(typeof EXPLAINER_KINDS)[number], string> = {
  how_it_works: 'NASIL ÇALIŞIR?',
  event: 'GERÇEK OLAY',
};
const KIND_LABELS_EN: Record<(typeof EXPLAINER_KINDS)[number], string> = {
  how_it_works: 'HOW IT WORKS',
  event: 'TRUE STORY',
};

/** Karşılaştırma anahtarı: boşluk ve büyük/küçük harf farkı sayılmaz. */
function fold(text: string): string {
  return cleanText(text).replace(/\s+/g, '').toLocaleLowerCase('tr');
}

function cleanCard(card: Card): Card {
  if (card.type === 'phrase')
    return {
      type: 'phrase',
      text: cleanLabel(card.text, 60),
      ...(card.note ? { note: cleanLabel(card.note, 80) } : {}),
    };
  if (card.type === 'number')
    return {
      type: 'number',
      value: cleanLabel(card.value, 16),
      ...(card.unit ? { unit: cleanLabel(card.unit, 24) } : {}),
      ...(card.label ? { label: cleanLabel(card.label, 60) } : {}),
    };
  return {
    type: 'steps',
    ...(card.title ? { title: cleanLabel(card.title, 40) } : {}),
    items: card.items.map((item) => cleanLabel(item, 40)),
  };
}

type Draft = { text: string; heading: string | null; card: Card | null };

/** Yapılandırılmış senaryoyu okur; tanınmıyorsa ya da onaylı metinle uyuşmuyorsa `null`. */
function structuredBeats(
  script: unknown,
  scriptText: string,
): {
  kind: 'v1' | 'engine';
  beats: Draft[];
  spoken: Record<string, string>;
} | null {
  let kind: 'v1' | 'engine';
  let beats: Draft[];
  let spoken: Record<string, string> = {};
  const v1 = structuredScriptSchema.safeParse(script);
  if (v1.success) {
    kind = 'v1';
    spoken = v1.data.spoken ?? {};
    beats = v1.data.beats.map((beat) => ({
      text: cleanText(beat.text).replace(/\s+/g, ' '),
      heading: beat.heading ? cleanLabel(beat.heading, 40) : null,
      card: beat.card ? cleanCard(beat.card) : null,
    }));
  } else {
    const engine = engineScriptSchema.safeParse(script);
    if (!engine.success) return null;
    kind = 'engine';
    beats = engine.data.takes.flatMap((take) =>
      take.lines.map((line) => {
        const typed = line.typed ? cleanLabel(line.typed, 60) : '';
        return {
          text: cleanText(line.text).replace(/\s+/g, ' '),
          heading: null,
          card: typed ? ({ type: 'phrase', text: typed } as const) : null,
        };
      }),
    );
  }
  beats = beats.filter((beat) => beat.text.length > 0);
  if (beats.length === 0) return null;
  // Seslendirilen metin, insanın okuyup onayladığı metinle aynı olmalı
  if (fold(beats.map((beat) => beat.text).join(' ')) !== fold(scriptText))
    return null;
  return { kind, beats, spoken };
}

function sourceNames(notes: ScriptVersion['fact_notes']): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const note of notes)
    for (const source of note.sources ?? []) {
      let name = source.title ? cleanLabel(source.title, 46) : '';
      if (!name && source.url) {
        try {
          const url = new URL(source.url);
          if (url.protocol === 'http:' || url.protocol === 'https:')
            name = cleanLabel(url.hostname.replace(/^www\./, ''), 46);
        } catch {
          // adres değil: kaynak adı yok
        }
      }
      const key = name.toLocaleLowerCase('tr');
      if (!name || seen.has(key)) continue;
      seen.add(key);
      names.push(name);
      if (names.length >= 6) return names;
    }
  return names;
}

/**
 * Planı kurar. Hatalar kalıcıdır (`PermanentError`): aynı girdiyle yeniden denemek sonucu
 * değiştirmez. Hata metinlerine senaryo içeriği taşınmaz.
 */
export function buildPlan(
  params: JobParams,
  version: ScriptVersion,
): ProductionPlan {
  if (version.version !== params.episode.script_version)
    throw new PermanentError(
      'Senaryo sürümü işin dondurulduğu sürümle aynı değil.',
    );
  if (!version.approved_at)
    throw new PermanentError('Bu senaryo sürümü onaylı değil; üretilmez.');

  // Sağlayıcı seçilmemişse ücretsiz Türkçe ses (edge-tts)
  const provider = (params.voice.provider ?? 'edge-tts') as VoiceProviderKey;
  if (!VOICE_PROVIDER_KEYS.includes(provider))
    throw new PermanentError(
      'Bu makine yalnız edge-tts ile seslendirir; seride başka bir ses sağlayıcı seçili.',
    );
  const lang = version.language;
  const voice =
    params.voice.name?.trim() || DEFAULT_VOICES[lang.slice(0, 2)] || '';
  if (!voice)
    throw new PermanentError(
      'Bu dil için varsayılan ses yok; seride bir ses adı seçin.',
    );
  if (!VOICE_NAME.test(voice))
    throw new PermanentError(
      'Ses adı edge-tts biçiminde değil (ör. tr-TR-AhmetNeural).',
    );
  const rate = params.voice.rate?.trim() || '+8%';
  if (!VOICE_RATE.test(rate))
    throw new PermanentError('Konuşma hızı "+8%" biçiminde olmalı.');

  const scriptText = cleanText(version.script_text);
  if (!scriptText) throw new PermanentError('Senaryo metni boş.');

  const structured = structuredBeats(version.script ?? null, scriptText);
  const drafts: Draft[] = structured
    ? structured.beats
    : makeBeats(scriptText).map((text) => ({
        text,
        heading: null,
        card: null,
      }));
  if (drafts.length === 0) throw new PermanentError('Senaryo metni boş.');
  if (drafts.length > MAX_BEATS)
    throw new PermanentError(
      `Senaryo bu sürüm için çok parçalı (en çok ${MAX_BEATS} vuruş).`,
    );
  const lines = drafts.map((draft) => draft.text);
  if (countWords(lines) > MAX_WORDS)
    throw new PermanentError(
      `Senaryo bu sürüm için çok uzun (en çok ${MAX_WORDS} kelime, yaklaşık 170 sn).`,
    );

  const mode = params.caption_style.mode === 'word' ? 'word' : 'line';
  const style = params.style_key?.trim() || SUPPORTED_STYLE;
  const kindLabels = lang.startsWith('en') ? KIND_LABELS_EN : KIND_LABELS;
  const seriesName = params.series?.name
    ? cleanLabel(params.series.name, 60)
    : '';
  return {
    language: lang,
    voiceProvider: provider,
    voice,
    rate,
    captionMode: mode,
    title: cleanLabel(params.episode.title, 90) || 'Anlatım',
    kindLabel: kindLabels[params.episode.kind],
    seriesName: seriesName || null,
    episodeLabel: seriesName ? episodeLabel(params.episode.number) : null,
    beats: drafts.map((draft) => ({
      text: draft.text,
      marked: withCaptionBreaks(draft.text),
      heading: draft.heading,
      card: draft.card,
    })),
    spoken: buildSpoken(lines, lang, structured?.spoken),
    sources: sourceNames(version.fact_notes),
    structured: structured
      ? structured.kind
      : version.script === null || version.script === undefined
        ? 'none'
        : 'ignored',
    styleFallbackFrom: style === SUPPORTED_STYLE ? null : cleanLabel(style, 40),
  };
}
