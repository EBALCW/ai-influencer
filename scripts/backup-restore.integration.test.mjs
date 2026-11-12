// pnpm backup:restore için gerçek veritabanı testi: import yarıda kalırsa yerel veri korunuyor mu?
// Yerel veriyi silebildiği için sadece RESTORE_INTEGRATION=1 ile çalışır (CI'da ayarlı).
// Gereksinim: çalışan yerel Supabase (127.0.0.1:54322, seed yüklü) ve psql.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeBackupManifest } from './lib/backup-integrity.mjs';
import { backupPlan, pgConnection } from './lib/panel-lib.mjs';
import { restoreEnvironment } from './lib/restore-args.mjs';

const enabled = process.env.RESTORE_INTEGRATION === '1';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const conn = pgConnection(
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
);
// Testin kendi sorguları da yalnız sabit yerel hedefe gitmeli.
const probeEnvironment = restoreEnvironment(process.env, conn.env);
delete probeEnvironment.PGOPTIONS; // postgres test rolünde replica modu gerekmez.

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
    { encoding: 'utf8', env: probeEnvironment },
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

function restore(dir, overrides = {}) {
  return spawnSync(
    process.execPath,
    [join(root, 'scripts', 'backup.mjs'), 'restore', dir],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        RESTORE_DB_URL:
          'postgresql://supabase_admin:postgres@127.0.0.1:54322/postgres',
        ...overrides,
      },
    },
  );
}

function query(sql) {
  const result = spawnSync(
    'psql',
    [...conn.args, '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    {
      encoding: 'utf8',
      env: probeEnvironment,
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function digest() {
  // Sadece özet döner; satır içerikleri test loglarına çıkmaz.
  return [
    'public.influencers',
    'public.posts',
    'auth.users',
    'auth.identities',
  ].map((table) =>
    query(
      `select md5(coalesce(string_agg(to_jsonb(t)::text, '' order by to_jsonb(t)::text), '')) from ${table} t`,
    ),
  );
}

test(
  'backup → veri değişikliği → restore: gerçek dump kaynak veriyi geri getirir',
  { skip: !enabled && 'RESTORE_INTEGRATION=1 değil' },
  () => {
    assert.notEqual(rowCounts().split(',')[0], '0', 'seed verisi yüklü olmalı');
    const before = digest();
    const base = mkdtempSync(join(tmpdir(), 'backup-roundtrip-'));
    try {
      const saved = spawnSync(
        process.execPath,
        [join(root, 'scripts', 'backup.mjs'), '--out', base],
        {
          encoding: 'utf8',
          env: {
            ...probeEnvironment,
            SUPABASE_DB_URL:
              'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
          },
        },
      );
      assert.equal(saved.status, 0, saved.stderr);
      const folders = readdirSync(base);
      assert.equal(folders.length, 1);
      query(
        "update public.influencers set name = 'restore-roundtrip-local-test'",
      );
      assert.notDeepEqual(
        digest(),
        before,
        'deneme gerçekten veri değiştirmeli',
      );
      const loaded = restore(join(base, folders[0]));
      assert.equal(loaded.status, 0, loaded.stderr);
      assert.deepEqual(
        digest(),
        before,
        'tüm seçili satırların içeriği birebir geri gelmeli',
      );
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  },
);

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
      const r = restore(dir, {
        // Eski kod yerel sunucu yerine bu adrese bağlanmayı denerdi.
        // Hata ikinci SQL dosyasından gelmeli; ağ/service hatası kabul edilmez.
        PGHOSTADDR: '192.0.2.123',
        PGSERVICE: 'nonexistent-restore-test-service',
        PGSERVICEFILE: join(dir, 'missing-service.conf'),
        PGCONNECT_TIMEOUT: '1',
      });
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
