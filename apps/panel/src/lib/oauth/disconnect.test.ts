import { beforeEach, describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({
  auth: vi.fn(),
  db: vi.fn(),
  admin: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock('../auth-api', () => ({ requireApiRole: m.auth }));
vi.mock('../supabase/server', () => ({ createSupabaseServerClient: m.db }));
vi.mock('../supabase/admin', () => ({ createSupabaseAdminClient: m.admin }));
vi.mock('./providers', async (original) => ({
  ...(await original<typeof import('./providers')>()),
  revokeToken: m.revoke,
}));
import { disconnectOAuth } from './disconnect';
const id = '33333333-3333-4333-8333-333333333333',
  inf = '22222222-2222-4222-8222-222222222222',
  nonce = '44444444-4444-4444-8444-444444444444';
const request = (origin = 'http://localhost:3000') =>
  new NextRequest(
    `http://localhost:3000/api/social-accounts/${id}/disconnect`,
    { method: 'POST', headers: { origin } },
  );
function setup(
  raw: unknown = { nonce, token: { access_token: 'private-secret' } },
  error: unknown = null,
) {
  const replies = [
    { data: { id, platform: 'youtube', influencer_id: inf }, error: null },
    { data: { slug: 'fixture' }, error: null },
  ];
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.maybeSingle.mockImplementation(async () => replies.shift());
  chain.single.mockImplementation(async () => replies.shift());
  m.db.mockResolvedValue({ from: () => chain });
  const rpc = vi
    .fn()
    .mockResolvedValueOnce({ data: raw, error })
    .mockResolvedValueOnce({ data: true, error: null });
  m.admin.mockReturnValue({ rpc });
  return rpc;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('GOOGLE_CLIENT_ID', 'id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');
  vi.stubEnv('OAUTH_REDIRECT_BASE', 'http://localhost:3000');
  m.auth.mockResolvedValue({ ok: true, user: { id: inf }, role: 'editor' });
  m.revoke.mockResolvedValue(undefined);
});
describe('disconnect', () => {
  it('yetki ve origin kontrolü', async () => {
    m.auth.mockResolvedValueOnce({
      ok: false,
      response: new Response(null, { status: 403 }),
    });
    expect((await disconnectOAuth(request(), id)).status).toBe(403);
    expect(
      (await disconnectOAuth(request('https://evil.invalid'), id)).status,
    ).toBe(403);
    expect(m.admin).not.toHaveBeenCalled();
  });
  it('önce sağlayıcı revoke, sonra Vault temizliği; hesap geçmişi silinmez', async () => {
    const rpc = setup();
    const result = await disconnectOAuth(request(), id);
    expect(result.status).toBe(303);
    expect(m.revoke).toHaveBeenCalled();
    expect(rpc).toHaveBeenNthCalledWith(2, 'oauth_revoke_finish', {
      p_account_id: id,
      p_nonce: nonce,
    });
    expect(m.revoke.mock.invocationCallOrder[0]).toBeLessThan(
      rpc.mock.invocationCallOrder[1]!,
    );
  });
  it('sağlayıcı hatasında sır saklanır ve detay sızmaz', async () => {
    const rpc = setup();
    m.revoke.mockRejectedValue(new Error('private-secret'));
    const result = await disconnectOAuth(request(), id);
    expect(result.status).toBe(500);
    expect(await result.text()).not.toContain('private-secret');
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('kilitli hesapta ve bozuk token paketinde sağlayıcı çağrılmaz', async () => {
    setup(null, { message: 'private-secret' });
    expect((await disconnectOAuth(request(), id)).status).toBe(409);
    expect(m.revoke).not.toHaveBeenCalled();
    setup({});
    expect((await disconnectOAuth(request(), id)).status).toBe(500);
    expect(m.revoke).not.toHaveBeenCalled();
  });
  it('zaten temizlenmiş bağlantı idempotent', async () => {
    const rpc = setup(null);
    expect((await disconnectOAuth(request(), id)).status).toBe(303);
    expect(m.revoke).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
