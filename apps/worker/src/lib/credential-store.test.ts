import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import {
  CREDENTIAL_SERVICE,
  CredentialStoreError,
  WINDOWS_SCRIPT,
  assertStorableSecret,
  createCredentialStore,
  findSecretTool,
  linuxCommands,
  macCommands,
  probeCredentialStore,
  windowsCommands,
  windowsPowerShellPath,
  type StoreCommand,
  type StoreRunResult,
} from './credential-store.ts';

const account = 'ornek.supabase.co';
const secret = 'v1.abc-DEF_123~+/=';

test('macOS: sır argümana değil stdin’e yazılır; araç tam yolla çağrılır', () => {
  const mac = macCommands(account);
  const set = mac.set(secret);
  assert.equal(set.file, '/usr/bin/security');
  assert.deepEqual(set.args, ['-i']);
  assert.equal(set.args.join(' ').includes(secret), false);
  assert.equal(
    set.stdin,
    `add-generic-password -U -a "${account}" -s "${CREDENTIAL_SERVICE}" -l "AI Influencer üretim makinesi" -w "${secret}"\n`,
  );
  assert.deepEqual(mac.get().args, [
    'find-generic-password',
    '-a',
    account,
    '-s',
    CREDENTIAL_SERVICE,
    '-w',
  ]);
  assert.deepEqual(mac.get().notFoundCodes, [44]);
  assert.deepEqual(mac.delete().args.slice(0, 1), ['delete-generic-password']);
});

test('Windows: sabit betik, hedef ortam değişkeninde, sır stdin’de', () => {
  const env = { SystemRoot: 'D:\\Windows' };
  const win = windowsCommands(account, env);
  const set = win.set(secret);
  assert.equal(
    set.file,
    'D:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  );
  assert.equal(windowsPowerShellPath({}).startsWith('C:\\Windows\\'), true);
  assert.equal(set.stdin, `${secret}\n`);
  assert.deepEqual(set.env, {
    AIW_CRED_TARGET: `${CREDENTIAL_SERVICE}:${account}`,
    AIW_CRED_ACTION: 'set',
  });
  // Betik her işlemde aynıdır ve girdi içermez
  const encoded = set.args.at(-1)!;
  assert.equal(
    Buffer.from(encoded, 'base64').toString('utf16le'),
    WINDOWS_SCRIPT,
  );
  assert.equal(win.get().args.at(-1), encoded);
  assert.equal(win.delete().args.at(-1), encoded);
  for (const text of [...set.args, JSON.stringify(set.env)])
    assert.equal(text.includes(secret), false);
  assert.equal(WINDOWS_SCRIPT.includes(account), false);
  assert.deepEqual(set.args.slice(0, 6), [
    '-NoProfile',
    '-NonInteractive',
    '-NoLogo',
    '-ExecutionPolicy',
    'Bypass',
    '-EncodedCommand',
  ]);
  assert.ok(encoded.length < 30_000, 'komut satırı sınırının altında');
});

test('Linux: secret-tool yalnız sistem klasörlerinde aranır; sır stdin’de', () => {
  assert.equal(
    findSecretTool((file) => file === '/usr/local/bin/secret-tool'),
    '/usr/local/bin/secret-tool',
  );
  assert.equal(
    findSecretTool(() => false),
    null,
  );
  const linux = linuxCommands(account, '/usr/bin/secret-tool');
  const set = linux.set(secret);
  assert.deepEqual(set.args.slice(-4), [
    'service',
    CREDENTIAL_SERVICE,
    'account',
    account,
  ]);
  assert.equal(set.stdin, secret);
  assert.equal(set.args.join(' ').includes(secret), false);
});

test('kaçış gerektiren hesap adı ve sır hiç komuta dönüşmez', () => {
  for (const bad of ['a b', 'a"b', "a'b", 'a;b', 'a\nb', '$(x)', '', 'a\\b'])
    assert.throws(() => macCommands(bad), CredentialStoreError, bad);
  for (const bad of [
    'iki kelime',
    'tırnak"lı',
    "tek'tırnak",
    'satır\nsonu',
    'ters\\bölü',
    '$(komut)',
    '`komut`',
    'a;b',
    '',
    'x'.repeat(3000),
  ]) {
    assert.throws(() => assertStorableSecret(bad), CredentialStoreError, bad);
    assert.throws(() => macCommands(account).set(bad), CredentialStoreError);
    assert.throws(
      () => windowsCommands(account, {}).set(bad),
      CredentialStoreError,
    );
    assert.throws(
      () => linuxCommands(account, '/usr/bin/secret-tool').set(bad),
      CredentialStoreError,
    );
  }
  assert.doesNotThrow(() => assertStorableSecret(secret));
});

function fakeRunner(
  respond: (command: StoreCommand) => Partial<StoreRunResult>,
) {
  const calls: StoreCommand[] = [];
  return {
    calls,
    run: async (command: StoreCommand): Promise<StoreRunResult> => {
      calls.push(command);
      return { code: 0, stdout: '', timedOut: false, ...respond(command) };
    },
  };
}

test('kasa: oku / yaz / sil ve "kayıt yok" kodları', async () => {
  const items = new Map<string, string>();
  const { run } = fakeRunner((command) => {
    if (command.args[0] === '-i') {
      items.set('x', /-w "([^"]+)"/.exec(command.stdin ?? '')![1]!);
      return {};
    }
    if (command.args[0] === 'find-generic-password')
      return items.has('x') ? { stdout: `${items.get('x')}\n` } : { code: 44 };
    return items.delete('x') ? {} : { code: 44 };
  });
  const store = createCredentialStore({
    platform: 'darwin',
    env: {},
    exists: () => true,
    run,
  });
  assert.equal(store.label, 'macOS Keychain');
  assert.equal(await store.get(account), null);
  await store.set(account, secret);
  assert.equal(await store.get(account), secret);
  await store.delete(account);
  await store.delete(account); // ikinci silme hata değildir
  assert.equal(await store.get(account), null);
  assert.deepEqual(await probeCredentialStore(store), { ok: true });
});

