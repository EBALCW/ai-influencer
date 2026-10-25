#!/usr/bin/env node
// Supabase Postgres yedeği (şema + veri) ve yerel Supabase'e geri yükleme.
//   pnpm backup                         yedek al → ~/ai-influencer-backups/<zaman>/
//   pnpm backup --out <klasör>          farklı klasöre yaz (repo içi yasak)
//   pnpm backup:restore <yedek-klasörü> yedeği YEREL Supabase'e geri yükle
//
// Gereksinim: PostgreSQL istemci araçları (pg_dump, psql), sunucuyla aynı ana sürüm (17).
// Bağlantı: .env.local → SUPABASE_DB_URL (Supabase → Project Settings → Database →
// Connection string). Şifre komut satırına yazılmaz, PGPASSWORD env'i ile verilir.
// Storage dosyaları henüz yedeklenmiyor (bucket'lar #45 ile gelecek).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  backupDirName,
  backupPlan,
  isInside,
  isLocalHost,
  parseEnvFile,
  pgConnection,
} from './lib/panel-lib.mjs';

import {
  writeBackupManifest,
  verifyBackupManifest,
} from './lib/backup-integrity.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const ok = (m) => console.log(`  \x1b[32m[OK]\x1b[0m ${m}`);
const fail = (m) => {
  console.error(`\x1b[31m[HATA]\x1b[0m ${m}`);
  process.exit(1);
};

function requireTool(name) {
  const r = spawnSync(name, ['--version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    fail(
      `${name} bulunamadı. PostgreSQL istemci araçlarını kur (sunucuyla aynı ana sürüm, 17):\n` +
        "  macOS:   brew install postgresql@17   (sonra PATH için brew'in verdiği satırı ekle)\n" +
        '  Windows: PostgreSQL 17 kurulumunda "Command Line Tools" seç ve bin klasörünü PATH\'e ekle',
    );
  }
  return r.stdout.trim();
}

function loadEnv() {
  const file = join(root, '.env.local');
  const fromFile = existsSync(file)
    ? parseEnvFile(readFileSync(file, 'utf8'))
    : {};
  return { ...fromFile, ...process.env };
}

async function backup(argv) {
  const outIdx = argv.indexOf('--out');
  const base =
    outIdx >= 0
      ? resolve(argv[outIdx + 1] ?? '')
      : join(homedir(), 'ai-influencer-backups');
  if (isInside(base, root, sep)) {
    fail(
      'Yedek klasörü repo içinde olamaz (repo public). Varsayılanı kullan veya --out ile repo dışını ver.',
    );
  }

  const dbUrl = loadEnv().SUPABASE_DB_URL;
  if (!dbUrl) {
    fail(
      "SUPABASE_DB_URL tanımlı değil. .env.local'a ekle (değer ekip parola yöneticisinde).\n" +
        'Supabase → Project Settings → Database → Connection string (Session pooler, URI).',
    );
  }
  const conn = pgConnection(dbUrl);
  console.log(requireTool('pg_dump'));

  const dir = join(base, backupDirName(new Date()));
  mkdirSync(base, { recursive: true, mode: 0o700 });
  // Aynı saniyede ikinci çalıştırma önceki yedeği ezmesin.
  mkdirSync(dir, { mode: 0o700 });
  console.log(`Yedek klasörü: ${dir}`);

  for (const part of backupPlan()) {
    const file = join(dir, part.file);
    const r = spawnSync(
      'pg_dump',
      [...conn.args, ...part.args, '--file', file],
      {
        stdio: ['ignore', 'inherit', 'inherit'],
        env: { ...process.env, ...conn.env },
      },
    );
    if (r.status !== 0)
      fail(`${part.file} alınamadı (pg_dump çıkış kodu ${r.status}).`);
    ok(`${part.file} (${Math.round(statSync(file).size / 1024)} KB)`);
  }
  await writeBackupManifest(dir);
  await verifyBackupManifest(dir);
  ok('SHA-256 bütünlük kontrolü');
  console.log(
    `\nYedek tamam. Geri yükleme testi için: pnpm backup:restore "${dir}"\n` +
      "Bu klasör hassas veri içerir: repoya, issue'ya veya sohbete koyma.",
  );
}

async function restore(argv) {
  const dir = argv[0] ? resolve(argv[0]) : null;
  if (!dir || !existsSync(dir))
    fail('Kullanım: pnpm backup:restore <yedek-klasörü>');
  await verifyBackupManifest(dir);
  ok('SHA-256 bütünlük kontrolü');

  // Sadece yerel Supabase'e geri yüklenir: ortak/production projeyi yanlışlıkla ezmemek için
  const conn = pgConnection(process.env.RESTORE_DB_URL ?? LOCAL_DB_URL);
  if (!isLocalHost(conn.host))
    fail("Geri yükleme sadece yerel Supabase'e (127.0.0.1) yapılabilir.");
  requireTool('psql');

  console.log(
    "Şema migration'lardan kurulur: önce `pnpm supabase:start` ve `pnpm supabase:db-reset` çalıştırılmış olmalı.\n" +
      'Seed verisi silinip yedekteki veri yüklenecek.',
  );
  // Trigger'lar (created_by, updated_at) yedekteki değerleri ezmesin diye replica modu
  const env = {
    ...process.env,
    ...conn.env,
    PGOPTIONS: '-c session_replication_role=replica',
  };
  const psql = (args) =>
    spawnSync(
      'psql',
      [...conn.args, '-v', 'ON_ERROR_STOP=1', '--quiet', ...args],
      {
        stdio: 'inherit',
        env,
      },
    );

  const truncate = psql([
    '-c',
    "do $$ declare r record; begin for r in select tablename from pg_tables where schemaname = 'public' loop execute format('truncate table public.%I cascade', r.tablename); end loop; end $$; delete from auth.identities; delete from auth.users;",
  ]);
  if (truncate.status !== 0)
    fail(
      'Yerel veritabanı temizlenemedi. Yerel Supabase çalışıyor mu? (pnpm supabase:status)',
    );

  for (const f of ['data-auth.sql', 'data-public.sql']) {
    const r = psql(['-f', join(dir, f)]);
    if (r.status !== 0) fail(`${f} yüklenemedi.`);
    ok(f);
  }
  console.log(
    '\nGeri yükleme tamam. Paneli yerel Supabase değerleriyle açıp veriyi kontrol et.',
  );
}

process.umask(0o077);
const [mode, ...rest] = process.argv.slice(2);
try {
  if (mode === 'restore') await restore(rest);
  else if (mode === 'verify') {
    if (!rest[0]) fail('Kullanım: pnpm backup:verify <yedek-klasörü>');
    await verifyBackupManifest(resolve(rest[0]));
    ok('SHA-256 bütünlük kontrolü');
  } else await backup(process.argv.slice(2));
} catch {
  fail(
    'Yedek işlemi tamamlanamadı. Dosyaları ve manifesti kontrol edin; güncel pnpm backup ile yeni yedek alın.',
  );
}
