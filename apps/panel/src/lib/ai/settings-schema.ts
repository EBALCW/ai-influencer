import { z } from 'zod';
const price = z
  .string()
  .trim()
  .regex(/^\d{1,5}(?:\.\d{1,4})?$/);
export const aiSettingsSchema = z.object({
  model: z
    .string()
    .trim()
    .regex(/^claude-[a-z0-9-]{3,100}$/),
  pricing: z.object({
    currency: z.literal('USD'),
    inputPerMTok: price,
    outputPerMTok: price,
    cacheReadPerMTok: price,
    cacheWritePerMTok: price,
    cacheWrite1hPerMTok: price,
  }),
});
export type AiSettings = z.infer<typeof aiSettingsSchema>;
