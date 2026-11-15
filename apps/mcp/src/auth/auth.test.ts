import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ConfigError,
  assertPublicKey,
  assertSupabaseUrl,
  loadConfig,
  pickEnvValues,
} from '../config.ts';
import { parseLoginArgs } from '../cli.ts';
import { ToolError } from '../lib/errors.ts';
import {
  AutomationGuardError,
  automationSessionName,
  markAutomationSession,
  probeApprovalRefused,
  type RawRpc,
} from './automation.ts';
import {
  CredentialStoreError,
  MAX_SECRET_BYTES,
  createMemoryStore,
  createPlatformStore,
} from './credential-store.ts';
import {
  DEFAULT_LOGIN_PORT,
  LoginError,
  parseCallback,
  redirectUrl,
  waitForCallback,
} from './login.ts';
import {
  SessionManager,
  parseStoredSession,
  storedSessionFrom,
  type FetchLike,
  type TokenResponse,
} from './session.ts';

// Sahte değerler çalışma anında kurulur (depoda anahtar biçimli sabit durmasın).
const SAMPLE = 'abcdefgh' + String(1234);
const USER = '11111111-1111-4111-8111-111111111111';
const SESSION = '22222222-2222-4222-8222-222222222222';

function jwt(payload: Record<string, unknown>): string {
  const part = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${part({ alg: 'HS256' })}.${part(payload)}.imza`;
}
const ANON = jwt({ role: 'anon' });
const config = { supabaseUrl: 'https://proje.supabase.co', anonKey: ANON };

function token(
  refresh: string,
  overrides: Record<string, unknown> = {},
): TokenResponse {
  return {
    access_token: jwt({
      sub: USER,
      session_id: SESSION,
      role: 'authenticated',
      ...overrides,
    }),
    refresh_token: refresh,
    expires_in: 3600,
  };
}

// ── yapılandırma ─────────────────────────────────────────────────────────────
test('yapılandırma: .env dosyasından YALNIZ istenen anahtarlar okunur', () => {
  const values = pickEnvValues(
    [
      '# yorum',
      'NEXT_PUBLIC_SUPABASE_URL="https://a.supabase.co"',
      'SUPABASE_SERVICE_ROLE_KEY=cok-gizli',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY=abc # not',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY=',
    ].join('\n'),
    ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  );
  assert.deepEqual(values, {
    NEXT_PUBLIC_SUPABASE_URL: 'https://a.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'abc',
  });
});

test('yapılandırma: service role ya da gizli anahtarla başlamaz', () => {
  assert.doesNotThrow(() => assertPublicKey(ANON));
  assert.doesNotThrow(() =>
    assertPublicKey(['sb', 'publishable', SAMPLE].join('_')),
  );
  assert.throws(
    () => assertPublicKey(jwt({ role: 'service_role' })),
    ConfigError,
  );
  assert.throws(
    () => assertPublicKey(jwt({ role: 'authenticated' })),
    ConfigError,
  );
  assert.throws(
    () => assertPublicKey(['sb', 'secret', SAMPLE].join('_')),
    ConfigError,
  );
  assert.throws(() => assertPublicKey('rastgele'), ConfigError);
});

test('yapılandırma: adres https olmalı; yerel adres http olabilir; kimlik bilgisi taşıyamaz', () => {
  assert.equal(
    assertSupabaseUrl('https://a.supabase.co').origin,
    'https://a.supabase.co',
  );
  assert.doesNotThrow(() => assertSupabaseUrl('http://127.0.0.1:54321'));
  assert.throws(() => assertSupabaseUrl('http://a.supabase.co'), ConfigError);
  assert.throws(
    () => assertSupabaseUrl('https://u:p@a.supabase.co'),
    ConfigError,
  );
  assert.throws(
    () => assertSupabaseUrl('https://a.supabase.co/?x=1'),
    ConfigError,
  );
  assert.throws(() => assertSupabaseUrl('dosya'), ConfigError);
});

test('yapılandırma: ortam değişkeni dosyanın önündedir; dosyadaki service role anahtarı reddedilir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-env-'));
  try {
    const file = join(dir, '.env.local');
    writeFileSync(
      file,
      `NEXT_PUBLIC_SUPABASE_URL=https://dosya.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON}\n`,
    );
    assert.deepEqual(loadConfig({}, file), {
      supabaseUrl: 'https://dosya.supabase.co',
      anonKey: ANON,
    });
    assert.equal(
      loadConfig({ AI_INFLUENCER_SUPABASE_URL: 'http://localhost:54321' }, file)
        .supabaseUrl,
      'http://localhost:54321',
    );
    writeFileSync(
      file,
      `NEXT_PUBLIC_SUPABASE_URL=https://dosya.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${jwt({ role: 'service_role' })}\n`,
    );
    assert.throws(() => loadConfig({}, file), ConfigError);
    assert.throws(() => loadConfig({}, join(dir, 'yok')), /env:pull/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ── kasa ─────────────────────────────────────────────────────────────────────
test('kasa: bellek deposu arayüzü uygular; büyük değer reddedilir', async () => {
  const store = createMemoryStore();
  assert.equal(await store.get('a'), null);
  await store.set('a', 'değer');
  assert.equal(await store.get('a'), 'değer');
  await store.delete('a');
  assert.equal(await store.get('a'), null);
  await assert.rejects(
    store.set('a', 'x'.repeat(MAX_SECRET_BYTES)),
    CredentialStoreError,
  );
});

test('kasa: desteklenmeyen işletim sisteminde düz dosyaya düşmez, durur', () => {
  assert.throws(() => createPlatformStore('aix'), CredentialStoreError);
});

// Gerçek işletim sistemi kasası: geçici bir kayıt yazar, okur, siler. Yalnız istenince çalışır
// (CI'da Windows işinde açık; macOS'ta elle: MCP_CREDENTIAL_STORE_TEST=1).
test(
  'kasa: gerçek işletim sistemi kasasında yaz / oku / üstüne yaz / sil',
  { skip: process.env.MCP_CREDENTIAL_STORE_TEST !== '1' },
  async () => {
    const store = createPlatformStore();
    const account = `selftest-${randomUUID().slice(0, 8)}`;
    const secret = JSON.stringify({ v: 1, t: 'çğş "tırnak" \\ $x `y` \'z\'' });
    try {
      assert.equal(await store.get(account), null);
      await store.set(account, secret);
      assert.equal(await store.get(account), secret);
      await store.set(account, 'ikinci');
      assert.equal(await store.get(account), 'ikinci');
    } finally {
      await store.delete(account);
    }
    assert.equal(await store.get(account), null);
    await store.delete(account); // yokken silmek hata değildir
  },
);

test('kasa: kayıt adı doğrulanır (komut satırına tuhaf karakter gitmez)', async () => {
  if (process.platform !== 'darwin' && process.platform !== 'win32') return;
  const store = createPlatformStore();
  await assert.rejects(store.get('a b; rm -rf'), CredentialStoreError);
  await assert.rejects(store.set("x' -w", 'y'), CredentialStoreError);
});

// ── oturum ───────────────────────────────────────────────────────────────────
test('oturum: session_id ya da authenticated rolü olmayan token kullanılmaz', () => {
  assert.equal(storedSessionFrom(config, token('rtok1')).session_id, SESSION);
  assert.throws(
    () => storedSessionFrom(config, token('rtok1', { session_id: undefined })),
    ToolError,
  );
  assert.throws(
    () => storedSessionFrom(config, token('rtok1', { role: 'service_role' })),
    ToolError,
  );
  assert.throws(
    () => storedSessionFrom(config, token('rtok1', { sub: 'x' })),
    ToolError,
  );
});

test('oturum: bozuk ya da eksik kasa kaydı yok sayılır', () => {
  assert.equal(parseStoredSession(null), null);
  assert.equal(parseStoredSession('{'), null);
  assert.equal(parseStoredSession(JSON.stringify({ v: 2 })), null);
  assert.equal(
    parseStoredSession(
      JSON.stringify({
        v: 1,
        url: 'u',
        refresh_token: 'rtok9',
        user_id: 'x',
        session_id: SESSION,
      }),
    ),
    null,
  );
});

function fakeAuth(
  handler: (refresh: string) => { status: number; body: unknown },
) {
  const calls: { url: string; body: string | undefined; auth: string }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({
      url,
      body: init.body,
      auth: init.headers.Authorization ?? '',
    });
    if (url.includes('/logout')) return { status: 204, text: async () => '' };
    const refresh = (JSON.parse(init.body ?? '{}') as { refresh_token: string })
      .refresh_token;
    const { status, body } = handler(refresh);
    return { status, text: async () => JSON.stringify(body) };
  };
  return { fetch, calls };
}

