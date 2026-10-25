import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  providerConfig,
  authorizationUrl,
  exchangeCode,
  accountIdentity,
  revokeToken,
  SCOPES,
} from './providers';
const cfg = providerConfig('instagram', {
  INSTAGRAM_CLIENT_ID: 'fixture-id',
  INSTAGRAM_CLIENT_SECRET: 'private-secret',
  OAUTH_REDIRECT_BASE: 'https://panel.invalid',
  INSTAGRAM_GRAPH_VERSION: 'v23.0',
});
const short = {
  access_token: 'short-secret',
  user_id: '123456789',
  permissions: SCOPES.instagram,
};
const long = {
  access_token: 'long-secret',
  token_type: 'bearer',
  expires_in: 5184000,
};
const identity = { user_id: '123456789', username: 'fixture' };
function fake(...bodies: unknown[]) {
  return vi
    .fn()
    .mockImplementation(
      async () => new Response(JSON.stringify(bodies.shift()), { status: 200 }),
    );
}
describe('Instagram Login', () => {
  it('HTTPS, Instagram client ID ve sabit sağlayıcı hostu; secret ve desteklenmeyen PKCE yok', () => {
    const url = new URL(authorizationUrl(cfg, 'state', 'challenge'));
    expect(url.origin).toBe('https://www.instagram.com');
    expect(url.searchParams.get('client_id')).toBe('fixture-id');
    expect(url.searchParams.get('state')).toBe('state');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://panel.invalid/api/oauth/instagram/callback',
    );
    expect(url.searchParams.has('code_challenge')).toBe(false);
    expect(url.toString()).not.toContain('private-secret');
    expect(() =>
      providerConfig('instagram', {
        INSTAGRAM_CLIENT_ID: 'id',
        INSTAGRAM_CLIENT_SECRET: 'secret',
        OAUTH_REDIRECT_BASE: 'http://localhost:3000',
      }),
    ).toThrow();
  });
  it('kodu kısa tokena, kısa tokenı uzun tokena çevirir ve kimliği eşler; refresh token üretmez', async () => {
    const fetcher = fake(short, long, identity);
    const result = await exchangeCode(cfg, 'code', 'verifier', fetcher);
    expect(result).toEqual({ ...long, scope: SCOPES.instagram.join(',') });
    expect(result.refresh_token).toBeUndefined();
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://api.instagram.com/oauth/access_token');
    expect(new URLSearchParams(init.body).get('client_secret')).toBe(
      'private-secret',
    );
    expect(new URLSearchParams(init.body).has('code_verifier')).toBe(false);
    const exchange = new URL(fetcher.mock.calls[1]![0]);
    expect(exchange.origin).toBe('https://graph.instagram.com');
    expect(exchange.searchParams.get('grant_type')).toBe('ig_exchange_token');
    for (const [, options] of fetcher.mock.calls) {
      expect(options.redirect).toBe('error');
      expect(options.cache).toBe('no-store');
      expect(options.signal).toBeDefined();
    }
  });
  it('tek kayıtlı wrapper ve virgüllü izin yanıtını doğrular; belirsiz subject reddedilir', async () => {
    const fetcher = fake(
      { data: [{ ...short, permissions: SCOPES.instagram.join(',') }] },
      long,
      identity,
    );
    expect((await exchangeCode(cfg, 'code', 'verifier', fetcher)).scope).toBe(
      SCOPES.instagram.join(','),
    );
    for (const body of [
      { data: [short, short] },
      { ...short, data: [short] },
      { data: [] },
    ]) {
      const bad = fake(body);
      await expect(
        exchangeCode(cfg, 'code', 'verifier', bad),
      ).rejects.toThrow();
      expect(bad).toHaveBeenCalledTimes(1);
    }
  });
  it('eksik izin veya bozuk token ile uzun token isteği yapılmaz', async () => {
    for (const body of [
      { ...short, permissions: [] },
      { ...short, access_token: '' },
      { ...short, user_id: 9007199254740992 },
      {},
    ]) {
      const fetcher = fake(body);
      await expect(
        exchangeCode(cfg, 'code', 'verifier', fetcher),
      ).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it('kimlik uyuşmazlığı, eksik kimlik, bozuk süre ve sağlayıcı hatası reddedilir; sır sızmaz', async () => {
    for (const bodies of [
      [short, long, { ...identity, user_id: '987' }],
      [short, long, {}],
      [short, { ...long, expires_in: -1 }],
      [{ error: 'private-secret' }],
    ]) {
      await expect(
        exchangeCode(cfg, 'code', 'verifier', fake(...bodies)),
      ).rejects.not.toThrow('private-secret');
    }
    await expect(
      exchangeCode(
        cfg,
        'code',
        'verifier',
        vi.fn().mockRejectedValue(new Error('private-secret')),
      ),
    ).rejects.not.toThrow('private-secret');
  });
  it('kimliği ve kullanıcı adını bearer başlığıyla okur', async () => {
    const fetcher = fake(identity);
    expect(await accountIdentity(cfg, { ...long, scope: '' }, fetcher)).toEqual(
      { id: identity.user_id, handle: 'fixture' },
    );
    expect(fetcher.mock.calls[0]![1].headers.authorization).toBe(
      'Bearer long-secret',
    );
    expect(fetcher.mock.calls[0]![0]).not.toContain('long-secret');
  });
  it('sağlayıcı revoke yalnız açık success=true ile onaylanır', async () => {
    const fetcher = fake({ success: true });
    await revokeToken(cfg, long, fetcher);
    expect(fetcher.mock.calls[0]![0]).toBe(
      'https://graph.instagram.com/v23.0/me/permissions',
    );
    expect(fetcher.mock.calls[0]![1].method).toBe('DELETE');
    for (const body of [
      {},
      { success: false },
      { error: { message: 'private-secret' } },
    ])
      await expect(revokeToken(cfg, long, fake(body))).rejects.not.toThrow(
        'private-secret',
      );
  });
});
