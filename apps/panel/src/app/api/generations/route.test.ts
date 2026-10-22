// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const GEN_ID = '60000000-0000-4000-8000-000000000001';

const state = vi.hoisted(() => ({
  role: 'editor' as string,
  rpc: vi.fn(),
  result: { data: null as unknown, error: null as unknown },
}));

vi.mock('@/lib/auth-api', async (original) => ({
  ...(await original<typeof import('@/lib/auth-api')>()),
  requireApiRole: async (minimum: string) => {
    if (state.role === 'guest')
      return {
        ok: false,
        response: Response.json({ error: 'login' }, { status: 401 }),
      };
    const rank: Record<string, number> = { viewer: 0, editor: 1, owner: 2 };
    if (
      state.role === 'outsider' ||
      (rank[state.role] ?? -1) < (rank[minimum] ?? 0)
    )
      return {
        ok: false,
        response: Response.json({ error: 'role' }, { status: 403 }),
      };
    return { ok: true, role: state.role, user: { id: 'user-1' } };
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    rpc: async (name: string, args: unknown) => {
      state.rpc(name, args);
      return state.result;
    },
  }),
}));

const { POST: CANCEL } = await import('./[id]/cancel/route');
const { POST: RETRY } = await import('./[id]/retry/route');

const call = (
  handler: typeof CANCEL,
  id: string,
  body: unknown = {},
  raw?: string,
) =>
  handler(
    new Request(`http://localhost/api/generations/${id}/x`, {
      method: 'POST',
      body: raw ?? JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );

beforeEach(() => {
  state.role = 'editor';
  state.rpc.mockReset();
  state.result = { data: { id: 'new', status: 'cancelled' }, error: null };
});

describe('POST /api/generations/[id]/cancel', () => {
  it('rejects guests, viewers and outsiders without calling the database', async () => {
    for (const [role, status] of [
      ['guest', 401],
      ['viewer', 403],
      ['outsider', 403],
    ] as const) {
      state.role = role;
      expect((await call(CANCEL, GEN_ID)).status).toBe(status);
    }
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('validates the id', async () => {
    expect((await call(CANCEL, 'not-a-uuid')).status).toBe(400);
    expect((await call(CANCEL, '../x')).status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('cancels via cancel_generation', async () => {
    const res = await call(CANCEL, GEN_ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      status: 'cancelled',
      pending: false,
    });
    expect(state.rpc).toHaveBeenCalledWith('cancel_generation', {
      p_id: GEN_ID,
    });
  });

  it('reports a pending provider cancel', async () => {
    state.result = { data: { status: 'running' }, error: null };
    expect((await (await call(CANCEL, GEN_ID)).json()).pending).toBe(true);
  });

  it('maps database errors to HTTP status', async () => {
    for (const [code, status] of [
      ['55000', 409],
      ['42501', 403],
      ['P0002', 404],
    ] as const) {
      state.result = { data: null, error: { code, message: 'x' } };
      expect((await call(CANCEL, GEN_ID)).status).toBe(status);
    }
    state.result = { data: null, error: { code: 'XX000', message: 'secret' } };
    const res = await call(CANCEL, GEN_ID);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret');
  });
});

describe('POST /api/generations/[id]/retry', () => {
  it('viewer cannot retry', async () => {
    state.role = 'viewer';
    expect((await call(RETRY, GEN_ID)).status).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('creates a new queued row via retry_generation', async () => {
    const res = await call(RETRY, GEN_ID);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true, id: 'new' });
    expect(state.rpc).toHaveBeenCalledWith('retry_generation', {
      p_id: GEN_ID,
      p_override_budget: false,
    });
  });

  it('rejects malformed bodies', async () => {
    expect((await call(RETRY, GEN_ID, undefined, '{')).status).toBe(400);
    expect((await call(RETRY, GEN_ID, { overrideBudget: 'yes' })).status).toBe(
      400,
    );
  });

  it('budget exceeded → 402; only owners may approve', async () => {
    state.result = {
      data: null,
      error: { code: 'P0001', message: 'x', hint: 'budget_exceeded' },
    };
    const res = await call(RETRY, GEN_ID);
    expect(res.status).toBe(402);
    expect((await res.json()).error).toMatch(/owner onayı/);

    state.rpc.mockReset();
    expect((await call(RETRY, GEN_ID, { overrideBudget: true })).status).toBe(
      403,
    );
    expect(state.rpc).not.toHaveBeenCalled();

    state.role = 'owner';
    state.result = { data: { id: 'approved' }, error: null };
    expect((await call(RETRY, GEN_ID, { overrideBudget: true })).status).toBe(
      201,
    );
    expect(state.rpc).toHaveBeenCalledWith('retry_generation', {
      p_id: GEN_ID,
      p_override_budget: true,
    });
  });

  it('a running or succeeded job cannot be retried (409)', async () => {
    state.result = { data: null, error: { code: '55000', message: 'x' } };
    expect((await call(RETRY, GEN_ID)).status).toBe(409);
  });
});
