import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMemoryStore } from '../testing/memory-store.ts';
import { createHttp, decodeJwtClaims, type Http, type Tokens } from './api.ts';
import { ApiError, NetworkError, SessionError } from './errors.ts';
import { createMemoryLogger } from './log.ts';
import { createSession } from './session.ts';

const account = 'ornek.supabase.co';

function fakeHttp(overrides: Partial<Http> = {}) {
  const state = { refreshes: [] as string[], logouts: [] as string[], n: 0 };
  const http: Http = {
    sendLoginEmail: async () => undefined,
    verifyLogin: async () => {
      throw new Error('kullanılmıyor');
    },
    signInWithPassword: async () => {
      throw new Error('kullanılmıyor');
    },
    refresh: async (refreshToken) => {
      state.refreshes.push(refreshToken);
      state.n += 1;
      const tokens: Tokens = {
        accessToken: `erisim-${state.n}`,
        refreshToken: `yenileme-${state.n}`,
        issuedAtMs: clock.now,
        expiresAtMs: clock.now + 3_600_000,
        userId: 'kullanici',
        sessionId: 'oturum',
      };
      return tokens;
    },
    logout: async (token) => {
      state.logouts.push(token);
    },
    rpc: async () => {
      throw new Error('kullanılmıyor');
    },
    select: async () => [],
    upload: async () => undefined,
    ...overrides,
  };
  return { http, state };
}
const clock = { now: 1_000_000 };

test('ilk çağrıda kasadaki token yenilenir ve yenisi hemen kasaya yazılır', async () => {
  const store = createMemoryStore({ [account]: 'yenileme-0' });
  const { http, state } = fakeHttp();
  const session = createSession({
    http,
    store,
    account,
    log: createMemoryLogger(),
    now: () => clock.now,
  });
  assert.equal(session.current(), null);
  assert.equal(await session.accessToken(), 'erisim-1');
  assert.deepEqual(state.refreshes, ['yenileme-0']);
  assert.equal(store.items.get(account), 'yenileme-1');
  assert.deepEqual(session.current(), {
    userId: 'kullanici',
    sessionId: 'oturum',
    expiresAtMs: clock.now + 3_600_000,
  });
});

test('token süresi dolmadan yeniden kullanılır; sona yaklaşınca yenilenir; eşzamanlı istekler tek yenileme yapar', async () => {
  const store = createMemoryStore({ [account]: 'yenileme-0' });
  const { http, state } = fakeHttp();
  const time = { now: 1_000_000 };
  clock.now = time.now;
  const session = createSession({
    http,
    store,
    account,
    log: createMemoryLogger(),
    now: () => time.now,
  });
  const first = await Promise.all([
    session.accessToken(),
    session.accessToken(),
    session.accessToken(),
  ]);
  assert.deepEqual(first, ['erisim-1', 'erisim-1', 'erisim-1']);
  assert.equal(state.refreshes.length, 1);
  time.now += 3_000_000; // 50 dk: hâlâ geçerli
  assert.equal(await session.accessToken(), 'erisim-1');
  time.now += 400_000; // son 5 dakikaya girildi
  clock.now = time.now;
  assert.equal(await session.accessToken(), 'erisim-2');
  assert.deepEqual(state.refreshes, ['yenileme-0', 'yenileme-1']);
  assert.equal(await session.forceRefresh(), 'erisim-3');
  assert.equal(store.items.get(account), 'yenileme-3');
});

test('giriş yoksa ve oturum geçersizse anlaşılır hata; geçersiz kayıt kasadan silinir', async () => {
  const empty = createSession({
    ...fakeHttp(),
    store: createMemoryStore(),
    account,
    log: createMemoryLogger(),
  });
  await assert.rejects(empty.accessToken(), /worker:login/);

  const store = createMemoryStore({ [account]: 'eski' });
  const revoked = createSession({
    http: fakeHttp({
      refresh: async () => {
        throw new SessionError('x');
      },
    }).http,
    store,
    account,
    log: createMemoryLogger(),
  });
  await assert.rejects(revoked.accessToken(), SessionError);
  assert.equal(store.items.has(account), false);
});

test('ağ hatasında kayıt silinmez; kasa yazılamazsa çalışma sürer ve uyarı verilir', async () => {
  const store = createMemoryStore({ [account]: 'yenileme-0' });
  const offline = createSession({
    http: fakeHttp({
      refresh: async () => {
        throw new NetworkError('x');
      },
    }).http,
    store,
    account,
    log: createMemoryLogger(),
  });
  await assert.rejects(offline.accessToken(), NetworkError);
  assert.equal(store.items.get(account), 'yenileme-0');

  const broken = createMemoryStore({ [account]: 'yenileme-0' });
  broken.set = async () => {
    throw new Error('kasa kilitli');
  };
  const log = createMemoryLogger();
  const session = createSession({
    ...fakeHttp(),
    store: broken,
    account,
    log,
    now: () => clock.now,
  });
  assert.match(await session.accessToken(), /^erisim-/);
  assert.match(log.lines.join('\n'), /kasaya yazılamadı/);
  // Token'lar loglanmaz
  assert.equal(/yenileme-\d|erisim-\d/.test(log.lines.join('\n')), false);
});

