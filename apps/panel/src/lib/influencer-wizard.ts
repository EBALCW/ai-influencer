import { z } from 'zod';
import { personaInputSchema, type PersonaInput } from './persona';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const influencerDraftSchema = z.object({
  name: z.string().trim().min(1, 'İsim gerekli.').max(80),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(slugPattern, 'Slug küçük harf, rakam ve tire içerebilir.'),
  niche: z.string().trim().max(100),
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/, 'Dil kodunu tr veya en gibi girin.'),
});

export type InfluencerDraftInput = z.infer<typeof influencerDraftSchema>;

export const wizardPersonaSchema = personaInputSchema.extend({
  bio: z.string().trim().min(1, 'Karakter hikâyesini yazın.').max(5000),
  tone: z.string().trim().min(1, 'Ses tonunu belirtin.').max(200),
  audience: personaInputSchema.shape.audience.extend({
    description: z.string().trim().min(1, 'Hedef kitleyi açıklayın.').max(1000),
  }),
});
export type WizardPersonaInput = PersonaInput;

export function slugifyInfluencerName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

export function buildCharacterPrompt(
  name: string,
  persona: PersonaInput,
): string {
  const appearance = [
    persona.appearance.hair && `saç: ${persona.appearance.hair}`,
    persona.appearance.skin && `ten: ${persona.appearance.skin}`,
    persona.appearance.eyes && `göz: ${persona.appearance.eyes}`,
    persona.appearance.face && `yüz yapısı: ${persona.appearance.face}`,
    persona.appearance.body && `vücut/boyun oranı: ${persona.appearance.body}`,
    persona.appearance.signature &&
      `imza aksesuarı veya kanca özelliği: ${persona.appearance.signature}`,
  ].filter(Boolean);
  const details = [
    persona.bio && `Hikâye: ${persona.bio}`,
    persona.tone && `Ses tonu: ${persona.tone}`,
    persona.adjectives.length && `Kişilik: ${persona.adjectives.join(', ')}`,
    persona.hookTraits.length &&
      `Kanca özellikleri: ${persona.hookTraits.join(', ')}`,
    persona.audience.description &&
      `Hedef kitle: ${persona.audience.description}`,
    appearance.length && `Görünüm: ${appearance.join('; ')}`,
  ].filter(Boolean);
  return [
    `${name} adlı AI influencer karakteri.`,
    ...details,
    'Doğal cilt dokusu, tutarlı yüz kimliği ve gerçekçi telefon kamerası estetiği.',
  ].join('\n');
}