test('oturum: giriş yokken giris_gerekli; ağ çağrısı yapılmaz', async () => {
  const auth = fakeAuth(() => ({ status: 500, body: {} }));
  const manager = new SessionManager({
    config,
    store: createMemoryStore(),
    fetch: auth.fetch,
  });
  await assert.rejects(
    manager.accessToken(),
    (error: ToolError) => error.code === 'giris_gerekli',
  );
  assert.equal(auth.calls.length, 0);
  assert.equal(manager.identity(), null);
});

test('oturum: yenileme yeni token’ı hemen kasaya yazar; erişim token’ı kasaya girmez', async () => {
  const store = createMemoryStore();
  let now = 1_000_000;
  let n = 1;
  const auth = fakeAuth((refresh) => {
    assert.equal(refresh, `rtok${n}`);
    n += 1;
    return { status: 200, body: token(`rtok${n}`) };
  });
  const manager = new SessionManager({
    config,
    store,
    fetch: auth.fetch,
    now: () => now,
  });
  await manager.adopt(token('rtok1'));
  const first = await manager.accessToken();
  assert.equal(auth.calls.length, 0, 'süresi dolmamış token yenilenmez');
  now += 3600_000;
  const [a, b] = await Promise.all([
    manager.accessToken(),
    manager.accessToken(),
  ]);
  assert.equal(a, b);
  assert.equal(auth.calls.length, 1, 'eşzamanlı çağrılar tek yenileme yapar');
  assert.equal(
    auth.calls[0]!.url,
    'https://proje.supabase.co/auth/v1/token?grant_type=refresh_token',
  );
  const saved = store.entries.get('proje.supabase.co')!;
  assert.equal(parseStoredSession(saved)!.refresh_token, 'rtok2');
  assert.doesNotMatch(saved, /access_token|eyJ/);
  assert.equal(typeof first, 'string');
  assert.deepEqual(manager.identity(), { userId: USER, sessionId: SESSION });
});

