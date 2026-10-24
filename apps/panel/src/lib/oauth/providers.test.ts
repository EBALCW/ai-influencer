import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  providerConfig,
  authorizationUrl,
  exchangeCode,
  accountIdentity,
  SCOPES,
} from './providers';
const env = {
  OAUTH_REDIRECT_BASE: 'http://localhost:3000',
  GOOGLE_CLIENT_ID: 'id',
  GOOGLE_CLIENT_SECRET: 'secret',
};
const cfg = providerConfig('youtube', env);
const token = {
  access_token: 'access-fixture',
  refresh_token: 'refresh-fixture',
  expires_in: 3600,
  scope: SCOPES.youtube.join(' '),
};
const fake = (body: unknown, status = 200) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
describe('OAuth providers', () => {
  it('config eksikse kapalı; query, credential, dış HTTP reddedilir', () => {
    expect(() => providerConfig('youtube', {})).toThrow();
    for (const origin of [
      'http://outside.invalid',
      'https://user:pass@test.invalid',
      'https://test.invalid/path',
      'https://test.invalid/?x=1',
    ])
      expect(() =>
        providerConfig('youtube', { ...env, OAUTH_REDIRECT_BASE: origin }),
      ).toThrow();
    expect(() => providerConfig('instagram', env)).toThrow();
    expect(() =>
      providerConfig('tiktok', {
        TIKTOK_CLIENT_ID: 'id',
        TIKTOK_CLIENT_SECRET: 'secret',
        OAUTH_REDIRECT_BASE: 'http://localhost:3000',
      }),
    ).toThrow();
  });
  it('Google S256 + offline, TikTok Web state; secret URL içinde bulunmaz', () => {
    const url = new URL(authorizationUrl(cfg, 'state', 'challenge'));
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.toString()).not.toContain('secret');
    const tt = providerConfig('tiktok', {
      TIKTOK_CLIENT_ID: 'id',
      TIKTOK_CLIENT_SECRET: 'secret',
      OAUTH_REDIRECT_BASE: 'https://panel.invalid',
    });
    const turl = new URL(authorizationUrl(tt, 'state', 'challenge'));
    expect(turl.searchParams.get('client_key')).toBe('id');
    expect(turl.searchParams.has('code_challenge')).toBe(false);
  });
  it('kod sunucudan form body ile değişilir; redirect takip edilmez', async () => {
    const fetcher = fake(token);
    expect(await exchangeCode(cfg, 'code', 'verifier', fetcher)).toEqual(token);
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://oauth2.googleapis.com/token');
    expect(init.redirect).toBe('error');
    expect(new URLSearchParams(init.body).get('code_verifier')).toBe(
      'verifier',
    );
  });
  it('eksik izin, refresh yokluğu, bozuk/hatalı yanıt sır sızdırmaz', async () => {
    for (const body of [
      { ...token, scope: '' },
      { ...token, refresh_token: undefined },
      { error: 'access-fixture' },
      {},
    ])
      await expect(
        exchangeCode(cfg, 'code', 'verifier', fake(body)),
      ).rejects.not.toThrow('access-fixture');
    await expect(
      exchangeCode(cfg, 'code', 'verifier', fake({ error: 'secret' }, 500)),
    ).rejects.not.toThrow('secret');
  });
  it('tek kanal kimliği zorunlu; TikTok kimliği şemayla doğrulanır', async () => {
    expect(
      await accountIdentity(
        cfg,
        token,
        fake({
          items: [{ id: 'UCfixture', snippet: { customUrl: '@fixture' } }],
        }),
      ),
    ).toEqual({ id: 'UCfixture', handle: '@fixture' });
    await expect(
      accountIdentity(cfg, token, fake({ items: [] })),
    ).rejects.toThrow();
    const tt = providerConfig('tiktok', {
      TIKTOK_CLIENT_ID: 'id',
      TIKTOK_CLIENT_SECRET: 'secret',
      OAUTH_REDIRECT_BASE: 'https://panel.invalid',
    });
    expect(
      await accountIdentity(
        tt,
        token,
        fake({
          data: { user: { open_id: 'fixture', display_name: 'Fixture' } },
          error: { code: 'ok' },
        }),
      ),
    ).toEqual({ id: 'fixture', handle: 'Fixture' });
  });
});
