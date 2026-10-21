#!/usr/bin/env node
// Paneli tek komutla başlatır: doctor → (gerekirse) build → start → tarayıcı.
//   pnpm panel             başlat
//   pnpm panel --update    önce git pull + pnpm install, sonra başlat
//   pnpm panel --no-open   tarayıcıyı açma
//   pnpm panel --check     başlat, /login 200 dönüyor mu bak, kapat (CI duman testi)
//   pnpm panel --port 3001 farklı port
// Windows ve macOS'ta aynı çalışır.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  missingPanelEnv,
  needsBuild,
  openCommand,
  parseEnvFile,
  parsePanelArgs,
} from './lib/panel-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const panelDir = join(root, 'apps', 'panel');
const markerPath = join(panelDir, '.next', 'panel-build.json');
const isWin = process.platform === 'win32';

const step = (m) => console.log(`\n\x1b[1;34m==> ${m}\x1b[0m`);
const warn = (m) => console.log(`  \x1b[33m[!]\x1b[0m ${m}`);
const fail = (m) => {
  console.error(`\n\x1b[31m[HATA]\x1b[0m ${m}`);
  process.exit(1);
};

// pnpm üzerinden çağrıldıysa aynı pnpm'i kullan; yoksa PATH'teki (Windows'ta .cmd shim)
function pnpm(args, options = {}) {
  const execPath = process.env.npm_execpath;
  if (execPath && /pnpm/i.test(execPath)) {
    return {
      cmd: process.execPath,
      args: [execPath, ...args],
      shell: false,
      ...options,
    };
  }
  return { cmd: isWin ? 'pnpm.cmd' : 'pnpm', args, shell: isWin, ...options };
}

function run({ cmd, args, shell = false, env }, what) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell,
    env: { ...process.env, ...env },
  });
  if (r.error) fail(`${what} çalıştırılamadı: ${r.error.message}`);
  if (r.status !== 0) fail(`${what} başarısız oldu (çıkış kodu ${r.status}).`);
}

function git(args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

let opts;
try {
  opts = parsePanelArgs(process.argv.slice(2));
} catch (e) {
  fail(
    `${e.message}\nKullanım: pnpm panel [--update] [--no-open] [--check] [--port <n>]`,
  );
}
if (opts.help) {
  console.log(
    'Kullanım: pnpm panel [--update] [--no-open] [--check] [--port <n>]',
  );
  process.exit(0);
}

if (opts.update) {
  step('Güncelleme (git pull + pnpm install)');
  if (git(['status', '--porcelain', '--untracked-files=no'])) {
    fail(
      "Commit'lenmemiş değişikliklerin var. Önce commit'le veya geri al, sonra tekrar dene.",
    );
  }
  run({ cmd: 'git', args: ['pull', '--ff-only'] }, 'git pull');
  run(pnpm(['install', '--frozen-lockfile']), 'pnpm install');
}

step('Ortam kontrolü');
run(
  { cmd: process.execPath, args: [join(root, 'scripts', 'doctor.mjs')] },
  'doctor',
);

const envFile = join(root, '.env.local');
const env = existsSync(envFile)
  ? parseEnvFile(readFileSync(envFile, 'utf8'))
  : {};
const missing = missingPanelEnv({ ...env, ...process.env });
if (missing.length) {
  warn(
    `Supabase ayarlı değil (${missing.join(', ')}). Panel açılır ama giriş çalışmaz. ` +
      "Değerleri ekip parola yöneticisinden .env.local'a yaz.",
  );
}

const head = git(['rev-parse', 'HEAD']);
const dirtyPaths = (
  git(['status', '--porcelain', '--', 'apps', 'packages']) ?? ''
)
  .split('\n')
  .filter(Boolean);
let marker = null;
try {
  marker = JSON.parse(readFileSync(markerPath, 'utf8'));
} catch {
  // marker yok veya bozuk: build gerekir
}

if (needsBuild({ marker, head, dirtyPaths })) {
  step('Build (ilk seferde 1-2 dakika sürebilir)');
  run(pnpm(['build']), 'pnpm build');
  writeFileSync(
    markerPath,
    JSON.stringify({ commit: head, dirty: dirtyPaths.length > 0 }),
  );
} else {
  step('Build güncel, atlanıyor');
}

const url = `http://127.0.0.1:${opts.port}`;
step(`Panel başlatılıyor → ${url}`);
const start = pnpm(['start']);
const server = spawn(start.cmd, start.args, {
  cwd: root,
  stdio: opts.check ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  shell: start.shell,
  // --check'te süreç grubunu toplu kapatabilmek için (Unix)
  detached: opts.check && !isWin,
  env: { ...process.env, PORT: String(opts.port) },
});
if (opts.check) server.stdout.on('data', (d) => process.stdout.write(d));

let exiting = false;
function stopServer() {
  if (server.exitCode !== null) return;
  if (isWin)
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], {
      stdio: 'ignore',
    });
  else if (opts.check) process.kill(-server.pid, 'SIGTERM');
  else server.kill('SIGTERM');
}

server.on('exit', (code) => {
  if (exiting) return;
  fail(
    code === 0
      ? 'Panel beklenmedik şekilde kapandı.'
      : `Panel başlatılamadı (çıkış kodu ${code}). Port ${opts.port} kullanılıyor olabilir: pnpm panel --port ${opts.port + 1}`,
  );
});

async function waitForLogin(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/login`, { redirect: 'manual' });
      if (res.status === 200) return true;
    } catch {
      // sunucu henüz hazır değil
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

const ready = await waitForLogin(90_000);
if (opts.check) {
  exiting = true;
  stopServer();
  if (!ready) fail(`${url}/login 90 saniyede 200 dönmedi.`);
  console.log(
    `\n\x1b[32m[OK]\x1b[0m ${url}/login 200 döndü, sunucu kapatıldı.`,
  );
  process.exit(0);
}
if (!ready) warn('Panel 90 saniyede yanıt vermedi, terminaldeki çıktıya bak.');
else if (opts.open) {
  const { cmd, args } = openCommand(process.platform, url);
  spawn(cmd, args, { stdio: 'ignore', detached: true })
    .on('error', () => warn(`Tarayıcı açılamadı, elle aç: ${url}`))
    .unref();
}
console.log(`\nPanel çalışıyor: ${url}  (kapatmak için Ctrl+C)`);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    exiting = true;
    stopServer();
    process.exit(0);
  });
}
