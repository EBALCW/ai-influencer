import type { z } from 'zod';
import { GenerationError } from './errors';

/** Sağlayıcıya gitmeden önce isteği doğrular; hata ayrıntısı dışarı sızmaz. */
export function parseRequest<T extends z.ZodType>(
  schema: T,
  input: unknown,
): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) throw new GenerationError('invalid_request');
  return result.data;
}