test('oturum: başka süreç token’ı döndürdüyse kasadaki yenisi kullanılır', async () => {
  const store = createMemoryStore();
  let now = 0;
  const auth = fakeAuth((refresh) => {
    if (refresh === 'rtok1') {
      // Bu sırada diğer süreç r1'i kullanıp r2'yi kasaya yazmış olsun.
      store.entries.set(
        'proje.supabase.co',
        JSON.stringify(storedSessionFrom(config, token('rtok2'))),
      );
      return {
        status: 400,
        body: { error_code: 'refresh_token_already_used' },
      };
    }
    return { status: 200, body: token('rtok3') };
  });
  const manager = new SessionManager({
    config,
    store,
    fetch: auth.fetch,
    now: () => now,
  });
  await manager.adopt(token('rtok1'));
  now += 3600_000;
  await manager.accessToken();
  assert.equal(
    parseStoredSession(store.entries.get('proje.supabase.co')!)!.refresh_token,
    'rtok3',
  );
});

test('oturum: geçersiz yenileme token’ı kasadan silinir ve giriş istenir', async () => {
  const store = createMemoryStore();
  let now = 0;
  const auth = fakeAuth(() => ({
    status: 400,
    body: { error_code: 'refresh_token_not_found' },
  }));
  const manager = new SessionManager({
    config,
    store,
    fetch: auth.fetch,
    now: () => now,
  });
  await manager.adopt(token('rtok1'));
  now += 3600_000;
  await assert.rejects(
    manager.accessToken(),
    (error: ToolError) => error.code === 'giris_gerekli',
  );
  assert.equal(store.entries.size, 0);
  assert.equal(auth.calls.length, 1);
});

