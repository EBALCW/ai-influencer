// Komut satırı: süreç içinde (bellek kasası + sahte Supabase) ve gerçek süreç olarak (işletim
// sistemi kasası + sahte Supabase). Windows CI'da Docker yoktur; başlat-durdur duman testi budur.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import {
  EXIT,
  HELP,
  main,
  onStopSignals,
  parseCliArgs,
  type CliDeps,
} from './cli.ts';
import { createCredentialStore } from './lib/credential-store.ts';
import { JOB_KINDS } from './lib/registry.ts';
import { SHUTDOWN_MESSAGE } from './lib/runner.ts';
import { acquireLock, readState } from './lib/state.ts';
import { WORKER_VERSION } from './lib/version.ts';
import { startFakeSupabase } from './testing/fake-supabase.ts';
import { createMemoryStore } from './testing/memory-store.ts';

const cli = fileURLToPath(new URL('./cli.ts', import.meta.url));
const root = mkdtempSync(path.join(os.tmpdir(), 'aiw-cli-'));
after(() => rmSync(root, { recursive: true, force: true }));
// Parçalardan kurulur: depoda anahtara benzeyen sabit durmasın (secret taraması)
const ANON = ['sahte', 'anon', 'anahtar', '0123456789'].join('-');
const SERVICE_PLACEHOLDER = ['okunmamali', 'okunmamali'].join('-');
const SELFTEST = {
  kind: 'clip.selftest',
  stages: JOB_KINDS['clip.selftest'].stages.map((stage) => ({ ...stage })),
  required: ['kind:clip.selftest'],
};
let counter = 0;

async function setup(options: { paired?: boolean } = {}) {
  const server = await startFakeSupabase('yenileme-0');
  const store = createMemoryStore(
    options.paired === false ? {} : { [server.account]: 'yenileme-0' },
  );
  const stateDir = path.join(root, `durum-${++counter}`);
  const lines: string[] = [];
  const signals = new EventEmitter();
  const deps = (argv: string[], extra: Partial<CliDeps> = {}): CliDeps => ({
    argv,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: server.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
      WORKER_NAME: 'Test Makinesi',
      WORKER_POLL_SECONDS: '1',
      WORKER_STATE_DIR: stateDir,
      WORKER_WORK_DIR: path.join(root, `is-${counter}`),
      SUPABASE_SERVICE_ROLE_KEY: SERVICE_PLACEHOLDER,
    },
    host: {
      platform: process.platform as 'darwin' | 'win32' | 'linux',
      home: os.homedir(),
      hostname: 'test',
      tmpdir: os.tmpdir(),
      env: {},
    },
    repoRoot: path.join(root, 'repo-yok'),
    out: (line) => lines.push(line),
    signals,
    store,
    capabilities: async () => ['voice.edge-tts'],
    ...extra,
  });
  return { server, store, stateDir, lines, signals, deps };
}

test('sürüm package.json ile aynı; yardım komutları listeler', () => {
  const pkg = JSON.parse(
    readFileSync(
      fileURLToPath(new URL('../package.json', import.meta.url)),
      'utf8',
    ),
  ) as { version: string; scripts: Record<string, string> };
  assert.equal(WORKER_VERSION, pkg.version);
  for (const command of ['start', 'login', 'logout', 'status', 'selftest'])
    assert.match(HELP, new RegExp(`worker:${command}`));
});

test('argümanlar: komut, bayraklar, bilinmeyenler', () => {
  assert.deepEqual(parseCliArgs(['start', '--json', '--exit-when-idle']), {
    command: 'start',
    json: true,
    exitWhenIdle: true,
    force: false,
    password: false,
    code: false,
    codeInArgv: false,
    help: false,
    unknown: [],
  });
  const withCode = parseCliArgs(['login', '--code', '--force']);
  assert.deepEqual(
    [withCode.code, withCode.codeInArgv, withCode.force, withCode.unknown],
    [true, false, true, []],
  );
  // Argüman olarak yazılan kod işaretlenir ve "bilinmeyen seçenek" listesine girmez
  for (const argv of [
    ['login', '--code', 'gizli-kod-degeri-0123'],
    ['login', '--code=gizli-kod-degeri-0123'],
  ]) {
    const parsed = parseCliArgs(argv);
    assert.equal(parsed.codeInArgv, true);
    assert.deepEqual(parsed.unknown, []);
  }
  assert.deepEqual(parseCliArgs(['login', '--force']).force, true);
  assert.equal(parseCliArgs(['login', '--password']).password, true);
  assert.equal(parseCliArgs(['baska']).command, null);
  assert.deepEqual(parseCliArgs(['start', '--yok', 'fazla']).unknown, [
    '--yok',
    'fazla',
  ]);
});

