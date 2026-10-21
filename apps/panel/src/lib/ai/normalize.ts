import type { CaptionSuggestion, PersonaSuggestion } from './schemas';

// docs/persona.md: caption başına en fazla 1-2 emoji, 3-5 alakalı hashtag.
export const MAX_EMOJI = 2;
export const MIN_HASHTAGS = 3;
export const MAX_HASHTAGS = 5;
export const MAX_CAPTION_LENGTH = 300;
export const MAX_BIO_LENGTH = 150;

const emojiPattern = /\p{Extended_Pictographic}/gu;

export function countEmoji(text: string): number {
  return text.match(emojiPattern)?.length ?? 0;
}

/** "#" ekler, boşluk ve noktalama temizler, tekrarları atar, sınırı uygular. */
export function normalizeHashtags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const body = raw
      .trim()
      .replace(/^#+/, '')
      .replace(/[^\p{L}\p{N}_]/gu, '');
    if (!body) continue;
    const key = body.toLocaleLowerCase('tr');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(`#${body}`);
    if (result.length === MAX_HASHTAGS) break;
  }
  return result;
}

const limit = (items: string[], max: number) =>
  items
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, max);

export type Normalized<T> = { suggestion: T; warnings: string[] };

export function normalizeCaption(
  raw: CaptionSuggestion,
): Normalized<CaptionSuggestion> {
  const warnings: string[] = [];
  const caption = raw.caption.trim();
  const hashtags = normalizeHashtags(raw.hashtags);

  if (caption.length > MAX_CAPTION_LENGTH) {
    warnings.push(`Caption ${MAX_CAPTION_LENGTH} karakteri aşıyor.`);
  }
  if (countEmoji(caption) > MAX_EMOJI) {
    warnings.push(`Caption'da ${MAX_EMOJI}'den fazla emoji var.`);
  }
  if (hashtags.length < MIN_HASHTAGS) {
    warnings.push(`En az ${MIN_HASHTAGS} hashtag önerilmeli.`);
  }

  return {
    suggestion: { caption, hashtags, cta: raw.cta.trim() },
    warnings,
  };
}

export function normalizePersona(
  raw: PersonaSuggestion,
): Normalized<PersonaSuggestion> {
  const warnings: string[] = [];
  const bio = raw.bio.trim();
  if (bio.length > MAX_BIO_LENGTH) {
    warnings.push(`Bio ${MAX_BIO_LENGTH} karakteri aşıyor.`);
  }

  const sampleCaptions = limit(raw.sampleCaptions, 5);
  if (sampleCaptions.some((caption) => countEmoji(caption) > MAX_EMOJI)) {
    warnings.push(`Bazı örnek caption'larda ${MAX_EMOJI}'den fazla emoji var.`);
  }

  return {
    suggestion: {
      bio,
      personality: limit(raw.personality, 5),
      tone: { do: limit(raw.tone.do, 5), dont: limit(raw.tone.dont, 5) },
      sampleCaptions,
      hookTraits: limit(raw.hookTraits, 4),
    },
    warnings,
  };
}
