// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const state = vi.hoisted(() => ({
  role: 'owner' as string,
  update: vi.fn(),
  eq: vi.fn(),
  rows: [{ id: 'ws-1', name: 'Yeni ad' }] as { id: string; name: string }[],
  error: null as { code: string } | null,
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
        : {
            ok: true,
            role: state.role,
            user: { id: 'owner' },
            workspaceId: 'ws-1',
          },
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    from: (table: string) => ({
      update: (values: unknown) => {
        state.update(table, values);
        return {
          eq: (column: string, value: string) => {
            state.eq(column, value);
            return {
              select: async () => ({ data: state.rows, error: state.error }),
            };
          },
        };
      },
    }),
  }),
}));

const { PATCH } = await import('./route');
const call = (body: unknown) =>
  PATCH(
    new Request('http://localhost/api/workspace', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  state.role = 'owner';
  state.update.mockReset();
  state.eq.mockReset();
  state.rows = [{ id: 'ws-1', name: 'Yeni ad' }];
  state.error = null;
});

describe('workspace API', () => {
  it('owner adı değiştirir; hedef alan oturumdan gelir, gövdeden değil', async () => {
    const response = await call({
      name: '  Yeni ad ',
      id: 'ws-2',
      workspace_id: 'ws-2',
      push_enabled: true,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, name: 'Yeni ad' });
    expect(state.update).toHaveBeenCalledWith('workspaces', {
      name: 'Yeni ad',
    });
    expect(state.eq).toHaveBeenCalledWith('id', 'ws-1');
  });

  it.each(['editor', 'viewer'])('%s değiştiremez', async (role) => {
    state.role = role;
    expect((await call({ name: 'X' })).status).toBe(403);
    expect(state.update).not.toHaveBeenCalled();
  });

  it('oturumsuz istek 401 alır', async () => {
    state.role = 'guest';
    expect((await call({ name: 'X' })).status).toBe(401);
  });

  it.each([
    { name: '' },
    { name: '   ' },
    { name: 'x'.repeat(81) },
    {},
    'bozuk',
  ])('geçersiz gövde 400: %j', async (body) => {
    expect((await call(body)).status).toBe(400);
    expect(state.update).not.toHaveBeenCalled();
  });

  it('RLS reddederse 403, satır yoksa 404 döner', async () => {
    state.error = { code: '42501' };
    expect((await call({ name: 'X' })).status).toBe(403);
    state.error = null;
    state.rows = [];
    expect((await call({ name: 'X' })).status).toBe(404);
  });
});
