import { z } from 'zod';

const shortText = (max: number) => z.string().trim().min(1).max(max);

// ---------- Girdi (istemciden gelen, route'ta doğrulanır) ----------

export const personaInputSchema = z.object({
  name: shortText(60),
  niche: shortText(120),
  language: z.enum(['tr', 'en']).default('tr'),
  audience: shortText(300).optional(),
  traits: z.array(shortText(40)).max(8).optional(),
  notes: shortText(1000).optional(),
});

export const captionInputSchema = z.object({
  persona: z.object({
    name: shortText(60),
    niche: shortText(120),
    tone: shortText(500).optional(),
  }),
  topic: shortText(500),
  format: shortText(60).optional(),
  language: z.enum(['tr', 'en']).default('tr'),
});

export const suggestRequestSchema = z.discriminatedUnion('task', [
  z.object({ task: z.literal('persona'), input: personaInputSchema }),
  z.object({ task: z.literal('caption'), input: captionInputSchema }),
]);

export type PersonaInput = z.infer<typeof personaInputSchema>;
export type CaptionInput = z.infer<typeof captionInputSchema>;
export type SuggestRequest = z.infer<typeof suggestRequestSchema>;
export type AiTask = SuggestRequest['task'];

// ---------- Çıktı (modelden gelen) ----------
// Yapılandırılmış çıktı JSON şemasına dönüştürüldüğü için basit tutulur;
// iş kuralları (hashtag sayısı, emoji sınırı) ayrıca normalize edilir.

export const personaOutputSchema = z.object({
  bio: z.string(),
  personality: z.array(z.string()),
  tone: z.object({
    do: z.array(z.string()),
    dont: z.array(z.string()),
  }),
  sampleCaptions: z.array(z.string()),
  hookTraits: z.array(z.string()),
});

export const captionOutputSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
  cta: z.string(),
});

export type PersonaSuggestion = z.infer<typeof personaOutputSchema>;
export type CaptionSuggestion = z.infer<typeof captionOutputSchema>;