test('durdurma sinyalleri: ilki nazik, ikincisi zorla; Windows Ctrl+Break dahil', () => {
  for (const name of ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP']) {
    const source = new EventEmitter();
    const seen: string[] = [];
    const remove = onStopSignals(
      source,
      () => seen.push('dur'),
      () => seen.push('zorla'),
    );
    source.emit(name);
    source.emit('SIGINT');
    assert.deepEqual(seen, ['dur', 'zorla'], name);
    remove();
    assert.equal(source.listenerCount(name), 0);
  }
});

test('kullanım hataları ve ayar hatası', async () => {
  const env = await setup();
  try {
    assert.equal(await main(env.deps([])), EXIT.usage);
    assert.equal(await main(env.deps(['start', '--bilinmeyen'])), EXIT.usage);
    assert.equal(await main(env.deps(['--help'])), EXIT.ok);
    const broken = env.deps(['start']);
    broken.env = {
      ...broken.env,
      NEXT_PUBLIC_SUPABASE_URL: 'http://uzak.example.com',
    };
    assert.equal(await main(broken), EXIT.usage);
    assert.match(env.lines.join('\n'), /https olmalı/);
    const service = env.deps(['status']);
    service.env = {
      ...service.env,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: `e30.${Buffer.from('{"role":"service_role"}').toString('base64url')}.imzaimzaimza`,
    };
    assert.equal(await main(service), EXIT.usage);
    assert.match(env.lines.join('\n'), /service role/);
  } finally {
    await env.server.close();
  }
});

test('start: işi yürütür, onayda bırakır, boşta çıkar; token döner ve loglanmaz', async () => {
  const env = await setup();
  try {
    const job = env.server.queue.enqueue({
      ...SELFTEST,
      params: { steps: 2, stepMs: 5 },
    });
    assert.equal(
      await main(env.deps(['start', '--exit-when-idle', '--json'])),
      EXIT.ok,
    );
    assert.equal(job.status, 'awaiting_approval');
    assert.deepEqual(env.server.state.uploads, [
      `${job.workspace_id}/${job.id}/selftest.txt`,
    ]);
    assert.deepEqual(env.server.queue.state.worker?.capabilities, [
      'kind:clip.selftest',
      'kind:explainer.render',
      'voice.edge-tts',
    ]);
    assert.equal(env.server.queue.state.worker?.name, 'Test Makinesi');
    assert.equal(env.server.queue.state.worker?.version, WORKER_VERSION);
    // Yenilenen token kasada; durum dosyasında ve çıktıda sır yok
    assert.equal(
      env.store.items.get(env.server.account),
      env.server.state.refreshToken,
    );
    assert.equal(
      readState(env.stateDir, env.server.account)?.workerId,
      env.server.queue.state.worker?.id,
    );
    const output = env.lines.join('\n');
    for (const secret of ['yenileme-', 'sahte-imza', ANON, SERVICE_PLACEHOLDER])
      assert.equal(output.includes(secret), false, secret);
    assert.equal(
      readFileSync(path.join(env.stateDir, 'worker.json'), 'utf8').includes(
        'yenileme',
      ),
      false,
    );
    for (const line of env.lines)
      assert.doesNotThrow(() => JSON.parse(line), line);
    assert.equal(
      existsSync(path.join(env.stateDir, 'worker.lock')),
      false,
      'kilit bırakılmalı',
    );
  } finally {
    await env.server.close();
  }
});

