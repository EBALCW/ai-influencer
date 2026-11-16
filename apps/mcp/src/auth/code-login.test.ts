import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { parseLoginArgs } from '../cli.ts';
import { loginWithCode, parseToolCode, readToolCode } from './code-login.ts';
import { DEFAULT_LOGIN_PORT, LoginError } from './login.ts';
import type { FetchLike } from './session.ts';

// Sahte değerler çalışma anında kurulur (depoda anahtar biçimli sabit durmasın).
const CODE = 'c0de'.repeat(14);
const config = { supabaseUrl: 'http://127.0.0.1:54321', anonKey: 'anon' };

function sink() {
  const output = new PassThrough();
  const chunks: string[] = [];
  output.on('data', (chunk: Buffer) => chunks.push(chunk.toString('utf8')));
  return { output, text: () => chunks.join('') };
}

test('kod biçimi: özet kabul edilir, bağlantı ya da boş girdi edilmez', () => {
  assert.equal(parseToolCode(`  ${CODE}\n`), CODE);
  assert.equal(parseToolCode(`pkce_${CODE}`), `pkce_${CODE}`);
  for (const bad of [
    '',
    '123456',
    'kısa',
    `${CODE} ${CODE}`,
    `https://x.test/?token=${CODE}`,
  ])
    assert.equal(parseToolCode(bad), null, bad);
});

test('--code: değer argümandan alınmaz ve yankılanmaz', () => {
  assert.deepEqual(parseLoginArgs(['--code']), {
    method: { kind: 'code' },
    port: DEFAULT_LOGIN_PORT,
    open: true,
  });
  for (const argv of [
    ['--code', CODE],
    [`--code=${CODE}`],
    ['--no-open', '--code', CODE],
  ])
    assert.throws(
      () => parseLoginArgs(argv),
      (error: unknown) =>
        error instanceof LoginError &&
        /komut satırına yazılmaz/.test(error.message) &&
        !error.message.includes(CODE),
    );
  // Yöntemler birbirini dışlar
  assert.throws(() => parseLoginArgs(['--code', '--google']), LoginError);
  assert.throws(
    () => parseLoginArgs(['--code', '--email', 'a@b.co']),
    LoginError,
  );
});

test('kod standart girdiden (boru) okunur; ekrana yazılmaz', async () => {
  const input = new PassThrough();
  const { output, text } = sink();
  const pending = readToolCode(input, output);
  input.end(`${CODE}\n`);
  assert.equal(await pending, CODE);
  assert.match(text(), /Giriş kodu/);
  assert.equal(text().includes(CODE), false);
});

test('kod uçbirimde gizli okunur: ham kip açılır, yankı yok, sonunda kapanır', async () => {
  const modes: boolean[] = [];
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode: (mode: boolean) => void modes.push(mode),
  });
  const { output, text } = sink();
  const pending = readToolCode(input, output);
  // Yapıştırma + bir yanlış tuş ve silme + Enter
  input.write(CODE.slice(0, 10));
  input.write('x\u007f');
  input.write(`${CODE.slice(10)}\r`);
  assert.equal(await pending, CODE);
  assert.deepEqual(modes, [true, false]);
  assert.equal(text().includes(CODE), false);
  assert.equal(text().includes(CODE.slice(0, 10)), false);
});

test('tanınmayan girdi ve Ctrl+C: girdi iletiye taşınmaz, ham kip kapanır', async () => {
  const bad = new PassThrough();
  const first = readToolCode(bad, sink().output);
  bad.end('bu bir kod değil gizli-deger\n');
  await assert.rejects(
    first,
    (error: unknown) =>
      error instanceof LoginError &&
      /benzemiyor/.test(error.message) &&
      !error.message.includes('gizli-deger'),
  );
  const modes: boolean[] = [];
  const tty = Object.assign(new PassThrough(), {
    isTTY: true,
    setRawMode: (mode: boolean) => void modes.push(mode),
  });
  const second = readToolCode(tty, sink().output);
  tty.write('abc\u0003');
  await assert.rejects(second, /iptal/);
  assert.deepEqual(modes, [true, false]);
});

function fakeFetch(status: number, body: unknown) {
  const calls: Array<{
    url: string;
    body: string;
    headers: Record<string, string>;
  }> = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, body: init.body ?? '', headers: init.headers });
    return {
      status,
      text: async () =>
        typeof body === 'string' ? body : JSON.stringify(body),
    };
  };
  return { fetch, calls };
}

test('kod anon anahtarla /auth/v1/verify ucunda oturuma çevrilir; e-posta istenmez', async () => {
  const { fetch, calls } = fakeFetch(200, {
    access_token: 'erisim',
    refresh_token: 'yenileme',
    expires_in: 3600,
    user: { id: 'u', email: 'uye@ornek.test' },
  });
  const token = await loginWithCode(config, CODE, fetch);
  assert.deepEqual(token, {
    access_token: 'erisim',
    refresh_token: 'yenileme',
    expires_in: 3600,
    user: { id: 'u', email: 'uye@ornek.test' },
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, 'http://127.0.0.1:54321/auth/v1/verify');
  assert.deepEqual(JSON.parse(calls[0]!.body), {
    type: 'magiclink',
    token_hash: CODE,
  });
  assert.equal(calls[0]!.headers.apikey, 'anon');
  // Kod adrese (URL) girmez
  assert.equal(calls[0]!.url.includes(CODE), false);
});

test('reddedilen, sınırlanan ve bozuk yanıtlar: ileti kodu ve Auth gövdesini taşımaz', async () => {
  const cases: Array<[number, unknown, RegExp]> = [
    [
      403,
      { error_code: 'otp_expired', msg: `sızıntı ${CODE}` },
      /kullanılmış ya da süresi dolmuş/,
    ],
    [400, { msg: 'bad' }, /kullanılmış ya da süresi dolmuş/],
    [429, {}, /Çok fazla deneme/],
    [500, 'html', /beklenmeyen yanıt/],
    [200, { access_token: 'yalnız-erisim' }, /beklenmeyen yanıt/],
  ];
  for (const [status, body, pattern] of cases) {
    await assert.rejects(
      loginWithCode(config, CODE, fakeFetch(status, body).fetch),
      (error: unknown) =>
        error instanceof LoginError &&
        pattern.test(error.message) &&
        !error.message.includes(CODE) &&
        !error.message.includes('sızıntı'),
      String(status),
    );
  }
  await assert.rejects(
    loginWithCode(config, CODE, async () => {
      throw new Error(`ağ hatası ${CODE}`);
    }),
    (error: unknown) =>
      error instanceof LoginError &&
      /ulaşılamadı/.test(error.message) &&
      !error.message.includes(CODE),
  );
  // Biçimi bozuk kod Auth'a hiç gönderilmez
  const { fetch, calls } = fakeFetch(200, {});
  await assert.rejects(loginWithCode(config, 'kısa', fetch), /benzemiyor/);
  assert.equal(calls.length, 0);
});
