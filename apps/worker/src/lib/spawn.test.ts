import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { AbortedError, PermanentError } from './errors.ts';
import {
  childEnv,
  killPlan,
  positionalArg,
  runProcess,
  taskkillPath,
  validateCommand,
} from './spawn.ts';

const node = process.execPath;
const cwd = os.tmpdir();

test('komut doğrulama: tam yol, toplu iş dosyası yok, NUL yok', () => {
  assert.doesNotThrow(() =>
    validateCommand('/usr/bin/ffmpeg', ['-i', 'a b.mp4'], '/tmp', 'linux'),
  );
  assert.doesNotThrow(() =>
    validateCommand(
      'C:\\ffmpeg\\ffmpeg.exe',
      ['-i', 'a.mp4'],
      'C:\\is',
      'win32',
    ),
  );
  const bad: [string, string[], string, NodeJS.Platform][] = [
    ['ffmpeg', [], '/tmp', 'linux'],
    ['./ffmpeg', [], '/tmp', 'linux'],
    ['', [], '/tmp', 'linux'],
    ['/usr/bin/ffmpeg\0x', [], '/tmp', 'linux'],
    ['/usr/bin/ffmpeg', ['a\0b'], '/tmp', 'linux'],
    ['/usr/bin/ffmpeg', [], 'goreli', 'linux'],
    ['C:\\araclar\\hf.cmd', [], 'C:\\is', 'win32'],
    ['C:\\araclar\\HF.BAT', [], 'C:\\is', 'win32'],
    ['ffmpeg.exe', [], 'C:\\is', 'win32'],
    ['/usr/bin/ffmpeg', ['x'.repeat(40_000)], '/tmp', 'linux'],
  ];
  for (const [file, args, dir, platform] of bad)
    assert.throws(
      () => validateCommand(file, args, dir, platform),
      PermanentError,
      file,
    );
  assert.throws(
    () => validateCommand('/x', [1 as unknown as string], '/tmp', 'linux'),
    PermanentError,
  );
});

test('veriden gelen argüman seçenek sanılmaz', () => {
  assert.equal(positionalArg('-rf'), './-rf');
  assert.equal(positionalArg('--output=/etc/passwd'), './--output=/etc/passwd');
  assert.equal(positionalArg('video.mp4'), 'video.mp4');
  assert.throws(() => positionalArg('a\0b'), PermanentError);
});

test('alt sürecin ortamı izin listesinden geçer', () => {
  const env = childEnv(
    {
      PATH: '/usr/bin',
      Path: 'C:\\Windows',
      HOME: '/home/o',
      SUPABASE_SERVICE_ROLE_KEY: 'gizli',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      ANTHROPIC_API_KEY: 'gizli',
      AIW_CRED_TARGET: 'x',
      NODE_OPTIONS: '--require /tmp/kotu.js',
      LD_PRELOAD: '/tmp/kotu.so',
      SystemRoot: 'C:\\Windows',
      BOS: undefined,
    },
    { FFREPORT: 'level=32' },
  );
  assert.deepEqual(env, {
    PATH: '/usr/bin',
    Path: 'C:\\Windows',
    HOME: '/home/o',
    SystemRoot: 'C:\\Windows',
    FFREPORT: 'level=32',
  });
});

test('süreç ağacını öldürme planı: POSIX süreç grubu, Windows taskkill /T', () => {
  assert.deepEqual(killPlan(4321, 'linux', {}, false), {
    kind: 'signal',
    target: -4321,
    signal: 'SIGTERM',
  });
  assert.deepEqual(killPlan(4321, 'darwin', {}, true), {
    kind: 'signal',
    target: -4321,
    signal: 'SIGKILL',
  });
  assert.deepEqual(killPlan(4321, 'win32', { SystemRoot: 'D:\\Win' }, false), {
    kind: 'command',
    file: 'D:\\Win\\System32\\taskkill.exe',
    args: ['/PID', '4321', '/T', '/F'],
  });
  assert.equal(taskkillPath({}), 'C:\\Windows\\System32\\taskkill.exe');
});

