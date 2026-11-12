// pnpm backup:restore için gerçek veritabanı testi: import yarıda kalırsa yerel veri korunuyor mu?
// Yerel veriyi silebildiği için sadece RESTORE_INTEGRATION=1 ile çalışır (CI'da ayarlı).
// Gereksinim: çalışan yerel Supabase (127.0.0.1:54322, seed yüklü) ve psql.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeBackupManifest } from './lib/backup-integrity.mjs';
import { backupPlan, pgConnection } from './lib/panel-lib.mjs';

const enabled = process.env.RESTORE_INTEGRATION === '1';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const conn = pgConnection(
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
);

function rowCounts() {
  const r = spawnSync(
    'psql',
    [
      ...conn.args,
      '-X',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      "select (select count(*) from public.influencers) || ',' || (select count(*) from public.posts) || ',' || (select count(*) from auth.users)",
    ],
    { encoding: 'utf8', env: { ...process.env, ...conn.env } },
  );
  assert.equal(r.status, 0, `psql sayım sorgusu başarısız: ${r.stderr}`);
  return r.stdout.trim();
}

/** Tüm yedek dosyaları geçerli; sadece `overrides` içindekiler verilen SQL ile değişir. */
async function fakeBackup(overrides) {
  const dir = mkdtempSync(join(tmpdir(), 'restore-test-'));
  for (const { file } of backupPlan())
    writeFileSync(join(dir, file), overrides[file] ?? 'select 1;\n');
  await writeBackupManifest(dir);
  return dir;
}

function restore(dir) {
  return spawnSync(
    process.execPath,
    [join(root, 'scripts', 'backup.mjs'), 'restore', dir],
    { encoding: 'utf8' },
  );
}

test(
  'restore: ikinci dosya hata verirse temizlik dahil her şey geri alınır',
  { skip: !enabled && 'RESTORE_INTEGRATION=1 değil' },
  async () => {
    const before = rowCounts();
    assert.notEqual(
      before.split(',')[0],
      '0',
      'seed verisi yüklü olmalı (pnpm supabase:db-reset)',
    );
    const dir = await fakeBackup({ 'data-public.sql': 'select 1/0;\n' });
    try {
      const r = restore(dir);
      assert.notEqual(r.status, 0, 'hatalı yedek başarısız dönmeli');
      // Bağlantı hatası da başarısız döner ve veriyi "korur"; hatanın gerçekten
      // temizlikten SONRA, ikinci dosyada oluştuğunu doğrula
      assert.match(r.stderr, /division by zero/);
      assert.equal(rowCounts(), before, 'yerel veri aynen korunmalı');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

test(
  'restore: geçerli yedekte temizlik ve import birlikte kalıcı olur',
  { skip: !enabled && 'RESTORE_INTEGRATION=1 değil' },
  async () => {
    const dir = await fakeBackup({});
    try {
      const r = restore(dir);
      assert.equal(r.status, 0, r.stderr);
      assert.equal(rowCounts(), '0,0,0');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);
