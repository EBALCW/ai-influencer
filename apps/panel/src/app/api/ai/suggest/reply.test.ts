// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

// AI yanıt önerisi (#61, görev `reply`): bağlam sunucuda okunur, yorum yazarının adı modele
// gitmez, başka influencer'ın yorumu 404, maliyet yazılır, öneri gönderilmez (yalnız taslak).
vi.mock('server-only', () => ({}));
const INF = 'e1000000-0000-4000-8000-000000000001';
const COMMENT = 'c1000000-0000-4000-8000-000000000001';
const state = vi.hoisted(() => ({
  role: 'editor' as string | null,
  commentInfluencer: 'e1000000-0000-4000-8000-000000000001',
  create: vi.fn(),
  rows: [] as Record<string, unknown>[],
  writes: [] as string[],
  key: '',
  category: '',
}));
vi.mock('@/lib/ai/config', () => ({
  getAiConfig: async () => ({
    apiKey: 'fixture-key',
    model: 'claude-fixture',
    pricing: {
      currency: 'USD',
      inputPerMTok: '4',
      outputPerMTok: '20',
      cacheReadPerMTok: '0.2',
      cacheWritePerMTok: '5',
      cacheWrite1hPerMTok: '8',
    },
  }),
}));
vi.mock('@/lib/ai/claude', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ai/claude')>()),
  createClaudeClient: () => ({ beta: { messages: { create: state.create } } }),
}));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }),
    },
    from: (table: string) => {
      const data: Record<string, unknown> = {
        team_members: state.role ? { role: state.role } : null,
        influencers: { id: INF, name: 'Fixture Karakter', niche: 'Teknoloji' },
        influencer_personas: { tone: 'Sıcak ve meraklı', bio: 'AI karakteri' },
        prompts: null,
        comments: {
          text: 'Bu videoyu nasıl çektiniz?',
          platform: 'youtube',
          posts: { caption: 'Sekmeler hakkında kısa video' },
          social_accounts: { influencer_id: state.commentInfluencer },
        },
      };
      const chain = {
        select: () => chain,
        eq: (key: string, value: string) => {
          if (table === 'prompts' && key === 'key') state.key = value;
          if (table === 'prompts' && key === 'category') state.category = value;
          return chain;
        },
        or: () => chain,
        order: () => chain,
        limit: () => chain,
        gte: () => chain,
        // Günlük sınır sayımı (costs, head: true)
        then: (ok: (r: unknown) => unknown) =>
          Promise.resolve({ data: null, count: 0, error: null }).then(ok),
        maybeSingle: async () => ({ data: data[table] ?? null, error: null }),
        insert: (values: Record<string, unknown>) => {
          state.writes.push(table);
          state.rows.push(values);
          return {
            select: () => ({
              single: async () => ({ data: { id: 'cost-1' }, error: null }),
            }),
          };
        },
        update: () => {
          state.writes.push(table);
          return chain;
        },
      };
      return chain;
    },
    rpc: async () => ({ data: null, error: null }),
  }),
}));
const { POST } = await import('./route');
const { aiRateLimiter } = await import('@/lib/ai/rate-limit');

const call = (input: unknown = { commentId: COMMENT, language: 'tr' }) =>
  POST(
    new Request('http://localhost/api/ai/suggest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        influencerId: INF,
        request: { task: 'reply', input },
      }),
    }) as NextRequest,
  );
const modelReturns = (reply: string) =>
  state.create.mockResolvedValue({
    model: 'claude-fixture',
    stop_reason: 'end_turn',
    usage: { input_tokens: 500, output_tokens: 100 },
    content: [{ type: 'text', text: JSON.stringify({ reply }) }],
  });

beforeEach(() => {
  state.role = 'editor';
  state.commentInfluencer = INF;
  state.rows = [];
  state.writes = [];
  state.key = '';
  state.category = '';
  state.create.mockReset();
  modelReturns('Teşekkürler! Telefonla, doğal ışıkta çektik.');
  aiRateLimiter.reset();
});

it('taslak yanıt döner; persona/yorum/caption gider, yazar adı ve hesap bilgisi gitmez', async () => {
  const r = await call();
  expect(r.status).toBe(200);
  expect(await r.json()).toMatchObject({
    task: 'reply',
    suggestion: { reply: 'Teşekkürler! Telefonla, doğal ışıkta çektik.' },
    promptId: 'builtin:reply@1',
  });
  const params = state.create.mock.calls[0]![0];
  const message = params.messages[0].content as string;
  expect(message).toContain('Bu videoyu nasıl çektiniz?');
  expect(message).toContain('Sıcak ve meraklı');
  expect(message).toContain('Sekmeler hakkında kısa video');
  expect(message).not.toContain('author');
  expect(message).not.toContain('influencer_id');
  expect(params.system).toContain('AI');
  // Yanıt sadece öneri: hiçbir yorum/yanıt tablosuna yazılmaz, yalnız maliyet satırı.
  expect(state.writes).toEqual(['costs']);
  expect(state.rows[0]).toMatchObject({ category: 'ai_api' });
});

it('prompt kütüphanesinde caption/ai-reply soyuna bakar', async () => {
  await call();
  expect(state.category).toBe('caption');
  expect(state.key).toBe('ai-reply');
});

it('başka influencer’ın yorumu 404, sağlayıcı çağrılmaz', async () => {
  state.commentInfluencer = 'e1000000-0000-4000-8000-000000000999';
  expect((await call()).status).toBe(404);
  expect(state.create).not.toHaveBeenCalled();
});

it('viewer 403; geçersiz yorum id’si 400', async () => {
  state.role = 'viewer';
  expect((await call()).status).toBe(403);
  state.role = 'editor';
  expect((await call({ commentId: 'x' })).status).toBe(400);
  expect(state.create).not.toHaveBeenCalled();
});

it('boş veya 1000 karakteri aşan öneri 502, maliyet yine yazılır', async () => {
  modelReturns('a'.repeat(1001));
  expect((await call()).status).toBe(502);
  expect(state.rows).toHaveLength(1);
});