test('start: giriş yapılmamış → 3; oturum geçersiz → 4 ve kayıt silinir; zaten çalışıyor → 5', async () => {
  const unpaired = await setup({ paired: false });
  try {
    assert.equal(await main(unpaired.deps(['start'])), EXIT.notPaired);
    assert.match(unpaired.lines.join('\n'), /worker:login/);
  } finally {
    await unpaired.server.close();
  }
  const dead = await setup();
  try {
    dead.server.state.sessionAlive = false;
    assert.equal(await main(dead.deps(['start'])), EXIT.revoked);
    assert.equal(dead.store.items.size, 0);
  } finally {
    await dead.server.close();
  }
  const busy = await setup();
  try {
    // Yaşayan başka bir süreç (ebeveyn) kilidi tutuyor
    const lock = acquireLock(busy.stateDir, process.ppid);
    assert.equal(await main(busy.deps(['start'])), EXIT.alreadyRunning);
    assert.equal(busy.server.state.rotations, 0, 'oturuma dokunulmamalı');
    lock.release();
  } finally {
    await busy.server.close();
  }
});

test('start: yetki kaldırılınca 4 ile durur, kasadaki kayıt ve durum silinir', async () => {
  const env = await setup();
  try {
    const running = main(env.deps(['start']));
    for (let i = 0; i < 200 && !env.server.queue.state.worker; i++)
      await delay(10);
    env.server.queue.state.revoked = true;
    assert.equal(await running, EXIT.revoked);
    assert.equal(env.store.items.size, 0);
    assert.equal(readState(env.stateDir, env.server.account), null);
  } finally {
    await env.server.close();
  }
});

test('start: Ctrl+C süren işi kuyruğa bırakır ve 0 ile çıkar', async () => {
  const env = await setup();
  try {
    const job = env.server.queue.enqueue({
      ...SELFTEST,
      params: { steps: 50, stepMs: 200 },
    });
    const running = main(env.deps(['start']));
    for (let i = 0; i < 300 && job.stages[0]!.status !== 'running'; i++)
      await delay(10);
    assert.equal(job.stages[0]!.status, 'running');
    env.signals.emit('SIGINT');
    assert.equal(await running, EXIT.ok);
    assert.equal(job.status, 'queued');
    assert.equal(job.error, SHUTDOWN_MESSAGE);
    assert.equal(env.signals.listenerCount('SIGINT'), 0);
  } finally {
    await env.server.close();
  }
});

test('kasa yoksa program çalışmaz ve nedenini söyler (düz dosya yok)', async () => {
  const env = await setup();
  try {
    const store = createMemoryStore();
    store.available = async () =>
      ({ ok: false, reason: 'anahtarlık servisi yok' }) as never;
    for (const command of ['start', 'login', 'logout']) {
      assert.equal(
        await main(env.deps([command], { store })),
        EXIT.noCredentialStore,
        command,
      );
    }
    assert.match(env.lines.join('\n'), /anahtarlık servisi yok/);
    assert.match(env.lines.join('\n'), /düz dosyada saklamaz/);
    assert.equal(
      await main(env.deps(['status'], { store })),
      EXIT.noCredentialStore,
    );
    assert.equal(
      env.server.state.requests.length,
      0,
      'sunucuya hiç gidilmemeli',
    );
    assert.equal(
      existsSync(env.stateDir),
      false,
      'diske hiçbir şey yazılmamalı',
    );
  } finally {
    await env.server.close();
  }
});

function scripted(answers: string[]) {
  const questions: string[] = [];
  const next = async (question: string) => {
    questions.push(question);
    return answers.shift() ?? '';
  };
  return { questions, ask: next, askHidden: next };
}

test('login (e-posta bağlantısı): oturum kasaya yazılır, makine kaydedilir, sırlar görünmez', async () => {
  const env = await setup({ paired: false });
  try {
    const prompter = {
      questions: [] as string[],
      ask: async (question: string) => {
        prompter.questions.push(question);
        return 'uye@ornek.com';
      },
      // Bağlantı e-posta gönderildikten sonra bilinir
      askHidden: async (question: string) => {
        prompter.questions.push(question);
        return `http://127.0.0.1/auth/v1/verify?token=${env.server.state.login.tokenHash}&type=magiclink`;
      },
    };
    assert.equal(await main(env.deps(['login'], { prompter })), EXIT.ok);
    assert.deepEqual(env.server.state.emailsSent, ['uye@ornek.com']);
    // Girişten gelen token hemen yenilendi; kasada yenisi var
    assert.equal(
      env.store.items.get(env.server.account),
      env.server.state.refreshToken,
    );
    assert.equal(env.server.state.rotations, 2);
    // Oturum hemen makine olarak kaydedildi
    assert.equal(env.server.queue.state.worker?.name, 'Test Makinesi');
    assert.deepEqual(env.server.queue.state.worker?.capabilities, [
      'kind:clip.selftest',
      'kind:explainer.render',
      'voice.edge-tts',
    ]);
    assert.equal(
      readState(env.stateDir, env.server.account)?.workerId,
      env.server.queue.state.worker?.id,
    );
    const output = [...env.lines, ...prompter.questions].join('\n');
    for (const secret of ['yenileme-', 'pkce_', 'sahte-imza'])
      assert.equal(output.includes(secret), false, secret);
    assert.match(output, /makine olarak kaydedildi/);

    // İkinci login: zaten giriş yapılmış
    const before = env.server.state.rotations;
    assert.equal(await main(env.deps(['login'], { prompter })), EXIT.ok);
    assert.match(env.lines.at(-1)!, /zaten giriş yapılmış/);
    assert.equal(env.server.state.rotations, before);
  } finally {
    await env.server.close();
  }
});

