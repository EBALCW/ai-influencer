import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { restorePsqlArgs } from './restore-args.mjs';

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
    '-f', join('tmp', 'backup', 'data-auth.sql'),
    '-f', join('tmp', 'backup', 'data-public.sql'),
  ]);
});
