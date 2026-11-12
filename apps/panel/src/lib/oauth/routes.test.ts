import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  db: vi.fn(),
  admin: vi.fn(),
  begin: vi.fn(),
  consume: vi.fn(),
  exchange: vi.fn(),
  identity: vi.fn(),
}));
vi.mock('../auth-api', () => ({ requireApiRole: mocks.auth }));
vi.mock('../supabase/server', () => ({ createSupabaseServerClient: mocks.db }));
vi.mock('../supabase/admin', () => ({
  createSupabaseAdminClient: mocks.admin,
}));
vi.mock('./store', () => ({ createOAuthStateStore: () => ({}) }));
vi.mock('./state', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./state')>()),
  beginOAuth: mocks.begin,
  consumeOAuth: mocks.consume,
}));
vi.mock('./providers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./providers')>()),
  exchangeCode: mocks.exchange,
  accountIdentity: mocks.identity,
}));
import { startOAuth, callbackOAuth } from './routes';
const inf = '22222222-2222-4222-8222-222222222222',
  uid = '11111111-1111-4111-8111-111111111111',
  state = 's'.repeat(43);
function db(rows: unknown[]) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);
  chain.maybeSingle.mockImplementation(async () => ({
    data: rows.shift(),
    error: null,
  }));
  chain.single.mockImplementation(async () => ({
    data: rows.shift(),
    error: null,
  }));
  return { from: vi.fn().mockReturnValue(chain) };
}
function callback(query = `state=${state}&code=code`, cookie = true) {
  return new NextRequest(
    `http://localhost:3000/api/oauth/youtube/callback?${query}`,
    {
      headers: cookie
        ? {
            cookie: `social_oauth_youtube=${encodeURIComponent(JSON.stringify({ state, influencerId: inf }))}`,
          }
        : {},
    },
  );
}
function start(origin = 'http://localhost:3000', value = inf) {
  return new NextRequest('http://localhost:3000/api/oauth/youtube/start', {
    method: 'POST',
    headers: { origin },
    body: new URLSearchParams({ influencerId: value }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('OAUTH_REDIRECT_BASE', 'http://localhost:3000');
  vi.stubEnv('GOOGLE_CLIENT_ID', 'id');
  vi.stubEnv('GOOGLE_CLIENT_SECRET', 'secret');
  mocks.auth.mockResolvedValue({ ok: true, user: { id: uid }, role: 'editor' });
  mocks.begin.mockResolvedValue({ state, challenge: 'challenge' });
  mocks.consume.mockResolvedValue({ influencerId: inf, verifier: 'verifier' });
  mocks.exchange.mockResolvedValue({
    access_token: 'private-access',
    refresh_token: 'private-refresh',
    scope: 'scope',
    expires_in: 3600,
  });
  mocks.identity.mockResolvedValue({ id: 'UCfixture', handle: '@fixture' });
  mocks.admin.mockReturnValue({
    rpc: vi.fn().mockResolvedValue({ error: null }),
  });
});
describe('OAuth routes', () => {
  it('oturum/yetki kontrolü sağlayıcıdan önce gelir', async () => {
    for (const status of [401, 403]) {
      mocks.auth.mockResolvedValue({
        ok: false,
        response: new Response(null, { status }),
      });
      expect((await startOAuth(start(), 'youtube')).status).toBe(status);
      expect((await callbackOAuth(callback(), 'youtube')).status).toBe(status);
    }
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it('platform ve origin ve form girdisi doğrulanır', async () => {
    expect((await startOAuth(start(), 'foo')).status).toBe(404);
    expect(
      (await startOAuth(start('https://evil.invalid'), 'youtube')).status,
    ).toBe(403);
    expect(
      (await startOAuth(start('http://localhost:3000', 'bad'), 'youtube'))
        .status,
    ).toBe(400);
    expect(mocks.begin).not.toHaveBeenCalled();
  });
  it('başlangıç yalnız kayıtlı influencer için; cookie callback yoluyla sınırlı', async () => {
    mocks.db.mockResolvedValue(db([{ id: inf }]));
    const result = await startOAuth(start(), 'youtube');
    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toContain('accounts.google.com');
    expect(result.headers.get('set-cookie')).toContain('HttpOnly');
    expect(result.headers.get('set-cookie')).toContain(
      'Path=/api/oauth/youtube/callback',
    );
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(result.headers.get('location')).not.toContain('secret');
  });
  it('eksik, yinelenen, Unicode veya uyuşmayan state token değişimi yapmaz', async () => {
    for (const req of [
      callback('code=x'),
      callback(`state=${state}&state=${state}&code=x`),
      callback('state=' + encodeURIComponent('ü'.repeat(43))),
      callback(`state=${'x'.repeat(43)}`),
      callback(undefined, false),
    ])
      expect((await callbackOAuth(req, 'youtube')).status).toBe(400);
    expect(mocks.consume).not.toHaveBeenCalled();
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it('kullanılmış state, sağlayıcı iptali ve kod tekrarı reddedilir', async () => {
    mocks.consume.mockResolvedValueOnce(null);
    expect((await callbackOAuth(callback(), 'youtube')).status).toBe(400);
    expect(
      (
        await callbackOAuth(
          callback(`state=${state}&error=access_denied`),
          'youtube',
        )
      ).status,
    ).toBe(400);
    expect(
      (await callbackOAuth(callback(`state=${state}&code=a&code=b`), 'youtube'))
        .status,
    ).toBe(400);
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it('başka influencer hesabı taşınmaz ve token yazılmaz', async () => {
    mocks.db.mockResolvedValue(
      db([
        { id: inf, slug: 'fixture' },
        { id: 'account', influencer_id: uid },
      ]),
    );
    expect((await callbackOAuth(callback(), 'youtube')).status).toBe(409);
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it('başarılı callback Vault RPC bağlamını doğrular ve iç adrese döner', async () => {
    mocks.db.mockResolvedValue(
      db([
        { id: inf, slug: 'fixture' },
        { id: 'account', influencer_id: inf },
      ]),
    );
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.admin.mockReturnValue({ rpc });
    const result = await callbackOAuth(callback(), 'youtube');
    expect(result.status).toBe(303);
    expect(result.headers.get('location')).toContain(
      '/influencers/fixture?tab=accounts',
    );
    expect(rpc).toHaveBeenCalledWith(
      'oauth_connect_token',
      expect.objectContaining({
        p_account_id: 'account',
        p_user_id: uid,
        p_influencer_id: inf,
        p_external_id: 'UCfixture',
      }),
    );
    expect(result.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(await result.text()).not.toContain('private-access');
  });
  it('Instagram callback refresh token olmadan Vault paketini yazar', async () => {
    vi.stubEnv('OAUTH_REDIRECT_BASE', 'https://panel.invalid');
    vi.stubEnv('INSTAGRAM_CLIENT_ID', 'id');
    vi.stubEnv('INSTAGRAM_CLIENT_SECRET', 'secret');
    mocks.exchange.mockResolvedValue({
      access_token: 'private-instagram',
      scope: 'instagram_business_basic',
      expires_in: 5184000,
    });
    mocks.identity.mockResolvedValue({ id: '123456789', handle: 'fixture' });
    mocks.db.mockResolvedValue(
      db([
        { id: inf, slug: 'fixture' },
        { id: 'account', influencer_id: inf },
      ]),
    );
    const rpc = vi.fn().mockResolvedValue({ error: null });
    mocks.admin.mockReturnValue({ rpc });
    const req = new NextRequest(
      `https://panel.invalid/api/oauth/instagram/callback?state=${state}&code=fixture`,
      {
        headers: {
          cookie: `social_oauth_instagram=${encodeURIComponent(JSON.stringify({ state, influencerId: inf }))}`,
        },
      },
    );
    const result = await callbackOAuth(req, 'instagram');
    expect(result.status).toBe(303);
    expect(rpc).toHaveBeenCalledWith(
      'oauth_connect_token',
      expect.objectContaining({
        p_platform: 'instagram',
        p_external_id: '123456789',
        p_token: {
          access_token: 'private-instagram',
          scope: 'instagram_business_basic',
        },
      }),
    );
    expect(result.headers.get('location')).toBe(
      'https://panel.invalid/influencers/fixture?tab=accounts&inf=fixture',
    );
    expect(result.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(result.headers.get('set-cookie')).toContain('Secure');
  });
  it('beklenmeyen hatanın içeriği, kod ve token istemciye veya loga çıkmaz', async () => {
    mocks.exchange.mockRejectedValue(new Error('private-access code secret'));
    const log = vi.spyOn(console, 'error');
    const result = await callbackOAuth(callback(), 'youtube');
    expect(result.status).toBe(500);
    expect(await result.text()).not.toContain('secret');
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
