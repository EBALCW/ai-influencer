// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const state = vi.hoisted(() => ({
  role: 'owner' as string,
  upsert: vi.fn(),
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
        : { ok: true, role: state.role, user: { id: 'owner' } },
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({ upsert: state.upsert }),
  }),
}));

const { PUT } = await import('./route');

const valid = {
  stuckViews: 500,
  stuckWithinHours: 1,
  viralMultiplier: 2.5,
  baselinePosts: 10,
};
const call = (body: unknown) =>
  PUT(
    new Request('http://localhost/api/analytics/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  state.role = 'owner';
  state.upsert.mockReset().mockResolvedValue({ error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('PUT /api/analytics/settings', () => {
  it('owner eşikleri kaydeder; audit alanı alınmaz', async () => {
    expect((await call({ ...valid, created_by: 'injected' })).status).toBe(200);
    expect(state.upsert).toHaveBeenCalledWith(
      { key: 'analytics', value: valid },
      { onConflict: 'key' },
    );
  });
  it.each(['editor', 'viewer'])('%s eşik değiştiremez', async (role) => {
    state.role = role;
    expect((await call(valid)).status).toBe(403);
    expect(state.upsert).not.toHaveBeenCalled();
  });
  it('oturumsuz 401', async () => {
    state.role = 'guest';
    expect((await call(valid)).status).toBe(401);
  });
  it('geçersiz eşik 400', async () => {
    for (const body of [
      { ...valid, stuckViews: -1 },
      { ...valid, stuckWithinHours: 24 },
      { ...valid, viralMultiplier: 1 },
      { ...valid, baselinePosts: 100 },
    ])
      expect((await call(body)).status).toBe(400);
    expect(state.upsert).not.toHaveBeenCalled();
  });
  it('veritabanı CHECK ihlali 400, diğer hata 500', async () => {
    state.upsert.mockResolvedValue({
      error: { code: '23514', message: 'check' },
    });
    expect((await call(valid)).status).toBe(400);
    state.upsert.mockResolvedValue({ error: { message: 'private' } });
    expect((await call(valid)).status).toBe(500);
  });
});
