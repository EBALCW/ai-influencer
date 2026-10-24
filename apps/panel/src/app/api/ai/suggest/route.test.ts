// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  user: { id: 'editor' } as { id: string } | null,
  role: 'editor' as string | null,
  inf: true,
  prompt: true,
  billingError: false,
  config: true,
  rows: [] as Record<string, unknown>[],
  create: vi.fn(),
  category: '',
  key: '',
  promptError: false,
}));
const pricing = {
  currency: 'USD',
  inputPerMTok: '4',
  outputPerMTok: '20',
  cacheReadPerMTok: '0.2',
  cacheWritePerMTok: '5',
  cacheWrite1hPerMTok: '8',
};
vi.mock('@/lib/ai/config', () => ({
  getAiConfig: async () =>
    state.config
      ? { apiKey: 'fixture-key', model: 'claude-fixture', pricing }
      : null,
}));
vi.mock('@/lib/ai/claude', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/claude')>()),
  createClaudeClient: () => ({ beta: { messages: { create: state.create } } }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: state.user }, error: null }),
    },
    from: (table: string) => {
      const chain = {
        select: () => chain,
        eq: (key: string, value: string) => {
          if (key === 'category') state.category = value;
          if (key === 'key') state.key = value;
          return chain;
        },
        or: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({
          data:
            table === 'team_members'
              ? state.role
                ? { role: state.role }
                : null
              : table === 'influencers'
                ? state.inf
                  ? { id: 'e1000000-0000-4000-8000-000000000001' }
                  : null
                : state.prompt
                  ? { id: 'p1', version: 2, body: 'Kütüphane talimatı' }
                  : null,
          error:
            table === 'prompts' && state.promptError
              ? { message: 'private' }
              : null,
        }),
        insert: (values: Record<string, unknown>) => {
          state.rows.push(values);
          return {
            select: () => ({
              single: async () => ({
                data: { id: 'cost-1' },
                error: state.billingError ? { message: 'private' } : null,
              }),
            }),
          };
        },
      };
      return chain;
    },
    rpc: async () => ({
      data: {
        from: '2026-11-01',
        to: '2026-11-08',
        observedViewIncrease: 42,
        postsWithViewBaseline: 1,
      },
      error: null,
    }),
  }),
}));
const { POST } = await import('./route');
const { aiRateLimiter } = await import('@/lib/ai/rate-limit');
const body = {
  influencerId: 'e1000000-0000-4000-8000-000000000001',
  request: {
    task: 'caption',
    input: {
      persona: { name: 'Fixture', niche: 'Teknoloji' },
      topic: 'Sekmeler',
    },
  },
};
const call = (value: unknown = body) =>
  POST(
    new Request('http://localhost/api/ai/suggest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(value),
    }) as NextRequest,
  );
