import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  writeBackupManifest,
  verifyBackupManifest,
} from './backup-integrity.mjs';

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'backup-integrity-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const name of ['schema.sql', 'data-auth.sql', 'data-public.sql'])
    await writeFile(join(dir, name), '-- synthetic fixture\n');
  return dir;
}

test('tam yedek manifesti ve veritabanına bağlanmayan verify komutu', async (t) => {
  const dir = await fixture(t);
  await writeBackupManifest(dir);
  assert.deepEqual(await verifyBackupManifest(dir), { files: 3 });
  const cli = fileURLToPath(new URL('../backup.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'verify', dir], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('aynı boyutlu bozulma SHA-256 ile yakalanır', async (t) => {
  const dir = await fixture(t);
  await writeBackupManifest(dir);
  await writeFile(join(dir, 'data-public.sql'), '-- synthetic fixturE\n');
  await assert.rejects(verifyBackupManifest(dir), /bütünlük/);
});

test('eksik veya boş dump ve yarım yedek reddedilir', async (t) => {
  const dir = await fixture(t);
  await assert.rejects(verifyBackupManifest(dir), /manifest/);
  await writeFile(join(dir, 'data-auth.sql'), '');
  await assert.rejects(writeBackupManifest(dir), /boş/);
  await writeFile(join(dir, 'data-auth.sql'), 'fixture');
  await writeBackupManifest(dir);
  await unlink(join(dir, 'schema.sql'));
  await assert.rejects(verifyBackupManifest(dir));
});

test('değiştirilmiş manifest yolları, tekrarlar ve sürüm reddedilir', async (t) => {
  const dir = await fixture(t);
  await writeBackupManifest(dir);
  const path = join(dir, 'manifest.json');
  const original = JSON.parse(await readFile(path, 'utf8'));
  for (const change of [
    (m) => {
      m.files[0].file = '../outside.sql';
    },
    (m) => {
      m.files[1] = m.files[0];
    },
    (m) => {
      m.version = 2;
    },
    (m) => {
      m.files[0].sha256 = 'broken';
    },
    (m) => {
      m.files.pop();
    },
  ]) {
    const value = structuredClone(original);
    change(value);
    await writeFile(path, JSON.stringify(value));
    await assert.rejects(verifyBackupManifest(dir));
  }
});

test('bozuk yedek restore araçlarına ulaşmadan durur', async (t) => {
  const dir = await fixture(t);
  await writeBackupManifest(dir);
  await writeFile(join(dir, 'data-auth.sql'), 'corrupt');
  const cli = fileURLToPath(new URL('../backup.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [cli, 'restore', dir], {
    encoding: 'utf8',
    env: { ...process.env, PATH: '' },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /manifest/);
  assert.doesNotMatch(result.stderr, /psql bulunamadı/);
});
