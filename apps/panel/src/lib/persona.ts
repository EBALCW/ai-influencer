import { z } from 'zod';
import type { Json, Row } from '@ai-influencer/shared';

/**
 * Persona formunun ve API'nin ortak şeması (#44). #43 wizard'ı da bu şemayı kullanır.
 *
 * Veritabanında `personality`, `audience` ve `appearance` jsonb nesneleridir. Panel bu
 * nesnelerin bilinen alanlarını düzenler; bilinmeyen anahtarlar (ör. eski kayıtlardan
 * kalanlar) kayıtta korunur (`toPersonaPayload`).
 */

const shortText = (max: number) => z.string().trim().max(max);
const tagList = (maxItems: number) =>
  z.array(z.string().trim().min(1).max(60)).max(maxItems);

export const appearanceFields = [
  ['hair', 'Saç'],
  ['skin', 'Ten'],
  ['eyes', 'Göz'],
  ['face', 'Yüz yapısı'],
  ['body', 'Vücut / boyun oranı'],
  ['signature', 'İmza aksesuar / kanca'],
] as const;

export type AppearanceKey = (typeof appearanceFields)[number][0];

export const personaInputSchema = z.object({
  bio: shortText(5000),
  tone: shortText(200),
  adjectives: tagList(10),
  hookTraits: tagList(10),
  sampleCaptions: z.array(shortText(2200).min(1)).max(10),
  audience: z.object({
    ageRange: shortText(40),
    interests: tagList(15),
    description: shortText(1000),
  }),
  appearance: z.object({
    hair: shortText(200),
    skin: shortText(200),
    eyes: shortText(200),
    face: shortText(200),
    body: shortText(200),
    signature: shortText(200),
  }),
  changeNote: shortText(500),
});

export type PersonaInput = z.infer<typeof personaInputSchema>;

export const restoreInputSchema = z.object({
  version: z.number().int().positive(),
  changeNote: shortText(500).optional(),
});

export type PersonaRow = Row<'influencer_personas'>;
type JsonObject = { [key: string]: Json | undefined };

function asObject(value: Json | null | undefined): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function asString(value: Json | undefined): string {
  return typeof value === 'string' ? value : '';
}

function asStringList(value: Json | undefined): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

/** Bir persona satırını form değerlerine çevirir (yeni persona için boş değerler). */
export function toPersonaInput(
  row: PersonaRow | null | undefined,
): PersonaInput {
  const personality = asObject(row?.personality);
  const audience = asObject(row?.audience);
  const appearance = asObject(row?.appearance);
  return {
    bio: row?.bio ?? '',
    tone: row?.tone ?? '',
    adjectives: asStringList(personality.adjectives),
    hookTraits: row?.hook_traits ?? [],
    sampleCaptions: row?.sample_captions ?? [],
    audience: {
      ageRange: asString(audience.age_range),
      interests: asStringList(audience.interests),
      description: asString(audience.description),
    },
    appearance: {
      hair: asString(appearance.hair),
      skin: asString(appearance.skin),
      eyes: asString(appearance.eyes),
      face: asString(appearance.face),
      body: asString(appearance.body),
      signature: asString(appearance.signature),
    },
    changeNote: '',
  };
}

/**
 * Form değerlerini `create_persona_version` RPC parametrelerine çevirir.
 * Mevcut versiyondaki bilinmeyen jsonb anahtarları korunur.
 */
export function toPersonaPayload(
  input: PersonaInput,
  current: PersonaRow | null | undefined,
) {
  return {
    p_bio: input.bio,
    p_tone: input.tone,
    p_hook_traits: input.hookTraits,
    p_sample_captions: input.sampleCaptions,
    p_personality: {
      ...asObject(current?.personality),
      adjectives: input.adjectives,
    },
    p_audience: {
      ...asObject(current?.audience),
      age_range: input.audience.ageRange,
      interests: input.audience.interests,
      description: input.audience.description,
    },
    p_appearance: { ...asObject(current?.appearance), ...input.appearance },
    p_change_note: input.changeNote,
  };
}

/** "a, b , ,c" → ["a", "b", "c"] (form alanlarındaki virgüllü listeler için). */
export function parseTagList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Satır satır girilen örnek captionları boş satırları atlayarak ayrıştırır. */
export function parseCaptionList(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}
