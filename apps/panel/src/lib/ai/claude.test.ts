import { describe, expect, it, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
vi.mock('server-only', () => ({}));
const { runStructured } = await import('./claude');
const schema = z.object({ caption: z.string() });
const request = {
  model: 'claude-fixture',
  system: 'talimat',
  userMessage: 'kullanıcı verisi',
  schema,
  effort: 'low' as const,
};
const response = () => ({
  model: 'claude-fixture',
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: '{"caption":"Merhaba"}' }],
  usage: { input_tokens: 120, output_tokens: 40, cache_read_input_tokens: 0 },
});
const client = (create: ReturnType<typeof vi.fn>) =>
  ({ beta: { messages: { create } } }) as unknown as Parameters<
    typeof runStructured
  >[0];
describe('runStructured', () => {
  it('şemayı doğrular, talimatı ve veriyi ayrı gönderir, otomatik fallback yapmaz', async () => {
    const create = vi.fn().mockResolvedValue(response());
    const result = await runStructured(client(create), request);
    expect(result.data).toEqual({ caption: 'Merhaba' });
    expect(create.mock.calls[0]![0]).toMatchObject({
      system: 'talimat',
      messages: [{ role: 'user', content: 'kullanıcı verisi' }],
      output_config: { format: { type: 'json_schema' } },
    });
    expect(create.mock.calls[0]![0]).not.toHaveProperty('fallbacks');
  });
  it.each(['not json', '{"caption":123}'])(
    'geçersiz çıktıda bile kullanım önce yazılır: %s',
    async (text) => {
      const r = response();
      r.content[0]!.text = text;
      const usage = vi.fn();
      await expect(
        runStructured(client(vi.fn().mockResolvedValue(r)), {
          ...request,
          onUsage: usage,
        }),
      ).rejects.toMatchObject({ code: 'invalid_output' });
      expect(usage).toHaveBeenCalledWith(
        { inputTokens: 120, outputTokens: 40, cacheReadInputTokens: 0 },
        'claude-fixture',
      );
    },
  );
  it.each(['refusal', 'max_tokens', 'pause_turn'])(
    'kesilmiş/reddedilmiş çıktının da maliyeti kaydedilir: %s',
    async (stop_reason) => {
      const usage = vi.fn();
      await expect(
        runStructured(
          client(vi.fn().mockResolvedValue({ ...response(), stop_reason })),
          { ...request, onUsage: usage },
        ),
      ).rejects.toMatchObject({
        code: stop_reason === 'refusal' ? 'refused' : 'invalid_output',
      });
      expect(usage).toHaveBeenCalledOnce();
    },
  );
  it('cache yazma sürelerini ayırır', async () => {
    const usage = vi.fn();
    await runStructured(
      client(
        vi.fn().mockResolvedValue({
          ...response(),
          usage: {
            input_tokens: 1,
            output_tokens: 2,
            cache_creation_input_tokens: 300,
            cache_creation: { ephemeral_1h_input_tokens: 100 },
          },
        }),
      ),
      { ...request, onUsage: usage },
    );
    expect(usage.mock.calls[0]![0]).toMatchObject({
      cacheCreationInputTokens: 200,
      cacheCreation1hInputTokens: 100,
    });
  });
  it('sağlayıcı hata metni ve anahtar sızmaz', async () => {
    const error = new Anthropic.AuthenticationError(
      401,
      {},
      'sk-ant-private',
      new Headers(),
    );
    await expect(
      runStructured(client(vi.fn().mockRejectedValue(error)), request),
    ).rejects.toMatchObject({ code: 'auth_failed', status: 503 });
    await expect(
      runStructured(client(vi.fn().mockRejectedValue(error)), request),
    ).rejects.not.toThrow('sk-ant-private');
  });
  it('maliyet kaydı hatası çıktıyı başarıya çeviremez', async () => {
    await expect(
      runStructured(client(vi.fn().mockResolvedValue(response())), {
        ...request,
        onUsage: async () => {
          throw Error('billing');
        },
      }),
    ).rejects.toThrow('billing');
  });
  it('timeout güvenli hataya çevrilir', async () => {
    await expect(
      runStructured(
        client(
          vi.fn().mockRejectedValue(new Anthropic.APIConnectionTimeoutError()),
        ),
        request,
      ),
    ).rejects.toMatchObject({ code: 'timeout' });
  });
});