test('eşlemeden gelen token kasaya hiç yazılmadan kullanılır, yenisi yazılır; çıkış kaydı siler', async () => {
  const store = createMemoryStore();
  const { http, state } = fakeHttp();
  const session = createSession({
    http,
    store,
    account,
    log: createMemoryLogger(),
    now: () => clock.now,
    initialRefreshToken: 'eslemeden-gelen',
  });
  await session.accessToken();
  assert.deepEqual(state.refreshes, ['eslemeden-gelen']);
  assert.equal([...store.items.values()].includes('eslemeden-gelen'), false);
  await session.logout();
  assert.equal(state.logouts.length, 1);
  assert.equal(store.items.has(account), false);
  assert.equal(session.current(), null);
});

test('çıkış: oturum sunucuda zaten yoksa yerel kayıt yine silinir', async () => {
  const store = createMemoryStore({ [account]: 'yenileme-0' });
  const session = createSession({
    http: fakeHttp({
      logout: async () => {
        throw new ApiError('x', { status: 403 });
      },
    }).http,
    store,
    account,
    log: createMemoryLogger(),
  });
  await session.logout();
  assert.equal(store.items.has(account), false);
});

// ── HTTP katmanı ─────────────────────────────────────────────────────────────
function jsonResponse(status: number, body: unknown) {
  return new Response(body === null ? null : JSON.stringify(body), { status });
}
const jwt = (claims: unknown) =>
  `${Buffer.from('{}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.imza`;

test('http: istek başlıkları, yenileme yanıtı ve hata eşlemesi', async () => {
  const seen: { url: string; init: RequestInit }[] = [];
  const queue: Response[] = [];
  const http = createHttp({
    supabaseUrl: 'https://ornek.supabase.co',
    anonKey: 'anon-anahtar',
    now: () => 5000,
    fetchImpl: (async (url: string, init: RequestInit) => {
      seen.push({ url, init });
      const next = queue.shift();
      if (!next) throw new TypeError('fetch failed');
      return next;
    }) as typeof fetch,
  });

  queue.push(
    jsonResponse(200, {
      access_token: jwt({ sub: 'u1', session_id: 's1' }),
      refresh_token: 'yeni',
      expires_in: 3600,
    }),
  );
  const tokens = await http.refresh('eski');
  assert.equal(tokens.userId, 'u1');
  assert.equal(tokens.sessionId, 's1');
  assert.equal(tokens.expiresAtMs, 5000 + 3_600_000);
  assert.equal(
    seen[0]!.url,
    'https://ornek.supabase.co/auth/v1/token?grant_type=refresh_token',
  );
  const headers = seen[0]!.init.headers as Record<string, string>;
  assert.equal(headers.apikey, 'anon-anahtar');
  assert.equal(headers.Authorization, 'Bearer anon-anahtar');
  assert.equal(seen[0]!.init.redirect, 'error');

  queue.push(jsonResponse(400, { error_code: 'refresh_token_not_found' }));
  await assert.rejects(http.refresh('eski'), SessionError);
  queue.push(jsonResponse(503, null));
  await assert.rejects(http.refresh('eski'), NetworkError);
  await assert.rejects(http.refresh('eski'), NetworkError); // fetch fırlattı
  queue.push(jsonResponse(200, { access_token: 'bozuk' }));
  await assert.rejects(http.refresh('eski'), NetworkError);

  queue.push(jsonResponse(200, { id: 'w1' }));
  assert.deepEqual(
    await http.rpc('register_worker', { p_name: 'x' }, 'erisim'),
    { id: 'w1' },
  );
  assert.equal(
    (seen.at(-1)!.init.headers as Record<string, string>).Authorization,
    'Bearer erisim',
  );
  queue.push(
    jsonResponse(403, {
      code: '42501',
      message: 'Bu makinenin yetkisi kaldırıldı.',
      hint: 'worker_revoked',
    }),
  );
  await assert.rejects(
    http.rpc('claim_job', {}, 'erisim'),
    (error: ApiError) => {
      assert.equal(error.code, '42501');
      assert.equal(error.hint, 'worker_revoked');
      assert.equal(error.status, 403);
      return true;
    },
  );
  queue.push(jsonResponse(429, null));
  await assert.rejects(http.rpc('claim_job', {}, 'erisim'), NetworkError);
  await assert.rejects(http.rpc('../auth', {}, 'erisim'), /geçersiz/);
});

test('http: yükleme yolu yalnız <alan>/<iş>/<dosya> olabilir', async () => {
  const urls: string[] = [];
  const http = createHttp({
    supabaseUrl: 'http://127.0.0.1:54321',
    anonKey: 'anon',
    fetchImpl: (async (url: string) => {
      urls.push(url);
      return jsonResponse(200, { Key: 'x' });
    }) as typeof fetch,
  });
  await http.upload(
    'alan/is/cikti.txt',
    new Uint8Array([1]),
    'text/plain',
    'erisim',
  );
  assert.deepEqual(urls, [
    'http://127.0.0.1:54321/storage/v1/object/productions/alan/is/cikti.txt',
  ]);
  for (const bad of [
    'alan/is/../x',
    'alan/is',
    'alan/is/a/b',
    '/alan/is/x',
    'alan/is/.gizli',
    'alan/is/a b',
    'alan//x',
  ])
    await assert.rejects(
      http.upload(bad, new Uint8Array(), 'text/plain', 'erisim'),
      /geçersiz/,
      bad,
    );
  assert.equal(urls.length, 1);
});

test('decodeJwtClaims bozuk girdide boş nesne döner', () => {
  assert.deepEqual(decodeJwtClaims('a'), {});
  assert.deepEqual(decodeJwtClaims('a.b.c'), {});
  assert.deepEqual(decodeJwtClaims(jwt({ sub: 'x' })), { sub: 'x' });
});
