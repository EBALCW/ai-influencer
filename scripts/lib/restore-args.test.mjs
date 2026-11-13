import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { restoreEnvironment, restorePsqlArgs } from './restore-args.mjs';

test('restore miras alınan libpq hedef, service ve parola ayarlarını kullanmaz', () => {
  const original = Object.freeze({
    PATH: 'test-path',
    HTTPS_PROXY: 'http://proxy.example:8080',
    PGHOSTADDR: '192.0.2.123',
    PGSERVICE: 'remote',
    PGSERVICEFILE: 'remote.conf',
    PGSYSCONFDIR: 'other-config',
    PGHOST: 'remote.example',
    PGPORT: '9999',
    PGDATABASE: 'other',
    PGUSER: 'other',
    PGPASSWORD: 'inherited-test-password',
    PGPASSFILE: 'other-passfile',
    PGOPTIONS: '-c search_path=other',
    PGSSLMODE: 'disable',
  });
  const result = restoreEnvironment(original, {
    PGPASSWORD: 'validated-test-password',
    PGSSLMODE: 'require',
  });
  assert.deepEqual(result, {
    PATH: 'test-path',
    HTTPS_PROXY: 'http://proxy.example:8080',
    PGPASSWORD: 'validated-test-password',
    PGSSLMODE: 'require',
    PGOPTIONS: '-c session_replication_role=replica',
  });
  assert.equal(original.PGHOSTADDR, '192.0.2.123');
});

test('Windows karma harfli libpq ayarları da temizlenir', () => {
  const result = restoreEnvironment(
    {
      Path: 'test-path',
      pgHostAddr: '192.0.2.123',
      PgService: 'remote',
      pgpassword: 'inherited-test-password',
      PgOptions: 'unsafe-options',
    },
    { PGPASSWORD: 'validated-test-password' },
  );
  assert.deepEqual(result, {
    Path: 'test-path',
    PGPASSWORD: 'validated-test-password',
    PGOPTIONS: '-c session_replication_role=replica',
  });
});

test('restore temizleme ve iki importu tek atomik psql oturumunda yapar', () => {
  const args = restorePsqlArgs(['-h', '127.0.0.1'], join('tmp', 'backup'));
  assert.deepEqual(args.slice(0, 2), ['-h', '127.0.0.1']);
  assert.ok(args.includes('-X'));
  assert.ok(args.includes('--single-transaction'));
  assert.ok(args.includes('ON_ERROR_STOP=1'));
  const cleanup = args.indexOf('-c');
  const first = args.indexOf('-f');
  assert.ok(cleanup >= 0 && cleanup < first);
  assert.match(args[cleanup + 1], /truncate table/);
  assert.deepEqual(args.slice(first), [
    '-f',
    join('tmp', 'backup', 'data-auth.sql'),
    '-f',
    join('tmp', 'backup', 'data-public.sql'),
  ]);
});
