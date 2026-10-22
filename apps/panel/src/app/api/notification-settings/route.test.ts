// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const state = vi.hoisted(() => ({
  role: 'editor' as string,
  update: vi.fn(),
  updateResult: { data: { id: true }, error: null } as {
    data: unknown;
    error: { code?: string; message: string } | null;
  },
  row: null as unknown,
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
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: state.row, error: null }),
        }),
      }),
      update: (values: unknown) => {
        state.update(values);
        return {
          eq: () => ({
            select: () => ({ maybeSingle: async () => state.updateResult }),
          }),
        };
      },
    }),
  }),
}));

const { GET, PUT } = await import('./route');

const valid = {
  viralMultiplier: 3,
  followerMilestones: [10000, 1000],
  tokenExpiryDays: 7,
  channels: { ntfy: true, telegram: false, email: false },
};
const put = (body: unknown) =>
  PUT(
    new Request('http://localhost/api/notification-settings', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => {
  state.role = 'editor';
  state.update.mockReset();
  state.updateResult = { data: { id: true }, error: null };
  state.row = {
    id: true,
    viral_multiplier: 3,
    follower_milestones: [1000, 5000],
    token_expiry_days: 7,
    push_ntfy: false,
    push_telegram: false,
    push_email: true,
    created_at: '',
    updated_at: '',
    created_by: null,
  };
});

describe('GET /api/notification-settings', () => {
  it('viewer ayarları görür ama düzenleyemez', async () => {
    state.role = 'viewer';
    const body = await (await GET()).json();
    expect(body).toEqual({
      canEdit: false,
      settings: {
        viralMultiplier: 3,
        followerMilestones: [1000, 5000],
        tokenExpiryDays: 7,
        channels: { ntfy: false, telegram: false, email: true },
      },
    });
  });

  it('editor düzenleyebilir; misafir 401', async () => {
    expect((await (await GET()).json()).canEdit).toBe(true);
    state.role = 'guest';
    expect((await GET()).status).toBe(401);
  });
});

describe('PUT /api/notification-settings', () => {
  it('editor kaydeder; audit alanı ve fazladan alan yazılmaz', async () => {
    const response = await put({
      ...valid,
      created_by: 'injected',
      push_ntfy_url: 'https://evil.invalid',
    });
    expect(response.status).toBe(200);
    expect(state.update).toHaveBeenCalledWith({
      viral_multiplier: 3,
      follower_milestones: [1000, 10000],
      token_expiry_days: 7,
      push_ntfy: true,
      push_telegram: false,
      push_email: false,
    });
  });

  it('viewer 403, misafir 401 ve yazma yok', async () => {
    state.role = 'viewer';
    expect((await put(valid)).status).toBe(403);
    state.role = 'guest';
    expect((await put(valid)).status).toBe(401);
    expect(state.update).not.toHaveBeenCalled();
  });

  it('geçersiz değer ve bozuk JSON 400', async () => {
    expect((await put({ ...valid, tokenExpiryDays: 0 })).status).toBe(400);
    expect((await put({ ...valid, viralMultiplier: '3' })).status).toBe(400);
    expect(
      (
        await PUT(
          new Request('http://localhost/api/notification-settings', {
            method: 'PUT',
            body: '{',
          }),
        )
      ).status,
    ).toBe(400);
    expect(state.update).not.toHaveBeenCalled();
  });

  it('RLS satırı döndürmezse başarı dönmez; DB kısıtı 400', async () => {
    state.updateResult = { data: null, error: null };
    expect((await put(valid)).status).toBe(403);
    state.updateResult = {
      data: null,
      error: { code: '23514', message: 'check' },
    };
    expect((await put(valid)).status).toBe(400);
  });
});