test('argümanlar kabuktan geçmez: özel karakterler olduğu gibi ulaşır', async () => {
  const tricky = [
    'a b',
    '$(touch /tmp/kotu)',
    '`id`',
    '; rm -rf ~',
    '&& echo x',
    '| cat',
    '"çift"',
    "'tek'",
    '%PATH%',
    '^&',
    '> cikti',
    '*',
    'satır\nsonu',
    '',
  ];
  const result = await runProcess(
    node,
    [
      '-e',
      'process.stdout.write(JSON.stringify(process.argv.slice(1)))',
      '--',
      ...tricky,
    ],
    { cwd, timeoutMs: 20_000 },
  );
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), tricky);
});

test('stdin kapalı, çıkış kodu ve hata çıktısı döner, sırlar alt sürece geçmez', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-gizli-degil';
  try {
    const result = await runProcess(
      node,
      [
        '-e',
        `process.stdin.on('data', () => {}); process.stdin.on('end', () => {
           console.error('stdin bitti');
           console.log(String(process.env.SUPABASE_SERVICE_ROLE_KEY));
           process.exit(7);
         });`,
      ],
      { cwd, timeoutMs: 20_000 },
    );
    assert.equal(result.code, 7);
    assert.equal(result.stdout.trim(), 'undefined');
    assert.match(result.stderr, /stdin bitti/);
    assert.equal(result.timedOut, false);
  } finally {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});

test('süre aşımında süreç öldürülür', async () => {
  const started = Date.now();
  const result = await runProcess(node, ['-e', 'setInterval(() => {}, 1000)'], {
    cwd,
    timeoutMs: 400,
    killGraceMs: 300,
  });
  assert.equal(result.timedOut, true);
  assert.notEqual(result.code, 0);
  assert.ok(Date.now() - started < 15_000);
});

test('iptalde torun süreçler de ölür (süreç ağacı)', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'aiw-spawn-'));
  const pidFile = path.join(dir, 'torun.pid');
  const script = path.join(dir, 'ana.cjs');
  // Ana süreç bir torun başlatır; torun SIGTERM'i yok sayar ve sonsuza kadar bekler.
  writeFileSync(
    script,
    `const { spawn } = require('node:child_process');
     const child = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"], { stdio: 'ignore' });
     require('node:fs').writeFileSync(process.argv[2], String(child.pid));
     process.on('SIGTERM', () => {});
     setInterval(() => {}, 1000);`,
  );
  const controller = new AbortController();
  try {
    const running = runProcess(node, [script, pidFile], {
      cwd: dir,
      timeoutMs: 60_000,
      signal: controller.signal,
      killGraceMs: 500,
    });
    let grandchild = 0;
    for (let i = 0; i < 200 && !grandchild; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      try {
        grandchild = Number(readFileSync(pidFile, 'utf8'));
      } catch {
        // henüz yazılmadı
      }
    }
    assert.ok(grandchild > 0, 'torun süreç başlamalı');
    controller.abort();
    const result = await running;
    assert.equal(result.aborted, true);
    let alive = true;
    for (let i = 0; i < 100 && alive; i++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      try {
        process.kill(grandchild, 0);
      } catch {
        alive = false;
      }
    }
    assert.equal(alive, false, 'torun süreç ölmüş olmalı');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('çıktı sınırlanır; önceden iptal edilmiş sinyalle hiç başlamaz; olmayan dosya kalıcı hatadır', async () => {
  const big = await runProcess(
    node,
    ['-e', "process.stdout.write('x'.repeat(200000))"],
    { cwd, timeoutMs: 20_000, maxOutputBytes: 1000 },
  );
  assert.equal(big.stdout.length, 1000);
  assert.equal(big.truncated, true);

  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    runProcess(node, ['-e', '0'], {
      cwd,
      timeoutMs: 1000,
      signal: controller.signal,
    }),
    AbortedError,
  );
  await assert.rejects(
    runProcess(path.join(cwd, 'yok-boyle-bir-program'), [], {
      cwd,
      timeoutMs: 5000,
    }),
    PermanentError,
  );
  assert.throws(
    () => runProcess(node, [], { cwd, timeoutMs: 0 }),
    PermanentError,
  );
});
