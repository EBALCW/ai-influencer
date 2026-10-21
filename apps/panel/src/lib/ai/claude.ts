import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import { AiError, toAiError } from './errors';

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
};

export type AiResult<T> = { data: T; usage: AiUsage; model: string };

/** Testlerde sahte istemci verebilmek için SDK'nın kullandığımız kısmı. */
export type ClaudeClient = {
  beta: { messages: Pick<Anthropic['beta']['messages'], 'parse'> };
};

const REQUEST_TIMEOUT_MS = 30_000;

/** Sunucu tarafı fallback'i destekleyen modeller ("default" form, Claude API). */
const FALLBACK_MODELS = new Set([
  'claude-fable-5-1',
  'claude-opus-5-5',
  'claude-opus-5',
  'claude-sonnet-5-5',
]);

export function createClaudeClient(apiKey: string): ClaudeClient {
  return new Anthropic({
    apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
  });
}

type StructuredRequest<S extends z.ZodType> = {
  model: string;
  system: string;
  userMessage: string;
  schema: S;
  effort: 'low' | 'medium' | 'high';
  maxTokens?: number;
};

/**
 * Tek bir yapılandırılmış çıktı isteği. Model yanıtı Zod şemasıyla doğrulanır;
 * doğrulanamazsa, model reddederse veya sağlayıcı hata verirse AiError fırlatır.
 */
export async function runStructured<S extends z.ZodType>(
  client: ClaudeClient,
  request: StructuredRequest<S>,
): Promise<AiResult<z.infer<S>>> {
  const useFallback = FALLBACK_MODELS.has(request.model);

  let response;
  try {
    response = await client.beta.messages.parse({
      model: request.model,
      max_tokens: request.maxTokens ?? 8000,
      system: request.system,
      messages: [{ role: 'user', content: request.userMessage }],
      output_config: {
        effort: request.effort,
        format: betaZodOutputFormat(request.schema),
      },
      // Güvenlik sınıflandırıcısı reddederse istek aynı çağrıda başka modelle denenir
      ...(useFallback
        ? {
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default' as const,
          }
        : {}),
    });
  } catch (error) {
    throw toAiError(error);
  }

  if (response.stop_reason === 'refusal') throw new AiError('refused');
  if (
    response.stop_reason === 'max_tokens' ||
    response.parsed_output === null ||
    response.parsed_output === undefined
  ) {
    throw new AiError('invalid_output');
  }

  return {
    data: response.parsed_output as z.infer<S>,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
    },
    model: response.model,
  };
}
