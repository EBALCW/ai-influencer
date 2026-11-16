import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ConfigError,
  defaultStateDir,
  machineName,
  parseEnvFile,
  pickEnv,
  resolveConfig,
  type HostInfo,
} from './config.ts';

const mac: HostInfo = {
  platform: 'darwin',
  home: '/Users/ornek',
  hostname: 'Ornek-MacBook.local',
  tmpdir: '/tmp',
  env: {},
};
const win: HostInfo = {
  platform: 'win32',
  home: 'C:\\Users\\ornek',
  hostname: 'ORNEK-PC',
  tmpdir: 'C:\\Users\\ornek\\AppData\\Local\\Temp',
  env: { LOCALAPPDATA: 'C:\\Users\\ornek\\AppData\\Local' },
};
const jwt = (claims: unknown) =>
  `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.imzaimzaimza`;
const anon = jwt({ role: 'anon' });
const base = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://ornek.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anon,
};

test('.env.local: yalnız izinli anahtarlar okunur, service role belleğe girmez', () => {
  const parsed = parseEnvFile(
    [
      '# yorum',
      'NEXT_PUBLIC_SUPABASE_URL="https://ornek.supabase.co"',
      "NEXT_PUBLIC_SUPABASE_ANON_KEY='abc'  ",
      'SUPABASE_SERVICE_ROLE_KEY=cok-gizli',
      `ANTHROPIC_API_KEY=${['sk', 'ant', 'gizli'].join('-')}`,
      'export WORKER_NAME=Stüdyo Mac # not',
      'WORKER_POLL_SECONDS=10',
      'WORKER_POLL_SECONDS=',
      'bozuk satır',
    ].join('\r\n'),
  );
  assert.deepEqual(parsed, {
    NEXT_PUBLIC_SUPABASE_URL: 'https://ornek.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'abc',
    WORKER_NAME: 'Stüdyo Mac',
    WORKER_POLL_SECONDS: '10',
  });
  assert.equal(JSON.stringify(parsed).includes('gizli'), false);
  assert.deepEqual(
    pickEnv({
      SUPABASE_SERVICE_ROLE_KEY: 'x',
      WORKER_NAME: ' a ',
      PATH: '/bin',
    }),
    { WORKER_NAME: 'a' },
  );
});

test('ayarlar çözülür: ortam dosyayı ezer, varsayılanlar işletim sistemine göre', () => {
  const config = resolveConfig(
    { ...base, WORKER_NAME: 'dosya' },
    { WORKER_NAME: 'ortam' },
    mac,
  );
  assert.equal(config.supabaseUrl, 'https://ornek.supabase.co');
  assert.equal(config.account, 'ornek.supabase.co');
  assert.equal(config.name, 'ortam');
  assert.equal(config.pollMs, 5000);
  assert.equal(
    config.stateDir,
    '/Users/ornek/Library/Application Support/ai-influencer-worker',
  );
  // Çalışma klasörü kullanıcının veri klasöründe ve yolunda boşluk yok
  assert.equal(
    config.workDir,
    '/Users/ornek/Library/Caches/ai-influencer-worker',
  );
  assert.equal(
    resolveConfig(base, {}, win).workDir,
    'C:\\Users\\ornek\\AppData\\Local\\ai-influencer-worker\\work',
  );
  assert.equal(
    resolveConfig(base, {}, { ...mac, platform: 'linux', home: '/home/ornek' })
      .workDir,
    '/home/ornek/.cache/ai-influencer-worker',
  );

  const onWin = resolveConfig(base, {}, win);
  assert.equal(onWin.name, 'ORNEK-PC');
  assert.equal(
    onWin.stateDir,
    'C:\\Users\\ornek\\AppData\\Local\\ai-influencer-worker',
  );
  assert.equal(
    defaultStateDir({ ...mac, platform: 'linux', home: '/home/o' }),
    '/home/o/.local/state/ai-influencer-worker',
  );
});

test('adres kuralları: https zorunlu, localhost http olabilir, sondaki / atılır', () => {
  const url = (value: string) =>
    resolveConfig({ ...base, NEXT_PUBLIC_SUPABASE_URL: value }, {}, mac);
  assert.equal(
    url('http://127.0.0.1:54321/').supabaseUrl,
    'http://127.0.0.1:54321',
  );
  assert.equal(url('http://127.0.0.1:54321').account, '127.0.0.1:54321');
  assert.throws(() => url('http://ornek.supabase.co'), ConfigError);
  assert.throws(() => url('ftp://ornek.supabase.co'), ConfigError);
  assert.throws(
    () => url('https://kullanici:parola@ornek.supabase.co'),
    ConfigError,
  );
  assert.throws(() => url('https://ornek.supabase.co/?x=1'), ConfigError);
  assert.throws(() => url('adres değil'), ConfigError);
  assert.throws(() => resolveConfig({}, {}, mac), /tanımlı değil/);
});

test('service role anahtarı reddedilir', () => {
  for (const key of [
    jwt({ role: 'service_role' }),
    ['sb', 'secret', 'abcdefghijklmnopqrstuvwxyz'].join('_'),
  ])
    assert.throws(
      () =>
        resolveConfig({ ...base, NEXT_PUBLIC_SUPABASE_ANON_KEY: key }, {}, mac),
      /service role/,
    );
  assert.throws(
    () =>
      resolveConfig(
        { ...base, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'kısa' },
        {},
        mac,
      ),
    /biçimi/,
  );
  assert.doesNotThrow(() =>
    resolveConfig(
      {
        ...base,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_abcdefghijklmnop',
      },
      {},
      mac,
    ),
  );
});

test('yoklama aralığı ve klasörler doğrulanır', () => {
  assert.equal(
    resolveConfig({ ...base, WORKER_POLL_SECONDS: '2' }, {}, mac).pollMs,
    2000,
  );
  for (const value of ['0', '301', 'abc'])
    assert.throws(
      () => resolveConfig({ ...base, WORKER_POLL_SECONDS: value }, {}, mac),
      /WORKER_POLL_SECONDS/,
    );
  assert.throws(
    () => resolveConfig({ ...base, WORKER_STATE_DIR: 'goreli/yol' }, {}, mac),
    /tam yol/,
  );
  assert.equal(
    resolveConfig({ ...base, WORKER_WORK_DIR: '/var/tmp/x/../is' }, {}, mac)
      .workDir,
    '/var/tmp/is',
  );
});

test('makine adı temizlenir', () => {
  assert.equal(machineName('  Stüdyo\tMac\n'), 'Stüdyo Mac');
  assert.equal(machineName('\u0000\u0007'), 'uretim-makinesi');
  assert.equal(machineName('a'.repeat(200)).length, 80);
});
