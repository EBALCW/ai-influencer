// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const state = vi.hoisted(() => ({
  role: 'editor' as string,
  rpc: vi.fn(),
  result: { data: null, error: null } as {
    data: unknown;
    error: { code?: string; message: string } | null;
  },
}));

const rank: Record<string, number> = { viewer: 0, editor: 1, owner: 2 };
vi.mock('@/lib/auth-api', async (original) => ({
  ...(await original<typeof import('@/lib/auth-api')>()),
  requireApiRole: async (minimum: string) =>
    state.role === 'guest'
      ? {
          ok: false,
          response: Response.json({ error: 'login' }, { status: 401 }),
        }
      : rank[state.role]! < rank[minimum]!
        ? {
            ok: false,
            response: Response.json({ error: 'role' }, { status: 403 }),
          }
        : { ok: true, role: state.role, user: { id: 'user-1' } },
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    rpc: async (name: string, args: unknown) => {
      state.rpc(name, args);
      return state.result;
    },
  }),
}));

const { POST } = await import('./route');

const POST_ID = '30000000-0000-4000-8000-000000000001';
const ROW_ID = '40000000-0000-4000-8000-000000000001';
const valid = {
  targetHours: 24,
  views: 1200,
  likes: 90,
  comments: 7,
  shares: 3,
};

const call = (body: unknown, postId = POST_ID) =>
  POST(
    new Request(`http://localhost/api/posts/${postId}/manual-metrics`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ postId }) },
  );

beforeEach(() => {
  state.role = 'editor';
  state.rpc.mockReset();
  state.result = { data: { status: 'created', id: ROW_ID }, error: null };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/posts/[postId]/manual-metrics', () => {
  it('oturum yoksa 401, viewer 403; RPC çağrılmaz', async () => {
    state.role = 'guest';
    expect((await call(valid)).status).toBe(401);
    state.role = 'viewer';
    expect((await call(valid)).status).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('geçersiz sayı, kontrol noktası, oran ve bozuk JSON 400', async () => {
    const bad = [
      { ...valid, views: -1 },
      { ...valid, likes: 1.5 },
      { ...valid, comments: '7' },
      { ...valid, shares: undefined },
      { ...valid, targetHours: 6 },
      { ...valid, targetHours: undefined },
      { ...valid, completionRate: 1.2 },
      { ...valid, avgWatchTimeS: -3 },
      { ...valid, saves: 'x' },
    ];
    for (const body of bad) expect((await call(body)).status).toBe(400);
    expect((await call('{')).status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('geçersiz post id 404', async () => {
    expect((await call(valid, 'abc')).status).toBe(404);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('editor kaydeder (201); boş isteğe bağlı alanlar gönderilmez', async () => {
    const response = await call({ ...valid, saves: null, avgWatchTimeS: 8.5 });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      result: 'created',
      id: ROW_ID,
    });
    expect(state.rpc).toHaveBeenCalledWith('record_manual_metrics', {
      p_post_id: POST_ID,
      p_target_hours: 24,
      p_views: 1200,
      p_likes: 90,
      p_comments: 7,
      p_shares: 3,
      p_avg_watch_time_s: 8.5,
    });
  });

  it('kontrol noktası null → ad-hoc ölçüm, p_target_hours gönderilmez', async () => {
    expect((await call({ ...valid, targetHours: null })).status).toBe(201);
    expect(state.rpc.mock.calls[0]![1]).not.toHaveProperty('p_target_hours');
  });

  it('önceki elle giriş düzeltilir (200)', async () => {
    state.result = { data: { status: 'updated', id: ROW_ID }, error: null };
    const response = await call({ ...valid, completionRate: 0.42 });
    expect(response.status).toBe(200);
    expect(state.rpc.mock.calls[0]![1]).toMatchObject({
      p_completion_rate: 0.42,
    });
  });

  it('API ölçümü olan noktada çakışma 409 (üzerine yazılmaz)', async () => {
    state.result = { data: { status: 'conflict', id: ROW_ID }, error: null };
    const response = await call(valid);
    expect(response.status).toBe(409);
    expect((await response.json()).message).toMatch(/üzerine yazılmaz/);
  });

  it('veritabanı hataları: RLS 403, post yok 404, gelecek nokta 422, CHECK 400, yarış 409', async () => {
    const cases: Array<[string, number]> = [
      ['42501', 403],
      ['P0002', 404],
      ['22023', 422],
      ['23514', 400],
      ['23505', 409],
    ];
    for (const [code, status] of cases) {
      state.result = { data: null, error: { code, message: 'db' } };
      expect((await call(valid)).status).toBe(status);
    }
  });

  it('beklenmeyen RPC yanıtı 500, ayrıntı sızmaz', async () => {
    state.result = { data: 'garip', error: null };
    const response = await call(valid);
    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe('İşlem tamamlanamadı.');
  });
});
