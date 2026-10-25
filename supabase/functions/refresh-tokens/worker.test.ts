import { assertEquals, assert } from '@std/assert';
import { refreshTokens, type Job, type Store, type Token } from './worker.ts';
const job: Job = {
  id: 'a',
  platform: 'youtube',
  externalId: 'UCfixture',
  leaseId: 'lease',
  token: {
    access_token: 'old-secret',
    refresh_token: 'refresh-secret',
    scope: 'old-scope',
  },
};
function setup(jobs: Job[] = [job], applied = true) {
  const calls: unknown[][] = [];
  const store: Store = {
    claim: () => Promise.resolve(jobs),
    finish: (...args) => {
      calls.push(args);
      return Promise.resolve(applied);
    },
  };
  return { store, calls };
}
const credentials = {
  youtube: { id: 'id', secret: 'client-secret' },
  tiktok: { id: 'tt-id', secret: 'tt-secret' },
};
const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));
Deno.test(
  'Google refresh token ve kapsam korunur; sır sonuçta/logda yok',
  async () => {
    const { store, calls } = setup();
    const result = await refreshTokens(
      store,
      credentials,
      ((_url, init) => {
        assertEquals(init?.redirect, 'error');
        assert(
          new URLSearchParams(String(init?.body)).get('refresh_token') ===
            'refresh-secret',
        );
        return json({ access_token: 'new-secret', expires_in: 3600 });
      }) as typeof fetch,
      () => 0,
    );
    assertEquals(result.updated, 1);
    const token = calls[0][2] as Token;
    assertEquals(token.refresh_token, 'refresh-secret');
    assertEquals(token.scope, 'old-scope');
    assertEquals(calls[0][3], '1970-01-01T01:00:00.000Z');
    assert(!JSON.stringify(result).includes('secret'));
  },
);
Deno.test(
  'TikTok dönen yeni refresh token saklanır, open_id eşleşmeli',
  async () => {
    const { store, calls } = setup([
      { ...job, platform: 'tiktok', externalId: 'tt-user' },
    ]);
    await refreshTokens(store, credentials, (() =>
      json({
        access_token: 'new',
        refresh_token: 'rotated',
        expires_in: 86400,
        open_id: 'tt-user',
      })) as typeof fetch);
    assertEquals((calls[0][2] as Token).refresh_token, 'rotated');
    const bad = setup([{ ...job, platform: 'tiktok', externalId: 'tt-user' }]);
    await refreshTokens(bad.store, credentials, (() =>
      json({
        access_token: 'new',
        refresh_token: 'rotated',
        expires_in: 86400,
        open_id: 'other',
      })) as typeof fetch);
    assertEquals(bad.calls[0][1], 'error');
  },
);
Deno.test(
  '429/5xx/ağ tekrar denenir; invalid_grant yeniden bağlantı ister',
  async () => {
    for (const [status, error, expected] of [
      [429, 'rate_limit', 'retry'],
      [500, 'server_error', 'retry'],
      [400, 'invalid_grant', 'error'],
    ] as const) {
      const { store, calls } = setup();
      await refreshTokens(store, credentials, (() =>
        json(
          { error, error_description: 'private-secret' },
          status,
        )) as typeof fetch);
      assertEquals(calls[0][1], expected);
    }
    const { store, calls } = setup();
    await refreshTokens(store, credentials, (() =>
      Promise.reject(new Error('private-secret'))) as typeof fetch);
    assertEquals(calls[0][1], 'retry');
  },
);
Deno.test(
  'yeni bağlantı eski worker sonucuyla ezilmez; CAS false stale sayılır',
  async () => {
    const { store } = setup([job], false);
    const result = await refreshTokens(store, credentials, (() =>
      json({ access_token: 'new', expires_in: 3600 })) as typeof fetch);
    assertEquals(result.stale, 1);
    assertEquals(result.updated, 0);
  },
);
Deno.test('sağlayıcı ayarı yoksa hesap alınmaz', async () => {
  let claimed = false;
  const store: Store = {
    claim: () => {
      claimed = true;
      return Promise.resolve([]);
    },
    finish: () => Promise.resolve(false),
  };
  const result = await refreshTokens(store, {});
  assertEquals(result.configured, false);
  assertEquals(claimed, false);
});
