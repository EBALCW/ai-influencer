#!/usr/bin/env node
// Kurulum sağlık kontrolü. Kullanım: pnpm doctor  (veya node scripts/doctor.mjs)
// Windows ve macOS'ta aynı çalışır. Zorunlu bir kontrol başarısızsa exit 1.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const wantNode = readFileSync(join(root, '.nvmrc'), 'utf8').trim();
const wantPnpm = pkg.packageManager.split('@')[1];

const run = (cmd) => {
  try {
    return execSync(cmd, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
      .toString()
      .trim();
  } catch {
    return null;
  }
};

const checks = [
  {
    name: 'Node.js',
    required: true,
    test: () => {
      const v = process.versions.node;
      return [v.split('.')[0] === wantNode, `v${v} (beklenen: ${wantNode}.x)`];
    },
  },
  {
    name: 'pnpm',
    required: true,
    test: () => {
      const v = run('pnpm -v');
      return [
        v === wantPnpm,
        v ? `${v} (beklenen: ${wantPnpm})` : 'bulunamadı',
      ];
    },
  },
  {
    name: 'git',
    required: true,
    test: () => {
      const v = run('git --version');
      return [!!v, v ?? 'bulunamadı'];
    },
  },
  {
    name: 'git satır sonu',
    required: false,
    test: () => {
      const v = run('git config --get core.autocrlf');
      return [
        v !== 'true',
        v === 'true'
          ? 'core.autocrlf=true (.gitattributes ile çakışabilir: git config --global core.autocrlf false)'
          : 'uygun',
      ];
    },
  },
  {
    name: 'GitHub CLI',
    required: true,
    test: () => {
      const v = run('gh --version');
      return [!!v, v ? v.split('\n')[0] : 'bulunamadı'];
    },
  },
  {
    name: 'GitHub girişi',
    required: false,
    test: () => {
      const ok = run('gh auth status') !== null;
      return [ok, ok ? 'giriş yapılmış' : 'gh auth login çalıştır'];
    },
  },
  {
    name: 'VS Code',
    required: false,
    test: () => {
      const v = run('code --version');
      return [!!v, v ? v.split('\n')[0] : "'code' komutu bulunamadı"];
    },
  },
  {
    name: 'node_modules',
    required: true,
    test: () => {
      const ok = existsSync(join(root, 'node_modules'));
      return [ok, ok ? 'kurulu' : 'pnpm install çalıştır'];
    },
  },
  {
    name: '.env.local',
    required: false,
    test: () => {
      const p = join(root, '.env.local');
      if (!existsSync(p)) return [false, 'yok (cp .env.example .env.local)'];
      const empty = readFileSync(p, 'utf8')
        .split(/\r?\n/)
        .filter((l) => /^[A-Z_]+=\s*$/.test(l)).length;
      return [empty === 0, empty ? `${empty} değer boş` : 'dolu'];
    },
  },
];

let failed = 0;
console.log(`\nAI Influencer doctor — ${process.platform} ${process.arch}\n`);
for (const c of checks) {
  const [ok, detail] = c.test();
  const mark = ok
    ? '\x1b[32m[OK]\x1b[0m '
    : c.required
      ? '\x1b[31m[HATA]\x1b[0m'
      : '\x1b[33m[UYARI]\x1b[0m';
  console.log(`${mark} ${c.name.padEnd(16)} ${detail}`);
  if (!ok && c.required) failed++;
}
console.log(
  failed
    ? `\n${failed} zorunlu kontrol başarısız. docs/SETUP.md > Sık Sorunlar bölümüne bak.\n`
    : '\nHer şey hazır.\n',
);
process.exit(failed ? 1 : 0);
