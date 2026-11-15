import assert from 'node:assert/strict';
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { spawnSync } from 'node:child_process';
import {
  LockError,
  acquireLock,
  clearState,
  lockHolder,
  readState,
  writeState,
} from './state.ts';

const dir = mkdtempSync(path.join(os.tmpdir(), 'aiw-state-'));
after(() => rmSync(dir, { recursive: true, force: true }));
const state = {
  account: 'ornek.supabase.co',
  workerId: '5e560000-0000-4000-8000-0000000000a1',
  name: 'Stüdyo Mac',
  pairedAt: '2026-11-16T10:00:00.000Z',
};

test('durum dosyası: yaz, oku, sil; başka ortamın ve bozuk dosyanın kaydı yok sayılır', () => {
  const where = path.join(dir, 'durum');
  assert.equal(readState(where, state.account), null);
  writeState(where, state);
  assert.deepEqual(readState(where, state.account), state);
  assert.equal(readState(where, 'baska.supabase.co'), null);
  if (process.platform !== 'win32')
    assert.equal(statSync(path.join(where, 'worker.json')).mode & 0o077, 0);
  // Dosyada sır alanı yok
  assert.deepEqual(
    Object.keys(
      JSON.parse(readFileSync(path.join(where, 'worker.json'), 'utf8')),
    ).sort(),
    ['account', 'name', 'pairedAt', 'workerId'],
  );
  for (const broken of [
    '{',
    '[]',
    '{"account":"ornek.supabase.co","workerId":"../x","name":"a","pairedAt":"b"}',
  ]) {
    writeFileSync(path.join(where, 'worker.json'), broken);
    assert.equal(readState(where, state.account), null);
  }
  clearState(where);
  clearState(where);
  assert.equal(readState(where, state.account), null);
});

test('kilit: ikinci süreç reddedilir, bırakılınca alınır, ölü sürecin kilidi devralınır', () => {
  const where = path.join(dir, 'kilit');
  const lock = acquireLock(where);
  assert.equal(lockHolder(where), process.pid);
  // Yaşayan başka bir süreç (ebeveyn) kilidi tutuyormuş gibi
  lock.release();
  writeFileSync(path.join(where, 'worker.lock'), String(process.ppid));
  assert.throws(
    () => acquireLock(where),
    (error: LockError) =>
      error instanceof LockError && error.pid === process.ppid,
  );
  // Ölü süreç: bitmiş bir alt sürecin kimliği
  const dead = spawnSync(process.execPath, ['-e', '0']).pid;
  writeFileSync(path.join(where, 'worker.lock'), String(dead));
  assert.equal(lockHolder(where), null);
  const taken = acquireLock(where);
  assert.equal(lockHolder(where), process.pid);
  taken.release();
  taken.release();
  assert.equal(lockHolder(where), null);
  writeFileSync(path.join(where, 'worker.lock'), 'bozuk');
  acquireLock(where).release();
});
