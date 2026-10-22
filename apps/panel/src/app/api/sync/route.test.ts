// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const state = vi.hoisted(() => ({
  role: 'editor' as string,
  rpc: vi.fn(),
  result: { data: 'queued', error: null } as {
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

const ACCOUNT = '0f3c2a8e-1b2c-4d5e-8f90-123456789abc';
const post = (body: unknown) =>
  POST(
    new Request('http://localhost/api/sync', {
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

beforeEach(() => {
  state.role = 'editor';
  state.rpc.mockReset();
  state.result = { data: 'queued', error: null };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/sync', () => {
  it('editor tüm hesapları kuyruğa alır (202)', async () => {
    const response = await post({});
    expect(response.status).toBe(202);
    expect((await response.json()).result).toBe('queued');
    expect(state.rpc).toHaveBeenCalledWith('request_sync', {});
  });

  it('owner tek hesap ister; hesap id RPC parametresine gider', async () => {
    state.role = 'owner';
    expect((await post({ accountId: ACCOUNT })).status).toBe(202);
    expect(state.rpc).toHaveBeenCalledWith('request_sync', {
      p_account_id: ACCOUNT,
    });
  });

  it('viewer 403, misafir 401; RPC çağrılmaz', async () => {
    state.role = 'viewer';
    expect((await post({})).status).toBe(403);
    state.role = 'guest';
    expect((await post({})).status).toBe(401);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('geçersiz gövde 400 (bozuk JSON, uuid olmayan id, fazladan alan)', async () => {
    expect((await post('{')).status).toBe(400);
    expect((await post({ accountId: 'x' })).status).toBe(400);
    expect((await post({ job: 'metrics' })).status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ['throttled', 429],
    ['not_configured', 503],
    ['not_found', 404],
  ])('RPC %s → %i', async (result, status) => {
    state.result = { data: result, error: null };
    const response = await post({});
    expect(response.status).toBe(status);
    expect((await response.json()).message).toBeTruthy();
  });

  it('veritabanı yetki reddi 403, beklenmeyen yanıt ve hata 500', async () => {
    state.result = { data: null, error: { code: '42501', message: 'no' } };
    expect((await post({})).status).toBe(403);
    state.result = { data: 'toString', error: null };
    expect((await post({})).status).toBe(500);
    state.result = { data: null, error: { message: 'boom' } };
    expect((await post({})).status).toBe(500);
  });
});