test('login --code: e-posta istenmez; panel koduyla giriş yapılır, makine kaydedilir, kod görünmez', async () => {
  const env = await setup({ paired: false });
  // Panelin ürettiği kodun yerine: sahte Auth'ta bekleyen tek kullanımlık özet
  const code = ['c0de', 'ab12'].join('').repeat(7);
  try {
    // Argüman olarak yazılan kod reddedilir ve yankılanmaz; Auth'a hiç gidilmez
    for (const argv of [
      ['login', '--code', code],
      ['login', `--code=${code}`],
    ]) {
      assert.equal(await main(env.deps(argv)), EXIT.usage);
      assert.match(env.lines.at(-1)!, /komut satırına yazılmaz/);
    }
    assert.equal(
      await main(env.deps(['login', '--code', '--password'])),
      EXIT.usage,
    );
    assert.equal(env.lines.join('\n').includes(code), false);
    assert.equal(env.server.state.requests.length, 0);

    // Yanlış kod: giriş reddedilir, kasaya bir şey yazılmaz
    env.server.state.login.tokenHash = code;
    assert.equal(
      await main(
        env.deps(['login', '--code'], {
          prompter: scripted([code.replace('c0de', 'dead')]),
        }),
      ),
      EXIT.error,
    );
    assert.match(env.lines.at(-1)!, /Giriş reddedildi/);
    assert.equal(env.store.items.size, 0);
    assert.equal(env.server.queue.state.worker === null, true);

    const prompter = scripted([` ${code} `]);
    assert.equal(
      await main(env.deps(['login', '--code'], { prompter })),
      EXIT.ok,
    );
    // Tek soru soruldu (e-posta sorulmadı) ve e-posta istenmedi
    assert.equal(prompter.questions.length, 1);
    assert.match(prompter.questions[0]!, /Giriş kodu/);
    assert.deepEqual(env.server.state.emailsSent, []);
    assert.equal(
      env.server.state.requests.includes('POST /auth/v1/otp'),
      false,
    );
    assert.equal(
      env.store.items.get(env.server.account),
      env.server.state.refreshToken,
    );
    // Oturum hemen makine olarak kaydedildi
    assert.equal(env.server.queue.state.worker?.name, 'Test Makinesi');
    const output = [...env.lines, ...prompter.questions].join('\n');
    for (const secret of [code, 'yenileme-', 'sahte-imza'])
      assert.equal(output.includes(secret), false, secret);
    assert.match(output, /makine olarak kaydedildi/);

    // Kod tek kullanımlık: aynı kodla ikinci giriş reddedilir
    assert.equal(
      await main(
        env.deps(['login', '--code', '--force'], {
          prompter: scripted([code]),
        }),
      ),
      EXIT.error,
    );
    assert.match(env.lines.at(-1)!, /Giriş reddedildi/);
  } finally {
    await env.server.close();
  }
});

test('login --password: parolayla giriş; yanlış parola kasaya bir şey yazmaz', async () => {
  const env = await setup({ paired: false });
  try {
    assert.equal(
      await main(
        env.deps(['login', '--password'], {
          prompter: scripted(['uye@ornek.com', 'yanlış']),
        }),
      ),
      EXIT.error,
    );
    assert.equal(env.store.items.size, 0);
    assert.equal(env.server.queue.state.worker, null);
    assert.match(env.lines.at(-1)!, /Giriş reddedildi/);

    assert.equal(
      await main(
        env.deps(['login', '--password'], {
          prompter: scripted(['uye@ornek.com', 'dogru-parola']),
        }),
      ),
      EXIT.ok,
    );
    assert.equal(
      env.store.items.get(env.server.account),
      env.server.state.refreshToken,
    );
    assert.equal(env.lines.join('\n').includes('dogru-parola'), false);
  } finally {
    await env.server.close();
  }
});

