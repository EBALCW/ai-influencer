#!/usr/bin/env node
// Yerel geliştirme anahtarlarını GitHub'daki `local-dev` ortamından güvenli şekilde çeker.
// Kullanım: pnpm env:pull
//
// GitHub secret'ları geri okunamaz. Bu yüzden:
//  1. "Yerel env (şifreli)" workflow'u tetiklenir (repoda yazma yetkisi gerekir).
//  2. Workflow secret'ları, GitHub hesabındaki SSH public key'inle (age) şifreleyip artifact yapar.
//  3. Script artifact'ı indirir, ~/.ssh altındaki özel anahtarınla çözer ve .env.local'e yazar.
// Repo public olsa da artifact şifrelidir; açabilen tek kişi sensin.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOW = 'env-pull.yml';
const isWin = process.platform === 'win32';

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: isWin, // gh/age/ssh-keygen Windows'ta .exe/.cmd olabilir
    ...opts,
  }).trim();
const has = (cmd) => {
  try {
    run(cmd, ['--version']);
    return true;
  } catch {
    try {
      run(cmd, ['-version']);
      return true;
    } catch {
      return false;
    }
  }
};
const fail = (msg) => {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
};
const step = (msg) => console.log(`→ ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1. Araçlar
if (!has('gh'))
  fail(
    "GitHub CLI (gh) bulunamadı. Önce kurulum script'ini çalıştır (docs/SETUP.md).",
  );
try {
  run('gh', ['auth', 'status']);
} catch {
  fail('GitHub girişi yok: gh auth login --web --git-protocol https');
}
if (!has('age')) {
  fail(
    `age bulunamadı. Kur: ${isWin ? 'winget install --id FiloSottile.age -e' : 'brew install age'} (ya da kurulum script'ini tekrar çalıştır)`,
  );
}

// 2. SSH anahtarı: yerelde var mı, GitHub hesabına ekli mi?
const sshDir = join(homedir(), '.ssh');
let identity = ['id_ed25519', 'id_rsa']
  .map((n) => join(sshDir, n))
  .find((p) => existsSync(p));
if (!identity) {
  step('SSH anahtarı yok, oluşturuluyor (~/.ssh/id_ed25519)');
  identity = join(sshDir, 'id_ed25519');
  run('ssh-keygen', [
    '-t',
    'ed25519',
    '-N',
    '',
    '-C',
    'ai-influencer-env',
    '-f',
    identity,
  ]);
}
const pub = readFileSync(`${identity}.pub`, 'utf8').trim();
const pubCore = pub.split(/\s+/).slice(0, 2).join(' ');
const login = run('gh', ['api', 'user', '--jq', '.login']);
const remoteKeys = await fetch(`https://github.com/${login}.keys`).then((r) =>
  r.text(),
);
if (!remoteKeys.split('\n').some((k) => k.trim().startsWith(pubCore))) {
  step(`SSH public key GitHub hesabına (${login}) ekleniyor`);
  try {
    run('gh', [
      'ssh-key',
      'add',
      `${identity}.pub`,
      '--title',
      'ai-influencer env:pull',
    ]);
  } catch {
    fail(
      "SSH anahtarı GitHub'a eklenemedi. Yetki ver ve tekrar dene:\n  gh auth refresh -h github.com -s admin:public_key\n  pnpm env:pull",
    );
  }
}

// 3. Workflow'u tetikle ve bekle
const requestId = randomUUID();
step('Şifreli paket isteniyor (Actions → "Yerel env (şifreli)")');
try {
  run('gh', [
    'workflow',
    'run',
    WORKFLOW,
    '--ref',
    'main',
    '-f',
    `request_id=${requestId}`,
  ]);
} catch (e) {
  fail(
    `Workflow tetiklenemedi: ${String(e.stderr || e.message).split('\n')[0]}`,
  );
}

let runId;
for (let i = 0; i < 60 && !runId; i++) {
  await sleep(3000);
  const list = JSON.parse(
    run('gh', [
      'run',
      'list',
      '--workflow',
      WORKFLOW,
      '--limit',
      '20',
      '--json',
      'databaseId,displayTitle',
    ]),
  );
  runId = list.find((r) => r.displayTitle.includes(requestId))?.databaseId;
}
if (!runId)
  fail('Workflow çalışması bulunamadı (3 dk). Actions sekmesine bak.');

let conclusion = '';
for (let i = 0; i < 100; i++) {
  const v = JSON.parse(
    run('gh', ['run', 'view', String(runId), '--json', 'status,conclusion']),
  );
  if (v.status === 'completed') {
    conclusion = v.conclusion;
    break;
  }
  await sleep(3000);
}
if (conclusion !== 'success') {
  fail(
    `Workflow başarısız (${conclusion || 'zaman aşımı'}). Ayrıntı: gh run view ${runId} --log-failed`,
  );
}

// 4. İndir, çöz, .env.local'e yaz
const tmp = mkdtempSync(join(tmpdir(), 'ai-inf-env-'));
let values = {};
try {
  run('gh', [
    'run',
    'download',
    String(runId),
    '-n',
    `env-${requestId}`,
    '-D',
    tmp,
  ]);
  const plain = run('age', ['-d', '-i', identity, join(tmp, 'env.age')]);
  for (const line of plain.split(/\r?\n/)) {
    const i = line.indexOf('=');
    if (i > 0) values[line.slice(0, i)] = line.slice(i + 1);
  }
} catch (e) {
  fail(`Paket çözülemedi: ${String(e.stderr || e.message).split('\n')[0]}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
  // Şifreli de olsa artifact'ı hemen sil
  try {
    const ids = run('gh', [
      'api',
      `repos/{owner}/{repo}/actions/runs/${runId}/artifacts`,
      '--jq',
      '.artifacts[].id',
    ]);
    for (const id of ids.split('\n').filter(Boolean)) {
      run('gh', [
        'api',
        '-X',
        'DELETE',
        `repos/{owner}/{repo}/actions/artifacts/${id}`,
      ]);
    }
  } catch {
    // retention 1 gün; silinemese de kendiliğinden kalkar
  }
}

const envPath = join(root, '.env.local');
if (!existsSync(envPath)) copyFileSync(join(root, '.env.example'), envPath);
const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
const seen = new Set();
const out = lines.map((line) => {
  const k = /^([A-Z0-9_]+)=/.exec(line)?.[1];
  if (k && k in values) {
    seen.add(k);
    return `${k}=${values[k]}`;
  }
  return line;
});
for (const [k, v] of Object.entries(values))
  if (!seen.has(k)) out.push(`${k}=${v}`);
writeFileSync(envPath, `${out.join('\n').replace(/\n+$/, '')}\n`);
if (!isWin) chmodSync(envPath, 0o600);

console.log(
  `\n✓ .env.local güncellendi: ${Object.keys(values).join(', ') || '(değer yok)'}`,
);
console.log('  Değerler ekrana yazılmadı. Paneli başlat: pnpm panel\n');
