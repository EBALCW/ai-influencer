// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

const auth = vi.hoisted(() => ({
  user: null as { id: string } | null,
  role: null as string | null,
}));

// Gerçek requireApiRole çalışsın; sadece Supabase istemcisi sahte
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: auth.user },
        error: auth.user ? null : new Error('no session'),
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: auth.role ? { role: auth.role } : null,
            error: null,
          }),
        }),
      }),
    }),
  }),
}));

const suggestMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/ai/suggest', () => ({ suggest: suggestMock }));

const { POST } = await import('./route');
const { aiRateLimiter } = await import('@/lib/ai/rate-limit');
const { AiError } = await import('@/lib/ai/errors');

const validBody = {
  task: 'caption',
  input: {
    persona: { name: 'Mina Arven', niche: 'AI ve gündelik teknoloji' },
    topic: 'Açık kalan sekmeler',
  },
};

function call(body: unknown) {
  const request = new Request('http://127.0.0.1:3000/api/ai/suggest', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  return POST(request as unknown as NextRequest);
}

beforeEach(() => {
  auth.user = { id: 'user-editor' };
  auth.role = 'editor';
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  aiRateLimiter.reset();
  suggestMock.mockReset();
  suggestMock.mockResolvedValue({
    task: 'caption',
    suggestion: { caption: 'Merhaba', hashtags: ['#ai'], cta: 'Sen?' },
    warnings: [],
    usage: { inputTokens: 1, outputTokens: 1, cacheReadInputTokens: 0 },
    model: 'claude-opus-5-5',
    promptId: 'builtin:caption@1',
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/ai/suggest', () => {
  it('oturum yoksa 401', async () => {
    auth.user = null;
    expect((await call(validBody)).status).toBe(401);
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it('viewer 403 alır', async () => {
    auth.role = 'viewer';
    expect((await call(validBody)).status).toBe(403);
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it('ekip üyesi olmayan 403 alır', async () => {
    auth.role = null;
    expect((await call(validBody)).status).toBe(403);
  });

  it('geçersiz gövde 400', async () => {
    expect((await call('{bozuk')).status).toBe(400);
    expect((await call({ task: 'script', input: {} })).status).toBe(400);
    expect((await call({ task: 'caption', input: { topic: '' } })).status).toBe(
      400,
    );
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it('anahtar tanımlı değilse 503 ve anlaşılır mesaj', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const response = await call(validBody);
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain('ANTHROPIC_API_KEY');
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it('editor öneri alır', async () => {
    const response = await call(validBody);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      task: 'caption',
      suggestion: { caption: 'Merhaba' },
    });
    expect(suggestMock).toHaveBeenCalledWith(
      expect.objectContaining({ task: 'caption' }),
      expect.objectContaining({ model: 'claude-opus-5-5' }),
    );
  });

  it('kullanıcı başına dakikada 10 istekten sonra 429 + Retry-After', async () => {
    for (let i = 0; i < 10; i++) {
      expect((await call(validBody)).status).toBe(200);
    }
    const limited = await call(validBody);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('AI hatası kullanıcı mesajı ve doğru durum koduyla döner', async () => {
    suggestMock.mockRejectedValue(new AiError('invalid_output'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const response = await call(validBody);
    expect(response.status).toBe(502);
    expect((await response.json()).error).toBe(
      new AiError('invalid_output').message,
    );
    warn.mockRestore();
  });

  it('beklenmeyen hatada iç ayrıntı sızmaz', async () => {
    suggestMock.mockRejectedValue(new Error('sk-ant-gizli iç hata'));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await call(validBody);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('sk-ant');
    error.mockRestore();
  });
});
