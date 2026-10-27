// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const state = vi.hoisted(() => ({
  role: 'editor' as string,
  update: vi.fn(),
  eq: vi.fn(),
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
    from: () => ({
      update: (values: unknown) => {
        state.update(values);
        return {
          eq: (column: string, value: string) => {
            state.eq(column, value);
            return {
              select: () => ({ maybeSingle: async () => state.result }),
            };
          },
        };
      },
    }),
  }),
}));

const { PATCH } = await import('./route');

const POST_ID = '30000000-0000-4000-8000-000000000001';
const call = (body: unknown, postId = POST_ID) =>
  PATCH(
    new Request(`http://localhost/api/posts/${postId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ postId }) },
  );

beforeEach(() => {
  state.role = 'editor';
  state.update.mockReset();
  state.eq.mockReset();
  state.result = {
    data: { id: POST_ID, sound_type: 'trend' },
    error: null,
  };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('PATCH /api/posts/[postId] (ses türü)', () => {
  it('editor ses türünü kaydeder; yalnız sound_type yazılır', async () => {
    const response = await call({ soundType: 'trend' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: POST_ID, soundType: 'trend' });
    expect(state.update).toHaveBeenCalledWith({ sound_type: 'trend' });
    expect(state.eq).toHaveBeenCalledWith('id', POST_ID);
  });
  it('null ile temizlenir', async () => {
    state.result = { data: { id: POST_ID, sound_type: null }, error: null };
    expect((await call({ soundType: null })).status).toBe(200);
    expect(state.update).toHaveBeenCalledWith({ sound_type: null });
  });
  it('viewer yazamaz (403), oturumsuz 401', async () => {
    state.role = 'viewer';
    expect((await call({ soundType: 'trend' })).status).toBe(403);
    state.role = 'guest';
    expect((await call({ soundType: 'trend' })).status).toBe(401);
    expect(state.update).not.toHaveBeenCalled();
  });
  it('bilinmeyen değer veya ek alan 400 (başka sütun yazılamaz)', async () => {
    expect((await call({ soundType: 'viral' })).status).toBe(400);
    expect((await call({ soundType: 'trend', account_id: 'x' })).status).toBe(
      400,
    );
    expect(state.update).not.toHaveBeenCalled();
  });
  it('geçersiz id veya görünmeyen post 404', async () => {
    expect((await call({ soundType: 'trend' }, 'abc')).status).toBe(404);
    state.result = { data: null, error: null };
    expect((await call({ soundType: 'trend' })).status).toBe(404);
  });
  it('veritabanı hatası ayrıntı sızdırmaz', async () => {
    state.result = { data: null, error: { message: 'private detail' } };
    const response = await call({ soundType: 'trend' });
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('private');
  });
});
