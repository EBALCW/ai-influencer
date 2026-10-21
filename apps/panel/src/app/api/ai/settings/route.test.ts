// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
const state = vi.hoisted(() => ({
  role: 'owner',
  writes: vi.fn(),
  read: vi.fn(),
}));
vi.mock('@/lib/auth-api', async (original) => ({
  ...(await original<typeof import('@/lib/auth-api')>()),
  requireApiRole: async (minimum: string) =>
    state.role === 'guest'
      ? {
          ok: false,
          response: Response.json({ error: 'login' }, { status: 401 }),
        }
      : minimum === 'owner' && state.role !== 'owner'
        ? {
            ok: false,
            response: Response.json({ error: 'owner' }, { status: 403 }),
          }
        : { ok: true, role: state.role, user: { id: 'owner' } },
}));
vi.mock('@/lib/ai/config', () => ({ readAiSettings: state.read }));
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({ upsert: state.writes }),
  }),
}));
const { GET, PUT } = await import('./route');
const config = {
  model: 'claude-fixture',
  pricing: {
    currency: 'USD',
    inputPerMTok: '4',
    outputPerMTok: '20',
    cacheReadPerMTok: '0.2',
    cacheWritePerMTok: '5',
    cacheWrite1hPerMTok: '8',
  },
};
const call = (data: unknown = config) =>
  PUT(
    new Request('http://localhost/api/ai/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  );
beforeEach(() => {
  state.role = 'owner';
  state.writes.mockReset().mockResolvedValue({ error: null });
  state.read.mockReset().mockResolvedValue(config);
  vi.stubEnv('ANTHROPIC_API_KEY', 'fixture-secret');
});
describe('AI settings API', () => {
  it('yalnız owner model/fiyat kaydeder; audit alanları alınmaz', async () => {
    expect((await call({ ...config, created_by: 'injected' })).status).toBe(
      200,
    );
    expect(state.writes).toHaveBeenCalledWith(
      { key: 'ai', value: config },
      { onConflict: 'key' },
    );
  });
  it.each(['editor', 'viewer'])('%s ayar değiştiremez', async (role) => {
    state.role = role;
    expect((await call()).status).toBe(403);
    expect(state.writes).not.toHaveBeenCalled();
  });
  it('guest 401', async () => {
    state.role = 'guest';
    expect((await call()).status).toBe(401);
    expect((await GET()).status).toBe(401);
  });
  it('anahtarı response içine koymaz; viewer için enabled false', async () => {
    state.role = 'viewer';
    const r = await GET();
    const d = await r.json();
    expect(d).toMatchObject({ enabled: false, canEdit: false, hasKey: true });
    expect(JSON.stringify(d)).not.toContain('fixture-secret');
  });
  it('anahtar yoksa öneri devre dışı', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    expect(await (await GET()).json()).toMatchObject({ enabled: false });
  });
  it('negatif fiyat veya geçersiz model 400', async () => {
    expect(
      (await call({ ...config, model: 'https://attacker.invalid' })).status,
    ).toBe(400);
    expect(
      (
        await call({
          ...config,
          pricing: { ...config.pricing, inputPerMTok: '-1' },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call({
          ...config,
          pricing: { ...config.pricing, inputPerMTok: '1.12345' },
        })
      ).status,
    ).toBe(400);
  });
  it('DB yazma hatası başarı dönmez', async () => {
    state.writes.mockResolvedValue({ error: { message: 'private' } });
    expect((await call()).status).toBe(500);
  });
});