test('login: makine kaydedilemezse oturum kapatılır ve kasada kalmaz', async () => {
  const env = await setup({ paired: false });
  try {
    // Kayıt reddedilir (ör. hesap viewer)
    env.server.queue.state.revoked = true;
    assert.equal(
      await main(
        env.deps(['login', '--password'], {
          prompter: scripted(['uye@ornek.com', 'dogru-parola']),
        }),
      ),
      EXIT.error,
    );
    assert.equal(
      env.store.items.size,
      0,
      'sıradan üye oturumu kasada bırakılmaz',
    );
    assert.equal(env.server.state.logouts, 1);
    assert.equal(readState(env.stateDir, env.server.account), null);
    assert.match(env.lines.at(-1)!, /Oturum kapatıldı/);
  } finally {
    await env.server.close();
  }
});

test('login: vazgeçilirse (Ctrl+C) kasaya hiçbir şey yazılmaz', async () => {
  const env = await setup({ paired: false });
  try {
    const prompter = {
      ask: async () => 'uye@ornek.com',
      askHidden: async () => {
        env.signals.emit('SIGINT');
        return '';
      },
    };
    assert.equal(
      await main(env.deps(['login', '--password'], { prompter })),
      EXIT.error,
    );
    assert.equal(env.store.items.size, 0);
    assert.equal(readState(env.stateDir, env.server.account), null);
    assert.equal(env.server.state.rotations, 0);
  } finally {
    await env.server.close();
  }
});

test('status ve logout', async () => {
  const env = await setup();
  try {
    assert.equal(await main(env.deps(['status', '--json'])), EXIT.ok);
    const report = JSON.parse(env.lines.at(-1)!) as Record<string, unknown>;
    assert.equal(report.girisYapilmis, true);
    assert.equal(report.oturum, 'geçerli');
    assert.equal(report.calisiyor, false);
    assert.equal(report.sunucu, env.server.account);
    assert.equal(JSON.stringify(report).includes('yenileme'), false);

    assert.equal(await main(env.deps(['logout'])), EXIT.ok);
    assert.equal(env.server.state.logouts, 1);
    assert.equal(env.store.items.size, 0);
    assert.equal(await main(env.deps(['status'])), EXIT.notPaired);
    assert.match(env.lines.join('\n'), /Giriş için: pnpm worker:login/);
    assert.equal(await main(env.deps(['logout'])), EXIT.ok);
    assert.match(env.lines.at(-1)!, /giriş yapılmamış/);
  } finally {
    await env.server.close();
  }
});

// ── Gerçek süreç ─────────────────────────────────────────────────────────────
function childEnvironment(server: { url: string }, stateDir: string) {
  return {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: server.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
    WORKER_NAME: 'Duman Testi',
    WORKER_POLL_SECONDS: '1',
    WORKER_STATE_DIR: stateDir,
    WORKER_WORK_DIR: path.join(root, 'duman-is'),
    NO_COLOR: '1',
  };
}

test('gerçek süreç: selftest çevrimdışı çalışır; ayar yoksa 2 ile çıkar', () => {
  const selftest = spawnSync(process.execPath, [cli, 'selftest'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
  });
  assert.equal(selftest.status, EXIT.ok, selftest.stderr);
  assert.match(selftest.stdout, /Çevrimdışı deneme tamam/);
  const unset = spawnSync(process.execPath, [cli, 'status'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
    },
  });
  // Geliştirici makinesinde .env.local dolu olabilir: o zaman durum raporu döner
  assert.ok(
    [
      EXIT.usage,
      EXIT.ok,
      EXIT.notPaired,
      EXIT.noCredentialStore,
      EXIT.revoked,
    ].includes(unset.status as never),
  );
});