test('oturum: sunucu hatasında token silinmez (geçici sorun)', async () => {
  const store = createMemoryStore();
  let now = 0;
  const auth = fakeAuth(() => ({ status: 503, body: {} }));
  const manager = new SessionManager({
    config,
    store,
    fetch: auth.fetch,
    now: () => now,
  });
  await manager.adopt(token('rtok1'));
  now += 3600_000;
  await assert.rejects(
    manager.accessToken(),
    (error: ToolError) => error.code === 'baglanti',
  );
  assert.equal(store.entries.size, 1);
});

test('oturum: yenilemede oturum kimliği değişirse reddedilir', async () => {
  const store = createMemoryStore();
  let now = 0;
  const auth = fakeAuth(() => ({
    status: 200,
    body: token('rtok2', {
      session_id: '33333333-3333-4333-8333-333333333333',
    }),
  }));
  const manager = new SessionManager({
    config,
    store,
    fetch: auth.fetch,
    now: () => now,
  });
  await manager.adopt(token('rtok1'));
  now += 3600_000;
  await assert.rejects(
    manager.accessToken(),
    (error: ToolError) => error.code === 'oturum_gecersiz',
  );
  assert.equal(
    parseStoredSession(store.entries.get('proje.supabase.co')!)!.refresh_token,
    'rtok1',
  );
});

test('oturum: başka Supabase projesine ait kasa kaydı kullanılmaz', async () => {
  const store = createMemoryStore();
  const auth = fakeAuth(() => ({ status: 200, body: token('rtok2') }));
  store.entries.set(
    'proje.supabase.co',
    JSON.stringify({
      ...storedSessionFrom(config, token('rtok1')),
      url: 'https://baska.supabase.co',
    }),
  );
  const manager = new SessionManager({ config, store, fetch: auth.fetch });
  await assert.rejects(
    manager.accessToken(),
    (error: ToolError) => error.code === 'giris_gerekli',
  );
  assert.equal(auth.calls.length, 0, 'token başka adrese gönderilmez');
});

test('oturum: çıkış yalnız bu oturumu kapatır ve kasayı temizler', async () => {
  const store = createMemoryStore();
  const auth = fakeAuth(() => ({ status: 200, body: token('rtok2') }));
  const manager = new SessionManager({ config, store, fetch: auth.fetch });
  await manager.adopt(token('rtok1'));
  assert.deepEqual(await manager.logout(), { revoked: true, hadSession: true });
  assert.equal(store.entries.size, 0);
  assert.equal(
    auth.calls[0]!.url,
    'https://proje.supabase.co/auth/v1/logout?scope=local',
  );
  assert.deepEqual(await manager.logout(), {
    revoked: false,
    hadSession: false,
  });
});

// ── otomasyon oturumu güvencesi ──────────────────────────────────────────────
function fakeRpc(
  responses: Record<
    string,
    (args: Record<string, unknown>) => { code?: string; hint?: string } | null
  >,
) {
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const rpc: RawRpc = async (name, args) => {
    calls.push({ name, args });
    const error = responses[name]?.(args) ?? null;
    return { data: error ? null : {}, error };
  };
  return { rpc, calls };
}

test('güvence: oturum MCP oturumu olarak işaretlenir (makine kaydı açılmaz)', async () => {
  const { rpc, calls } = fakeRpc({ register_mcp_session: () => null });
  assert.deepEqual(await markAutomationSession(rpc, 'Batu-MacBook.local'), {
    state: 'marked',
    name: 'MCP istemcisi (Batu-MacBook)',
  });
  assert.deepEqual(calls, [
    {
      name: 'register_mcp_session',
      args: { p_client_name: 'MCP istemcisi (Batu-MacBook)' },
    },
  ]);
});

