// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const state = vi.hoisted(() => ({
  role: 'editor' as string,
  update: vi.fn(),
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
          eq: () => ({
            select: () => ({ maybeSingle: async () => state.result }),
          }),
        };
      },
    }),
  }),
}));

const { PATCH } = await import('./route');

const REPORT_ID = '50000000-0000-4000-8000-000000000001';
const call = (body: unknown, id = REPORT_ID) =>
  PATCH(
    new Request(`http://localhost/api/reports/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

beforeEach(() => {
  state.role = 'editor';
  state.update.mockReset();
  state.result = { data: { id: REPORT_ID, actions: ['a'] }, error: null };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('PATCH /api/reports/[id] (gelecek hafta aksiyonları)', () => {
  it('boş satırları atar, metni kırpar ve kaydeder', async () => {
    const response = await call({
      actions: ['  Soru kancasını 3 varyasyonla dene ', '', '   '],
    });
    expect(response.status).toBe(200);
    expect(state.update).toHaveBeenCalledWith({
      actions: ['Soru kancasını 3 varyasyonla dene'],
    });
  });
  it('en fazla 3 aksiyon, her biri en fazla 300 karakter', async () => {
    expect((await call({ actions: ['a', 'b', 'c', 'd'] })).status).toBe(400);
    expect((await call({ actions: ['x'.repeat(301)] })).status).toBe(400);
    expect(state.update).not.toHaveBeenCalled();
  });
  it('viewer yazamaz; ek alan (ör. summary) kabul edilmez', async () => {
    state.role = 'viewer';
    expect((await call({ actions: ['a'] })).status).toBe(403);
    state.role = 'editor';
    expect((await call({ actions: ['a'], summary: {} })).status).toBe(400);
    expect(state.update).not.toHaveBeenCalled();
  });
  it('geçersiz id veya görünmeyen rapor 404; CHECK ihlali 400', async () => {
    expect((await call({ actions: [] }, 'abc')).status).toBe(404);
    state.result = { data: null, error: null };
    expect((await call({ actions: [] })).status).toBe(404);
    state.result = { data: null, error: { code: '23514', message: 'check' } };
    expect((await call({ actions: ['a'] })).status).toBe(400);
  });
});