// Başlat-durdur duman testi: gerçek işletim sistemi kasası (macOS Keychain, Windows Credential
// Manager) + sahte Supabase. Linux CI'da anahtarlık servisi yoktur: program reddetmelidir.
test('gerçek süreç: başlat → iş yürüt → boşta dur (işletim sistemi kasasıyla)', async () => {
  const server = await startFakeSupabase('yenileme-0');
  const stateDir = path.join(root, 'duman-durum');
  const store = createCredentialStore({
    platform: process.platform as 'darwin' | 'win32' | 'linux',
    env: process.env,
  });
  const usable = (await store.available()).ok;
  try {
    if (!usable) {
      const refused = spawnSync(
        process.execPath,
        [cli, 'start', '--exit-when-idle'],
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 120_000,
          env: childEnvironment(server, stateDir),
        },
      );
      assert.equal(
        refused.status,
        EXIT.noCredentialStore,
        refused.stdout + refused.stderr,
      );
      assert.match(refused.stdout, /düz dosyada saklamaz/);
      assert.equal(server.state.requests.length, 0);
      return;
    }
    await store.set(server.account, 'yenileme-0');
    const job = server.queue.enqueue({
      ...SELFTEST,
      params: { steps: 2, stepMs: 20 },
    });
    const ran = await new Promise<{ code: number | null; output: string }>(
      (resolve) => {
        const child = spawn(
          process.execPath,
          [cli, 'start', '--exit-when-idle', '--json'],
          {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: childEnvironment(server, stateDir),
          },
        );
        let output = '';
        child.stdout.on(
          'data',
          (chunk: Buffer) => (output += chunk.toString('utf8')),
        );
        child.stderr.on(
          'data',
          (chunk: Buffer) => (output += chunk.toString('utf8')),
        );
        const timer = setTimeout(() => child.kill('SIGKILL'), 300_000);
        child.on('close', (code) => {
          clearTimeout(timer);
          resolve({ code, output });
        });
      },
    );
    assert.equal(ran.code, EXIT.ok, ran.output);
    assert.equal(job.status, 'awaiting_approval', ran.output);
    assert.equal(server.queue.state.worker?.name, 'Duman Testi');
    assert.equal(server.queue.state.worker?.platform, process.platform);
    assert.ok(
      server.queue.state.worker?.capabilities.includes('kind:clip.selftest'),
    );
    // Yenilenen token gerçek kasaya yazıldı; çıktıda yok
    assert.equal(await store.get(server.account), server.state.refreshToken);
    assert.equal(ran.output.includes(server.state.refreshToken), false);
    assert.equal(ran.output.includes('yenileme-0'), false);
  } finally {
    if (usable) await store.delete(server.account);
    await server.close();
  }
});

// Gerçek SIGINT yalnız POSIX'te gönderilebilir (Windows'ta kill süreci doğrudan sonlandırır;
// Ctrl+C yolu süreç içi testte ve sinyal bağlama testinde denenir).
test(
  'gerçek süreç: SIGINT süren işi kuyruğa bırakır ve 0 ile çıkar',
  { skip: process.platform === 'win32' },
  async (t) => {
    const store = createCredentialStore({
      platform: process.platform as 'darwin' | 'linux',
      env: process.env,
    });
    if (!(await store.available()).ok) {
      t.skip('bu makinede işletim sistemi kasası yok');
      return;
    }
    const server = await startFakeSupabase('yenileme-0');
    try {
      await store.set(server.account, 'yenileme-0');
      const job = server.queue.enqueue({
        ...SELFTEST,
        params: { steps: 50, stepMs: 200 },
      });
      const child = spawn(process.execPath, [cli, 'start', '--json'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: childEnvironment(server, path.join(root, 'sigint-durum')),
      });
      let output = '';
      child.stdout.on(
        'data',
        (chunk: Buffer) => (output += chunk.toString('utf8')),
      );
      const exited = new Promise<number | null>((resolve) =>
        child.on('close', resolve),
      );
      for (let i = 0; i < 1200 && job.stages[0]!.status !== 'running'; i++)
        await delay(50);
      assert.equal(job.stages[0]!.status, 'running', output);
      child.kill('SIGINT');
      assert.equal(await exited, EXIT.ok, output);
      assert.equal(job.status, 'queued');
      assert.equal(job.error, SHUTDOWN_MESSAGE);
      assert.match(output, /Durduruluyor/);
    } finally {
      await store.delete(server.account);
      await server.close();
    }
  },
);
