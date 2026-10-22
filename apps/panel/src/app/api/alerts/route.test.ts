// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const ALERT_ID = '50000000-0000-4000-8000-000000000001';

const state = vi.hoisted(() => ({
  role: 'viewer' as string,
  rows: [] as unknown[],
  listError: null as { message: string } | null,
  unread: 0,
  existing: null as unknown,
  rpc: vi.fn(),
  limit: vi.fn(),
}));

vi.mock('@/lib/auth-api', async (original) => ({
  ...(await original<typeof import('@/lib/auth-api')>()),
  requireApiRole: async () =>
    state.role === 'guest'
      ? {
          ok: false,
          response: Response.json({ error: 'login' }, { status: 401 }),
        }
      : state.role === 'outsider'
        ? {
            ok: false,
            response: Response.json({ error: 'team' }, { status: 403 }),
          }
        : { ok: true, role: state.role, user: { id: 'user-1' } },
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async (n: number) => {
            state.limit(n);
            return { data: state.rows, error: state.listError };
          },
        }),
        eq: () => ({
          maybeSingle: async () => ({ data: state.existing, error: null }),
        }),
      }),
    }),
    rpc: async (name: string, args?: unknown) => {
      state.rpc(name, args);
      if (name === 'unread_alert_count')
        return { data: state.unread, error: null };
      return { data: 1, error: null };
    },
  }),
}));

const { GET } = await import('./route');
const { POST: READ } = await import('./[id]/read/route');
const { POST: READ_ALL } = await import('./read-all/route');

const read = (id: string) =>
  READ(
    new Request(`http://localhost/api/alerts/${id}/read`, { method: 'POST' }),
    {
      params: Promise.resolve({ id }),
    },
  );

beforeEach(() => {
  state.role = 'viewer';
  state.listError = null;
  state.unread = 1;
  state.existing = { id: ALERT_ID };
  state.rpc.mockReset();
  state.limit.mockReset();
  state.rows = [
    {
      id: ALERT_ID,
      type: 'viral_post',
      payload: { views: 9600 },
      created_at: '2026-10-22T09:00:00Z',
      influencers: { name: 'Demo Creator', slug: 'demo-creator' },
      alert_reads: [],
    },
    {
      id: '50000000-0000-4000-8000-000000000002',
      type: 'sync_failed',
      payload: null,
      created_at: '2026-10-21T09:00:00Z',
      influencers: null,
      alert_reads: [{ read_at: '2026-10-22T10:00:00Z' }],
    },
  ];
});

describe('GET /api/alerts', () => {
  it('viewer listeyi ve kişi başı okunmamış sayısını alır', async () => {
    const response = await GET(new Request('http://localhost/api/alerts'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.unread).toBe(1);
    expect(body.alerts).toEqual([
      {
        id: ALERT_ID,
        type: 'viral_post',
        payload: { views: 9600 },
        createdAt: '2026-10-22T09:00:00Z',
        read: false,
        influencer: { name: 'Demo Creator', slug: 'demo-creator' },
      },
      expect.objectContaining({ read: true, payload: {}, influencer: null }),
    ]);
    expect(state.limit).toHaveBeenCalledWith(20);
  });

  it('limit doğrulanır', async () => {
    expect(
      (await GET(new Request('http://localhost/api/alerts?limit=500'))).status,
    ).toBe(400);
    expect(
      (await GET(new Request('http://localhost/api/alerts?limit=abc'))).status,
    ).toBe(400);
    await GET(new Request('http://localhost/api/alerts?limit=5'));
    expect(state.limit).toHaveBeenCalledWith(5);
  });

  it('misafir 401, ekip dışı 403', async () => {
    state.role = 'guest';
    expect((await GET(new Request('http://localhost/api/alerts'))).status).toBe(
      401,
    );
    state.role = 'outsider';
    expect((await GET(new Request('http://localhost/api/alerts'))).status).toBe(
      403,
    );
  });

  it('veritabanı hatası iç ayrıntıyı sızdırmaz', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    state.listError = { message: 'private detail' };
    const response = await GET(new Request('http://localhost/api/alerts'));
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(
      'private detail',
    );
  });
});

describe('POST /api/alerts/[id]/read', () => {
  it.each(['viewer', 'editor', 'owner'])(
    '%s okundu işaretleyebilir (200)',
    async (role) => {
      state.role = role;
      const response = await read(ALERT_ID);
      expect(response.status).toBe(200);
      expect(state.rpc).toHaveBeenCalledWith('mark_alerts_read', {
        p_alert_ids: [ALERT_ID],
      });
    },
  );

  it('geçersiz id 400, görünmeyen/olmayan uyarı 404', async () => {
    expect((await read('../../team')).status).toBe(400);
    state.existing = null;
    expect((await read(ALERT_ID)).status).toBe(404);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('misafir 401, ekip dışı 403', async () => {
    state.role = 'guest';
    expect((await read(ALERT_ID)).status).toBe(401);
    state.role = 'outsider';
    expect((await read(ALERT_ID)).status).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });
});

describe('POST /api/alerts/read-all', () => {
  it('viewer tümünü okundu işaretler', async () => {
    const response = await READ_ALL();
    expect(response.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith('mark_alerts_read', {});
  });

  it('ekip dışı 403', async () => {
    state.role = 'outsider';
    expect((await READ_ALL()).status).toBe(403);
  });
});
