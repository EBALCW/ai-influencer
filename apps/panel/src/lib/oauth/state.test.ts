import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import {
  beginOAuth,
  consumeOAuth,
  OAUTH_STATE_TTL_MS,
  pkceChallenge,
  oauthPlatformSchema,
  type OAuthContext,
  type OAuthStateStore,
  type OAuthTransaction,
} from './state';
const context: OAuthContext = {
  userId: '11111111-1111-4111-8111-111111111111',
  influencerId: '22222222-2222-4222-8222-222222222222',
  platform: 'youtube',
};
function memory() {
  const rows = new Map<string, OAuthTransaction>();
  const store: OAuthStateStore = {
    save: async (hash, row) => {
      if (rows.has(hash)) throw new Error('duplicate');
      rows.set(hash, row);
    },
    consume: async (hash, ctx, now) => {
      const row = rows.get(hash);
      if (
        !row ||
        row.userId !== ctx.userId ||
        row.influencerId !== ctx.influencerId ||
        row.platform !== ctx.platform ||
        row.expiresAt <= now
      )
        return null;
      rows.delete(hash);
      return row;
    },
  };
  return { store, rows };
}
describe('OAuth state ve PKCE', () => {
  it('RFC 7636 S256 test vektörü', () => {
    expect(pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
    expect(() => pkceChallenge('short')).toThrow();
  });
  it('rastgele, hash ile saklanan state; verifier istemciye çıkmaz', async () => {
    const { store, rows } = memory();
    const a = await beginOAuth(store, context, 1000);
    const b = await beginOAuth(store, context, 1000);
    expect(a.state).not.toBe(b.state);
    expect(rows.has(a.state)).toBe(false);
    expect(a).not.toHaveProperty('verifier');
    expect(a.challengeMethod).toBe('S256');
    const result = await consumeOAuth(store, a.state, context, 1001);
    expect(pkceChallenge(result!.verifier)).toBe(a.challenge);
  });
  it('aynı state eşzamanlı iki callback için yalnız bir kez tüketilir', async () => {
    const { store } = memory();
    const a = await beginOAuth(store, context, 0);
    const results = await Promise.all([
      consumeOAuth(store, a.state, context, 1),
      consumeOAuth(store, a.state, context, 1),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await consumeOAuth(store, a.state, context, 2)).toBeNull();
  });
  it('kullanıcı, influencer ve platform eşleşmeli; yanlış istek doğru state tüketmez', async () => {
    const { store } = memory();
    const a = await beginOAuth(store, context, 0);
    for (const wrong of [
      { ...context, userId: context.influencerId },
      { ...context, influencerId: context.userId },
      { ...context, platform: 'tiktok' as const },
    ])
      expect(await consumeOAuth(store, a.state, wrong, 1)).toBeNull();
    expect(await consumeOAuth(store, a.state, context, 1)).not.toBeNull();
  });
  it('TTL sınırı, boş/bozuk state ve bilinmeyen platform reddedilir', async () => {
    const { store } = memory();
    const a = await beginOAuth(store, context, 0);
    expect(
      await consumeOAuth(store, a.state, context, OAUTH_STATE_TTL_MS),
    ).toBeNull();
    for (const bad of [null, '', 'x', 'x'.repeat(100000), {}])
      expect(await consumeOAuth(store, bad, context, 0)).toBeNull();
    expect(oauthPlatformSchema.safeParse('foo').success).toBe(false);
  });
  it('bozuk sunucu deposu bağlam/TTL/verifier kontrollerini atlayamaz', async () => {
    const { store, rows } = memory();
    const a = await beginOAuth(store, context, 0);
    const row = [...rows.values()][0]!;
    for (const invalid of [
      { ...row, platform: 'tiktok' as const },
      { ...row, expiresAt: Number.POSITIVE_INFINITY },
      { ...row, expiresAt: Number.NaN },
      { ...row, verifier: 'bad' },
    ]) {
      const broken = { ...store, consume: async () => invalid };
      expect(await consumeOAuth(broken, a.state, context, 1)).toBeNull();
    }
  });
});