test('güvence: bilgisayar adı temizlenir ve sınırlanır', () => {
  assert.equal(
    automationSessionName('a b/c<script>'),
    'MCP istemcisi (a-b-c-script-)',
  );
  assert.ok(automationSessionName('x'.repeat(300)).length <= 80);
  assert.equal(automationSessionName(''), 'MCP istemcisi (bilgisayar)');
});

test('güvence: viewer işaretlenemez (yetki hatası, ipucu yok)', async () => {
  const { rpc } = fakeRpc({ register_mcp_session: () => ({ code: '42501' }) });
  assert.deepEqual(await markAutomationSession(rpc, 'h'), { state: 'viewer' });
});

test('güvence: yetkisi kaldırılmış ya da makine olarak kayıtlı (eski) oturum revoked sayılır', async () => {
  for (const hint of ['session_revoked', 'worker_session']) {
    const { rpc, calls } = fakeRpc({
      register_mcp_session: () => ({ code: '42501', hint }),
    });
    assert.deepEqual(await markAutomationSession(rpc, 'h'), {
      state: 'revoked',
    });
    assert.equal(calls.length, 1, 'yeniden denenmez');
  }
});

test('güvence: beklenmeyen kayıt hatası girişi durdurur', async () => {
  for (const error of [
    { code: '54000' },
    { code: '42501', hint: 'session_required' },
    { code: 'PGRST202' },
  ]) {
    const { rpc } = fakeRpc({ register_mcp_session: () => error });
    await assert.rejects(markAutomationSession(rpc, 'h'), AutomationGuardError);
  }
});

test('güvence: iki onay RPC’si de yetki hatası vermeli', async () => {
  const ok = fakeRpc({
    approve_episode_script: () => ({ code: '42501', hint: 'worker_session' }),
    approve_job_stage: () => ({ code: '42501' }),
  });
  await probeApprovalRefused(ok.rpc);
  assert.deepEqual(
    ok.calls.map((call) => call.name),
    ['approve_episode_script', 'approve_job_stage'],
  );
});

test('güvence: "kayıt bulunamadı" oturum denetiminin GEÇİLDİĞİ demektir → reddet', async () => {
  // İnsan oturumu rastgele kimlikle çağırırsa veritabanı P0002 döner: denetim geçilmiştir.
  const human = fakeRpc({
    approve_episode_script: () => ({ code: 'P0002' }),
    approve_job_stage: () => ({ code: '42501' }),
  });
  await assert.rejects(probeApprovalRefused(human.rpc), AutomationGuardError);

  const second = fakeRpc({
    approve_episode_script: () => ({ code: '42501' }),
    approve_job_stage: () => ({ code: 'P0002' }),
  });
  await assert.rejects(probeApprovalRefused(second.rpc), AutomationGuardError);

  const noError = fakeRpc({ approve_episode_script: () => null });
  await assert.rejects(probeApprovalRefused(noError.rpc), AutomationGuardError);
});

test('güvence: ağ hatası güvence hatası sayılmaz (olduğu gibi yukarı verilir)', async () => {
  const rpc: RawRpc = async () => ({
    data: null,
    error: { message: 'fetch failed' },
  });
  await assert.rejects(
    probeApprovalRefused(rpc),
    (error: unknown) => !(error instanceof AutomationGuardError),
  );
});

// ── tarayıcıyla giriş ────────────────────────────────────────────────────────
test('giriş: geri dönüş adresi yalnız 127.0.0.1 ve sabit yol', () => {
  assert.equal(
    redirectUrl(DEFAULT_LOGIN_PORT),
    'http://127.0.0.1:47821/callback',
  );
});

