import 'server-only';
import type { GenerationProvider } from './provider';
import { GenerationError } from './errors';
import { HiggsfieldProvider } from './higgsfield-provider';
import { MockProvider } from './mock-provider';

export type { GenerationProvider } from './provider';
export { GenerationError } from './errors';
export { checkBudget } from './budget';
export { canTransition, isTerminal } from './status';
export * from './types';

type Env = Record<string, string | undefined>;

let mockSingleton: MockProvider | null = null;

/**
 * `GENERATION_PROVIDER` env'ine göre sağlayıcıyı döner (varsayılan `mock`).
 * Anahtar eksikse veya ad tanınmıyorsa `not_configured` atar; anahtarlar
 * sadece sunucuda okunur.
 */
export function getGenerationProvider(
  env: Env = process.env,
): GenerationProvider {
  const name = env.GENERATION_PROVIDER?.trim() || 'mock';

  if (name === 'mock') {
    mockSingleton ??= new MockProvider();
    return mockSingleton;
  }

  if (name === 'higgsfield') {
    const keyId = env.HIGGSFIELD_API_KEY_ID?.trim();
    const keySecret = env.HIGGSFIELD_API_KEY_SECRET?.trim();
    if (!keyId || !keySecret) throw new GenerationError('not_configured');
    return new HiggsfieldProvider({
      keyId,
      keySecret,
      models: {
        image: env.HIGGSFIELD_IMAGE_MODEL?.trim() || undefined,
        videoToVideo: env.HIGGSFIELD_VIDEO_TO_VIDEO_MODEL?.trim() || undefined,
      },
    });
  }

  throw new GenerationError('not_configured');
}
