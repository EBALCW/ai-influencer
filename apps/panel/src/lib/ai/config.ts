import 'server-only';

/**
 * Model ID'si ileride `app_settings` tablosundan okunacak (#48). O gelene kadar
 * env'den gelir; tanımlı değilse güncel varsayılan kullanılır.
 */
export const DEFAULT_AI_MODEL = 'claude-opus-5-5';

export type AiConfig = { apiKey: string; model: string };

export function getAiConfig(): AiConfig | null {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  const model = process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_AI_MODEL;
  return { apiKey, model };
}