test('giriş: geri dönüş ayrıştırma; kod biçimi denetlenir, hata metni yansıtılmaz', () => {
  assert.deepEqual(parseCallback('/callback?code=abcDEF12-_.~xyz'), {
    code: 'abcDEF12-_.~xyz',
  });
  assert.equal(parseCallback('/baska?code=abcdefgh'), null);
  assert.deepEqual(parseCallback('/callback?code=<script>'), {
    error: 'gecersiz_donus',
  });
  assert.deepEqual(
    parseCallback('/callback?error=access_denied&error_code=otp_expired'),
    {
      error: 'otp_expired',
    },
  );
  assert.deepEqual(parseCallback('/callback?error=<b>x</b>'), {
    error: 'gecersiz_donus',
  });
});

async function freePort(): Promise<number> {
  const { createServer } = await import('node:net');
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number }).port;
      server.close(() => resolve(port));
    });
  });
}

test('giriş: dinleyici kodu alır, başka yolu ve yabancı Host başlığını reddeder, sonra kapanır', async () => {
  const port = await freePort();
  const callback = waitForCallback(port, 5000);
  await callback.ready;
  const base = `http://127.0.0.1:${port}`;
  assert.equal((await fetch(`${base}/`)).status, 404);
  assert.equal(
    (await fetch(`${base}/callback?code=abcdefgh12`, { method: 'POST' }))
      .status,
    404,
  );
  // fetch Host başlığını değiştirmeye izin vermez; DNS rebinding isteğini http ile kur.
  const { request } = await import('node:http');
  const rebindStatus = await new Promise<number>((resolve, reject) => {
    request(
      {
        host: '127.0.0.1',
        port,
        path: '/callback?code=abcdefgh12',
        headers: { Host: 'saldirgan.example' },
      },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    )
      .on('error', reject)
      .end();
  });
  assert.equal(rebindStatus, 404);
  const ok = await fetch(`${base}/callback?code=abcdefgh12`);
  assert.equal(ok.status, 200);
  assert.match(
    ok.headers.get('content-security-policy') ?? '',
    /default-src 'none'/,
  );
  assert.doesNotMatch(await ok.text(), /abcdefgh12/);
  assert.equal(await callback.result, 'abcdefgh12');
  await assert.rejects(
    fetch(`${base}/callback?code=abcdefgh12`),
    'dinleyici kapanmış olmalı',
  );
});

test('giriş: hata dönüşü ve zaman aşımı girişi sonlandırır', async () => {
  const port = await freePort();
  const failed = waitForCallback(port, 5000);
  await failed.ready;
  await fetch(`http://127.0.0.1:${port}/callback?error_code=otp_expired`);
  await assert.rejects(failed.result, /otp_expired/);

  const timed = waitForCallback(await freePort(), 30);
  await timed.ready;
  await assert.rejects(timed.result, /süresi doldu/);
});

test('giriş: port doluysa anlaşılır hata', async () => {
  const port = await freePort();
  const first = waitForCallback(port, 5000);
  await first.ready;
  const second = waitForCallback(port, 5000);
  await assert.rejects(second.ready, LoginError);
  first.close();
});

test('giriş: komut satırı seçenekleri', () => {
  assert.deepEqual(parseLoginArgs(['--email', 'a@b.co']), {
    method: { kind: 'email', email: 'a@b.co' },
    port: DEFAULT_LOGIN_PORT,
    open: true,
  });
  assert.deepEqual(parseLoginArgs(['--google', '--port=50000', '--no-open']), {
    method: { kind: 'google' },
    port: 50000,
    open: false,
  });
  assert.throws(() => parseLoginArgs([]), LoginError);
  assert.throws(
    () => parseLoginArgs(['--google', '--email', 'a@b.co']),
    LoginError,
  );
  assert.throws(() => parseLoginArgs(['--email', 'degil']), LoginError);
  assert.throws(() => parseLoginArgs(['--google', '--port', '80']), LoginError);
  assert.throws(() => parseLoginArgs(['--password', 'x']), LoginError);
});
