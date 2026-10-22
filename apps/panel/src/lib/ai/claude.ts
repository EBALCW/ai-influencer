import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import { AiError, toAiError } from './errors';

export type AiUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens?: number;
  cacheCreation1hInputTokens?: number;
};
export type AiResult<T> = { data: T; usage: AiUsage; model: string };
export type ClaudeClient = {
  beta: { messages: Pick<Anthropic['beta']['messages'], 'create'> };
};
export function createClaudeClient(apiKey: string): ClaudeClient {
  // Otomatik tekrar/fallback yok: tek kullanıcı eylemi tek ücretli çağrı yapar.
  return new Anthropic({ apiKey, timeout: 30_000, maxRetries: 0 });
}
type StructuredRequest<S extends z.ZodType> = {
  model: string;
  system: string;
  userMessage: string;
  schema: S;
  effort: 'low' | 'medium' | 'high';
  maxTokens?: number;
  onUsage?: (usage: AiUsage, model: string) => Promise<void>;
};
export async function runStructured<S extends z.ZodType>(
  client: ClaudeClient,
  request: StructuredRequest<S>,
): Promise<AiResult<z.infer<S>>> {
  let response;
  try {
    response = await client.beta.messages.create({
      model: request.model,
      max_tokens: request.maxTokens ?? 8000,
      stream: false,
      system: request.system,
      messages: [{ role: 'user', content: request.userMessage }],
      output_config: {
        effort: request.effort,
        format: betaZodOutputFormat(request.schema),
      },
    });
  } catch (error) {
    throw toAiError(error);
  }
  const write1h = response.usage.cache_creation?.ephemeral_1h_input_tokens ?? 0;
  const write5m = Math.max(
    0,
    (response.usage.cache_creation_input_tokens ?? 0) - write1h,
  );
  const usage: AiUsage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
    ...(write5m ? { cacheCreationInputTokens: write5m } : {}),
    ...(write1h ? { cacheCreation1hInputTokens: write1h } : {}),
  };
  // JSON geçersiz, kesilmiş veya reddedilmiş olsa da bilinen kullanım önce kaydedilir.
  await request.onUsage?.(usage, response.model);
  if (response.stop_reason === 'refusal') throw new AiError('refused');
  if (response.stop_reason !== 'end_turn') throw new AiError('invalid_output');
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      response.content
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join(''),
    );
  } catch {
    throw new AiError('invalid_output');
  }
  const checked = request.schema.safeParse(parsed);
  if (!checked.success) throw new AiError('invalid_output');
  return { data: checked.data, usage, model: response.model };
}
