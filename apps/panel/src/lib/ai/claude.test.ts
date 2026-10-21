import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('server-only', () => ({}));

const { runStructured } = await import('./claude');
const { AiError } = await import('./errors');

const schema = z.object({ caption: z.string() });

function fakeClient(parse: ReturnType<typeof vi.fn>) {
  return { beta: { messages: { parse } } } as unknown as Parameters<
    typeof runStructured
  >[0];
}

const okResponse = {
  stop_reason: 'end_turn',
  parsed_output: { caption: 'Merhaba' },
  model: 'claude-opus-5-5',
  usage: { input_tokens: 120, output_tokens: 40, cache_read_input_tokens: 0 },
};

const request = {
  model: 'claude-opus-5-5',
  system: 'talimat',
  userMessage: 'girdi',
  schema,
  effort: 'low' as const,
};

async function expectAiError(promise: Promise<unknown>, code: string) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AiError);
  expect((error as InstanceType<typeof AiError>).code).toBe(code);
}

describe('runStructured', () => {
  it('doğrulanmış çıktıyı ve token kullanımını döner', async () => {
    const parse = vi.fn().mockResolvedValue(okResponse);
    const result = await runStructured(fakeClient(parse), request);

    expect(result).toEqual({
      data: { caption: 'Merhaba' },
      usage: { inputTokens: 120, outputTokens: 40, cacheReadInputTokens: 0 },
      model: 'claude-opus-5-5',
    });
  });

  it('talimatı system alanına, kullanıcı girdisini ayrı mesaja koyar', async () => {
    const parse = vi.fn().mockResolvedValue(okResponse);
    await runStructured(fakeClient(parse), request);

    const params = parse.mock.calls[0]?.[0];
    expect(params.system).toBe('talimat');
    expect(params.messages).toEqual([{ role: 'user', content: 'girdi' }]);
    expect(params.output_config.effort).toBe('low');
    expect(params.output_config.format.type).toBe('json_schema');
  });

  it('destekleyen modelde sunucu tarafı fallback açılır, desteklemeyende açılmaz', async () => {
    const parse = vi.fn().mockResolvedValue(okResponse);
    await runStructured(fakeClient(parse), request);
    await runStructured(fakeClient(parse), {
      ...request,
      model: 'claude-haiku-5-5',
    });

    expect(parse.mock.calls[0]?.[0]).toMatchObject({
      fallbacks: 'default',
      betas: ['server-side-fallback-2026-07-01'],
    });
    expect(parse.mock.calls[1]?.[0]).not.toHaveProperty('fallbacks');
    expect(parse.mock.calls[1]?.[0]).not.toHaveProperty('betas');
  });

  it('şemaya uymayan / bozuk JSON çıktısında invalid_output', async () => {
    const parse = vi
      .fn()
      .mockRejectedValue(
        new Anthropic.AnthropicError('Failed to parse structured output'),
      );
    await expectAiError(
      runStructured(fakeClient(parse), request),
      'invalid_output',
    );
  });

  it('parsed_output boşsa veya max_tokens ile kesildiyse invalid_output', async () => {
    const empty = vi
      .fn()
      .mockResolvedValue({ ...okResponse, parsed_output: null });
    await expectAiError(
      runStructured(fakeClient(empty), request),
      'invalid_output',
    );

    const truncated = vi
      .fn()
      .mockResolvedValue({ ...okResponse, stop_reason: 'max_tokens' });
    await expectAiError(
      runStructured(fakeClient(truncated), request),
      'invalid_output',
    );
  });

  it('model reddederse refused', async () => {
    const parse = vi.fn().mockResolvedValue({
      ...okResponse,
      stop_reason: 'refusal',
      parsed_output: null,
    });
    await expectAiError(runStructured(fakeClient(parse), request), 'refused');
  });

  it('429 → rate_limited, istek kimliği korunur', async () => {
    const headers = new Headers({ 'request-id': 'req_123' });
    const parse = vi
      .fn()
      .mockRejectedValue(
        new Anthropic.RateLimitError(429, {}, 'rate limited', headers),
      );
    const error = (await runStructured(fakeClient(parse), request).catch(
      (e: unknown) => e,
    )) as InstanceType<typeof AiError>;
    expect(error.code).toBe('rate_limited');
    expect(error.status).toBe(429);
    expect(error.requestId).toBe('req_123');
  });

  it('zaman aşımı → timeout', async () => {
    const parse = vi
      .fn()
      .mockRejectedValue(new Anthropic.APIConnectionTimeoutError());
    await expectAiError(runStructured(fakeClient(parse), request), 'timeout');
  });

  it('401 → auth_failed, 5xx → unavailable', async () => {
    const auth = vi
      .fn()
      .mockRejectedValue(
        new Anthropic.AuthenticationError(401, {}, 'invalid', new Headers()),
      );
    await expectAiError(
      runStructured(fakeClient(auth), request),
      'auth_failed',
    );

    const server = vi
      .fn()
      .mockRejectedValue(
        new Anthropic.InternalServerError(500, {}, 'boom', new Headers()),
      );
    await expectAiError(
      runStructured(fakeClient(server), request),
      'unavailable',
    );
  });

  it('kullanıcı mesajı sağlayıcı hata metnini veya anahtarı içermez', async () => {
    const parse = vi
      .fn()
      .mockRejectedValue(
        new Anthropic.AuthenticationError(
          401,
          {},
          'invalid x-api-key sk-ant-secret',
          new Headers(),
        ),
      );
    const error = (await runStructured(fakeClient(parse), request).catch(
      (e: unknown) => e,
    )) as Error;
    expect(error.message).not.toContain('sk-ant');
    expect(error.message).not.toContain('x-api-key');
  });
});
