// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

const state = vi.hoisted(() => ({
  user: { id: 'editor-1' } as { id: string } | null,
  role: 'editor' as string | null,
  rpc: vi.fn(),
  result: { data: 'report-1', error: null } as {
    data: unknown;
    error: { code: string; message: string } | null;
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.user },
        error: state.user ? null : new Error('no session'),
      }),
    },
    from: () => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({
          data: state.role ? { role: state.role } : null,
          error: null,
        }),
      };
      return chain;
    },
    rpc: async (name: string, args: unknown) => {
      state.rpc(name, args);
      return state.result;
    },
  }),
}));

const { POST } = await import('./route');

const valid = {
  periodStart: '2026-09-07',
  influencerId: '10000000-0000-4000-8000-000000000001',
};

function call(body: unknown) {
  return POST(
    new Request('http://127.0.0.1:3000/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  state.user = { id: 'editor-1' };
  state.role = 'editor';
  state.rpc.mockReset();
  state.result = { data: 'report-1', error: null };
});

describe('POST /api/reports', () => {
  it('oturum yoksa 401, viewer 403; rapor oluşturulmaz', async () => {
    state.user = null;
    expect((await call(valid)).status).toBe(401);
    state.user = { id: 'viewer-1' };
    state.role = 'viewer';
    expect((await call(valid)).status).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('geçersiz gövde 400', async () => {
    expect((await call({ ...valid, periodStart: '07.09.2026' })).status).toBe(
      400,
    );
    expect((await call({ ...valid, influencerId: 'x' })).status).toBe(400);
    expect((await call('{')).status).toBe(400);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('tek tıkla rapor: hesaplama veritabanında, id döner', async () => {
    const response = await call(valid);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 'report-1' });
    expect(state.rpc).toHaveBeenCalledWith('generate_weekly_report', {
      p_period_start: '2026-09-07',
      p_influencer_id: valid.influencerId,
    });
  });

  it('tüm influencer raporu için influencer parametresi gönderilmez', async () => {
    await call({ periodStart: '2026-09-07', influencerId: null });
    expect(state.rpc).toHaveBeenCalledWith('generate_weekly_report', {
      p_period_start: '2026-09-07',
    });
  });

  it('veritabanı hataları anlamlı durum koduna çevrilir', async () => {
    state.result = { data: null, error: { code: '22023', message: 'x' } };
    expect((await call(valid)).status).toBe(400);
    state.result = { data: null, error: { code: 'P0002', message: 'x' } };
    expect((await call(valid)).status).toBe(404);
    state.result = { data: null, error: { code: '42501', message: 'x' } };
    expect((await call(valid)).status).toBe(403);
  });
});
