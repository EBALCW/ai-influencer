import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { createMemoryStore } from '../testing/memory-store.ts';
import type { Http, LoginProof, Tokens } from './api.ts';
import { CredentialStoreError } from './credential-store.ts';
import { AbortedError, LoginError } from './errors.ts';
import { createMemoryLogger } from './log.ts';
import {
  login,
  parseLoginCode,
  parseLoginInput,
  type Prompter,
} from './login.ts';
import { createPrompter } from './prompt.ts';

const email = 'uye@ornek.com';
const hash = 'pkce_0123456789abcdef0123456789abcdef';

test('giriş girdisi: bağlantı adresi, özet ya da kod', () => {
  assert.deepEqual(
    parseLoginInput(
      `  https://abc.supabase.co/auth/v1/verify?token=${hash}&type=magiclink&redirect_to=http://localhost:3000 `,
      email,
    ),
    { kind: 'token_hash', tokenHash: hash, type: 'magiclink' },
  );
  assert.deepEqual(
    parseLoginInput(
      `https://panel.ornek.com/auth/callback?token_hash=${hash}&type=email`,
      email,
    ),
    { kind: 'token_hash', tokenHash: hash, type: 'email' },
  );
  assert.deepEqual(
    parseLoginInput(
      `https://panel.ornek.com/auth/callback#token_hash=${hash}`,
      email,
    ),
    { kind: 'token_hash', tokenHash: hash, type: 'magiclink' },
  );
  assert.deepEqual(parseLoginInput(hash, email), {
    kind: 'token_hash',
    tokenHash: hash,
    type: 'magiclink',
  });
  assert.deepEqual(parseLoginInput(' 123456 ', email), {
    kind: 'code',
    email,
    code: '123456',
  });
  for (const bad of [
    '',
    'merhaba dünya',
    '12345',
    'https://abc.supabase.co/auth/v1/verify?type=magiclink',
    'https://abc.supabase.co/auth/v1/verify?token=kısa',
    'javascript:alert(1)//?token=' + hash,
    'file:///etc/passwd?token=' + hash,
    `https://x.test/?token=${hash}"; rm -rf ~`,
  ])
    assert.equal(parseLoginInput(bad, email), null, bad);
});

function fakeHttp(overrides: Partial<Http> = {}) {
  const calls: string[] = [];
  const tokens = (n: number): Tokens => ({
    accessToken: `erisim-${n}`,
    refreshToken: `yenileme-${n}`,
    issuedAtMs: Date.now(),
    expiresAtMs: Date.now() + 3_600_000,
    userId: 'u',
    sessionId: 's',
  });
  const http: Http = {
    sendLoginEmail: async (to) => void calls.push(`otp:${to}`),
    verifyLogin: async (proof: LoginProof) => {
      calls.push(`verify:${proof.kind}`);
      return tokens(0);
    },
    signInWithPassword: async (to, password) => {
      calls.push(`password:${to}:${password.length}`);
      return tokens(0);
    },
    refresh: async (refreshToken) => {
      calls.push(`refresh:${refreshToken}`);
      return tokens(1);
    },
    logout: async () => void calls.push('logout'),
    rpc: async () => {
      throw new Error('kullanılmıyor');
    },
    select: async () => [],
    upload: async () => undefined,
    ...overrides,
  };
  return { http, calls };
}

function scripted(answers: string[]): Prompter & { questions: string[] } {
  const questions: string[] = [];
  const next = async (question: string) => {
    questions.push(question);
    return answers.shift() ?? '';
  };
  return { questions, ask: next, askHidden: next };
}

test('e-posta bağlantısıyla giriş: oturum kasaya yazılır, sırlar görünmez', async () => {
  const store = createMemoryStore();
  const { http, calls } = fakeHttp();
  const log = createMemoryLogger();
  const said: string[] = [];
  const prompter = scripted([
    ' Uye@Ornek.com ',
    'bu bağlantı değil',
    `https://x.test/v?token=${hash}`,
  ]);
  const session = await login({
    http,
    store,
    account: 'hesap',
    log,
    prompter,
    say: (line) => said.push(line),
    method: 'email',
  });
  assert.deepEqual(calls, [
    `otp:${email}`,
    'verify:token_hash',
    'refresh:yenileme-0',
  ]);
  // Girişten gelen token hemen yenilendi; kasada yalnız yenisi var
  assert.equal(store.items.get('hesap'), 'yenileme-1');
  assert.equal(await session.accessToken(), 'erisim-1');
  const shown = [...said, ...log.lines, ...prompter.questions].join('\n');
  for (const secret of [hash, 'yenileme-', 'erisim-'])
    assert.equal(shown.includes(secret), false, secret);
  assert.match(shown, /TIKLAMA/);
});

test('parolayla giriş; yanlış bilgi ve geçersiz e-posta reddedilir', async () => {
  const store = createMemoryStore();
  const { http, calls } = fakeHttp();
  await login({
    http,
    store,
    account: 'hesap',
    log: createMemoryLogger(),
    prompter: scripted([email, 'çok-gizli-parola']),
    say: () => undefined,
    method: 'password',
  });
  assert.deepEqual(calls, [`password:${email}:16`, 'refresh:yenileme-0']);

  const denied = fakeHttp({
    signInWithPassword: async () => {
      throw new LoginError('Giriş reddedildi');
    },
  });
  const empty = createMemoryStore();
  await assert.rejects(
    login({
      http: denied.http,
      store: empty,
      account: 'hesap',
      log: createMemoryLogger(),
      prompter: scripted([email, 'yanlış']),
      say: () => undefined,
      method: 'password',
    }),
    LoginError,
  );
  assert.equal(empty.items.size, 0);
  for (const bad of ['', 'adres değil', 'a@b c', '<a@b>'])
    await assert.rejects(
      login({
        http: fakeHttp().http,
        store: createMemoryStore(),
        account: 'hesap',
        log: createMemoryLogger(),
        prompter: scripted([bad]),
        say: () => undefined,
        method: 'email',
      }),
      /E-posta adresi geçersiz/,
      bad,
    );
});