test('kasa hatası sır içermeyen bir hataya dönüşür; bozuk değer kullanılmaz', async () => {
  const failing = createCredentialStore({
    platform: 'darwin',
    env: {},
    exists: () => true,
    run: fakeRunner(() => ({ code: 1, stdout: 'gizli çıktı' })).run,
  });
  await assert.rejects(failing.set(account, secret), (error: Error) => {
    assert.equal(error.message.includes(secret), false);
    assert.equal(error.message.includes('gizli çıktı'), false);
    return error instanceof CredentialStoreError;
  });
  await assert.rejects(failing.get(account), CredentialStoreError);
  const tampered = createCredentialStore({
    platform: 'darwin',
    env: {},
    exists: () => true,
    run: fakeRunner(() => ({ stdout: 'içinde boşluk var\n' })).run,
  });
  await assert.rejects(tampered.get(account), CredentialStoreError);
  const probe = await probeCredentialStore(failing);
  assert.equal(probe.ok, false);
});

test('kasa yoksa neden söylenir (düz dosyaya düşme yok)', async () => {
  const mac = createCredentialStore({
    platform: 'darwin',
    env: {},
    exists: () => false,
  });
  assert.deepEqual(await mac.available(), {
    ok: false,
    reason: '/usr/bin/security bulunamadı.',
  });
  const win = createCredentialStore({
    platform: 'win32',
    env: {},
    exists: () => false,
  });
  assert.equal((await win.available()).ok, false);
  const noTool = createCredentialStore({
    platform: 'linux',
    env: {},
    exists: () => false,
  });
  const reason = await noTool.available();
  assert.equal(reason.ok, false);
  assert.match(reason.ok ? '' : reason.reason, /secret-tool bulunamadı/);
  const noBus = createCredentialStore({
    platform: 'linux',
    env: {},
    exists: () => true,
  });
  assert.match(
    ((await noBus.available()) as { reason: string }).reason,
    /D-Bus/,
  );
  assert.deepEqual(
    await createCredentialStore({
      platform: 'linux',
      env: { DBUS_SESSION_BUS_ADDRESS: 'unix:path=/run/user/1000/bus' },
      exists: () => true,
    }).available(),
    { ok: true },
  );
  assert.equal((await probeCredentialStore(noTool)).ok, false);
});

// Gerçek kasa: macOS Keychain ve Windows Credential Manager'da yaz-oku-sil. Linux CI'da
// anahtarlık servisi olmadığı için atlanır (orada yalnız komut kurulumu denenir).
test(
  'gerçek işletim sistemi kasasında yaz, oku, üstüne yaz, sil',
  { skip: process.platform === 'linux' },
  async () => {
    const store = createCredentialStore({
      platform: process.platform as 'darwin' | 'win32',
      env: process.env,
    });
    assert.deepEqual(await store.available(), { ok: true });
    const testAccount = `test-${process.pid}.example.invalid`;
    // Kasa aracı hata verirse nedeni görülsün (bu okuma sır içermez: kayıt henüz yok).
    if (process.platform === 'win32') {
      const probe = windowsCommands(testAccount, process.env).get();
      const ran = spawnSync(probe.file, probe.args, {
        encoding: 'utf8',
        env: { ...process.env, ...probe.env },
        input: '',
        timeout: 120_000,
      });
      assert.equal(
        ran.status,
        3,
        `PowerShell kasa betiği: ${ran.status}\n${ran.stderr}`,
      );
    }
    try {
      assert.equal(await store.get(testAccount), null);
      await store.set(testAccount, 'ilk-deger_1');
      assert.equal(await store.get(testAccount), 'ilk-deger_1');
      await store.set(testAccount, secret);
      assert.equal(await store.get(testAccount), secret);
    } finally {
      await store.delete(testAccount);
    }
    assert.equal(await store.get(testAccount), null);
    await store.delete(testAccount);
  },
);