beforeEach(() => {
  state.user = { id: 'editor' };
  state.role = 'editor';
  state.inf = true;
  state.prompt = true;
  state.promptError = false;
  state.category = '';
  state.key = '';
  state.billingError = false;
  state.config = true;
  state.rows = [];
  state.create.mockReset();
  state.create.mockResolvedValue({
    model: 'claude-fixture',
    stop_reason: 'end_turn',
    usage: { input_tokens: 1000, output_tokens: 1000 },
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          caption: 'Merhaba',
          hashtags: ['#ai', '#teknoloji', '#kurgu'],
          cta: 'Sen?',
        }),
      },
    ],
  });
  aiRateLimiter.reset();
});
describe('AI route, SDK → maliyet entegrasyonu', () => {
  it('oturum yok 401, viewer/outsider 403; sağlayıcı çağrılmaz', async () => {
    state.user = null;
    expect((await call()).status).toBe(401);
    state.user = { id: 'viewer' };
    state.role = 'viewer';
    expect((await call()).status).toBe(403);
    state.role = null;
    expect((await call()).status).toBe(403);
    expect(state.create).not.toHaveBeenCalled();
  });
  it('geçersiz/eksik UUID ve girdi 400', async () => {
    expect((await call({ request: body.request })).status).toBe(400);
    expect((await call({ ...body, influencerId: 'x' })).status).toBe(400);
    expect(
      (await call({ ...body, request: { task: 'caption', input: {} } })).status,
    ).toBe(400);
  });
  it('ayar yoksa 503, hesap yoksa 404; çağrı yok', async () => {
    state.config = false;
    expect((await call()).status).toBe(503);
    state.config = true;
    state.inf = false;
    expect((await call()).status).toBe(404);
    expect(state.create).not.toHaveBeenCalled();
  });
  it('kütüphanede ai-caption yoksa yerleşik talimata düşer', async () => {
    state.prompt = false;
    const r = await call();
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ promptId: 'builtin:caption@1' });
    expect(state.create.mock.calls[0]![0].system).not.toContain(
      'Kütüphane talimatı',
    );
  });
  it('prompt okuma hatası yutulmaz: 500, sağlayıcı çağrılmaz', async () => {
    state.promptError = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await call()).status).toBe(500);
    expect(state.create).not.toHaveBeenCalled();
    warn.mockRestore();
  });
  it('prompt kütüphanesinden önerir ve maliyeti costs modülüne yazar', async () => {
    const r = await call();
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({
      task: 'caption',
      promptId: 'prompt:p1@2',
    });
    expect(state.create.mock.calls[0]![0].system).toContain(
      'Kütüphane talimatı',
    );
    expect(state.category).toBe('caption');
    expect(state.key).toBe('ai-caption');
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0]).toMatchObject({
      category: 'ai_api',
      amount: '0.0240',
      currency: 'USD',
      influencer_id: body.influencerId,
    });
    expect(state.rows[0]).not.toHaveProperty('created_by');
  });
  it('bozuk model çıktısı 502 olsa da kullanım maliyeti kaydedilir', async () => {
    state.create.mockResolvedValue({
      model: 'claude-fixture',
      stop_reason: 'end_turn',
      usage: { input_tokens: 1000, output_tokens: 1000 },
      content: [{ type: 'text', text: 'invalid JSON' }],
    });
    expect((await call()).status).toBe(502);
    expect(state.rows).toHaveLength(1);
  });
  it('maliyet yazılamazsa öneriyi başarı diye sunmaz', async () => {
    state.billingError = true;
    const r = await call();
    expect(r.status).toBe(503);
    expect((await r.json()).error).toContain('maliyeti');
  });
  it('haftalık görevde yalnız RPC sayısal özeti gönderilir', async () => {
    await call({
      ...body,
      request: { task: 'weekly', input: { language: 'tr' } },
    });
    const params = state.create.mock.calls[0]![0];
    expect(params.messages[0].content).toContain('observedViewIncrease');
    expect(params.messages[0].content).not.toContain('token_ref');
    expect(state.category).toBe('research');
    expect(state.key).toBe('ai-weekly');
  });
  it('10/dk sınırı 429 ve Retry-After verir', async () => {
    for (let i = 0; i < 10; i++) expect((await call()).status).toBe(200);
    const r = await call();
    expect(r.status).toBe(429);
    expect(Number(r.headers.get('Retry-After'))).toBeGreaterThan(0);
    expect(state.create).toHaveBeenCalledTimes(10);
  });
  it('beklenmeyen hata metni loga veya cevaba sızmaz', async () => {
    state.create.mockRejectedValue(new Error('sk-ant-private'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const r = await call();
    expect(JSON.stringify(await r.json())).not.toContain('sk-ant-private');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('sk-ant-private');
    warn.mockRestore();
  });
});

it.each([
  [
    'persona',
    { name: 'Fixture', niche: 'Teknoloji' },
    {
      bio: 'AI karakteri',
      personality: ['sakin', 'meraklı', 'neşeli'],
      tone: {
        do: ['Açık ol', 'Kısa konuş', 'Soru sor'],
        dont: ['Abartma', 'Taklit etme', 'Vaat verme'],
      },
      sampleCaptions: ['Bir', 'İki', 'Üç'],
      hookTraits: ['İmza aksesuar', 'Dönüşüm'],
    },
  ],
  [
    'script',
    { topic: 'Kısa sahne', durationSeconds: 30 },
    {
      hook: 'Kanca',
      scenes: [{ seconds: 10, visual: 'Sahne', narration: 'Metin' }],
      caption: 'Caption',
    },
  ],
  [
    'weekly',
    { language: 'tr' },
    {
      summary: 'Özet',
      observations: ['Ölçülen veri'],
      suggestions: ['Yeni test'],
      limitations: ['Baseline eksik'],
    },
  ],
] as const)(
  '%s görevi geçerli öneri ve tek maliyet satırı üretir',
  async (task, input, suggestion) => {
    state.create.mockResolvedValue({
      model: 'claude-fixture',
      stop_reason: 'end_turn',
      usage: { input_tokens: 1000, output_tokens: 1000 },
      content: [{ type: 'text', text: JSON.stringify(suggestion) }],
    });
    const r = await call({ ...body, request: { task, input } });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ task });
    expect(state.rows).toHaveLength(1);
  },
);
it('istenen süreyi aşan senaryo reddedilir ve maliyeti kalır', async () => {
  state.create.mockResolvedValue({
    model: 'claude-fixture',
    stop_reason: 'end_turn',
    usage: { input_tokens: 1000, output_tokens: 1000 },
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          hook: 'Kanca',
          scenes: [{ seconds: 10, visual: 'Sahne', narration: 'Metin' }],
          caption: 'Caption',
        }),
      },
    ],
  });
  expect(
    (
      await call({
        ...body,
        request: {
          task: 'script',
          input: { topic: 'Sahne', durationSeconds: 5 },
        },
      })
    ).status,
  ).toBe(502);
  expect(state.rows).toHaveLength(1);
});