test('üç tanınmayan girdiden sonra vazgeçilir; kasa yoksa hiç başlanmaz', async () => {
  const { http, calls } = fakeHttp();
  await assert.rejects(
    login({
      http,
      store: createMemoryStore(),
      account: 'hesap',
      log: createMemoryLogger(),
      prompter: scripted([email, 'x', 'y', 'z']),
      say: () => undefined,
      method: 'email',
    }),
    /tanınamadı/,
  );
  assert.deepEqual(calls, [`otp:${email}`]);

  const broken = createMemoryStore();
  broken.set = async () => {
    throw new Error('kasa kilitli');
  };
  const untouched = fakeHttp();
  const prompter = scripted([email]);
  await assert.rejects(
    login({
      http: untouched.http,
      store: broken,
      account: 'hesap',
      log: createMemoryLogger(),
      prompter,
      say: () => undefined,
      method: 'email',
    }),
    CredentialStoreError,
  );
  assert.deepEqual(untouched.calls, []);
  assert.deepEqual(prompter.questions, [], 'kasa yoksa e-posta bile sorulmaz');
});

// ── Uçbirim girdisi ──────────────────────────────────────────────────────────
function terminal() {
  const input = Object.assign(new PassThrough(), {
    isTTY: true,
    rawModes: [] as boolean[],
    setRawMode(mode: boolean) {
      input.rawModes.push(mode);
    },
  });
  const output = new PassThrough();
  let written = '';
  output.on('data', (chunk: Buffer) => (written += chunk.toString('utf8')));
  return { input, output, written: () => written };
}

test('gizli girdi yankılanmaz; silme tuşu ve yapıştırma çalışır; Ctrl+C iptal eder', async () => {
  const term = terminal();
  const prompter = createPrompter(term.input, term.output);
  const visible = prompter.ask('E-posta: ');
  term.input.write('uye@ornek.com\n');
  assert.equal(await visible, 'uye@ornek.com');
  assert.deepEqual(term.input.rawModes, [], 'görünür girdide ham kip yok');

  const hidden = prompter.askHidden('Parola: ');
  term.input.write('gizlx');
  term.input.write('\u007f');
  term.input.write('i-parola\r');
  assert.equal(await hidden, 'gizli-parola');
  assert.deepEqual(term.input.rawModes, [true, false]);
  assert.equal(
    term.written().includes('gizli'),
    false,
    'gizli girdi ekrana yazılmaz',
  );
  assert.equal(term.written(), 'E-posta: Parola: \n');

  const cancelled = prompter.askHidden('Parola: ');
  term.input.write('yarım\u0003');
  await assert.rejects(cancelled, AbortedError);
  assert.equal(term.input.rawModes.at(-1), false, 'ham kip kapatılmalı');
});

test('kodla giriş: e-posta sorulmaz ve istenmez; kod gizli sorulur ve görünmez', async () => {
  assert.equal(parseLoginCode(` ${hash}\n`), hash);
  for (const bad of ['', '123456', `https://x.test/v?token=${hash}`, 'a b'])
    assert.equal(parseLoginCode(bad), null, bad);

  const store = createMemoryStore();
  const { http, calls } = fakeHttp();
  const log = createMemoryLogger();
  const said: string[] = [];
  const hidden: string[] = [];
  const prompter: Prompter = {
    ask: async () => {
      throw new Error('görünür soru sorulmamalı');
    },
    askHidden: async (question) => {
      hidden.push(question);
      return ` ${hash} `;
    },
  };
  await login({
    http,
    store,
    account: 'hesap',
    log,
    prompter,
    say: (line) => said.push(line),
    method: 'code',
  });
  assert.deepEqual(calls, ['verify:token_hash', 'refresh:yenileme-0']);
  assert.equal(store.items.get('hesap'), 'yenileme-1');
  assert.equal(hidden.length, 1);
  const shown = [...said, ...log.lines, ...hidden].join('\n');
  for (const secret of [hash, 'yenileme-', 'erisim-'])
    assert.equal(shown.includes(secret), false, secret);

  // Koda benzemeyen girdi Auth'a gönderilmez ve iletiye taşınmaz
  const second = fakeHttp();
  await assert.rejects(
    login({
      http: second.http,
      store: createMemoryStore(),
      account: 'hesap',
      log: createMemoryLogger(),
      prompter: scripted(['gizli deger degil kod']),
      say: () => undefined,
      method: 'code',
    }),
    (error: unknown) =>
      error instanceof LoginError &&
      /benzemiyor/.test(error.message) &&
      !error.message.includes('gizli deger'),
  );
  assert.deepEqual(second.calls, []);
});

test('gizli girdi borudan (stdin) da okunur', async () => {
  const input = new PassThrough();
  const output = new PassThrough();
  const written: string[] = [];
  output.on('data', (chunk: Buffer) => written.push(chunk.toString('utf8')));
  const pending = createPrompter(input, output).askHidden('Giriş kodu: ');
  input.end(`${hash}\n`);
  assert.equal(await pending, hash);
  assert.equal(written.join('').includes(hash), false);
});
