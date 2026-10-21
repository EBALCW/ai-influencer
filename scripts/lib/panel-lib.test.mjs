import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  backupDirName,
  backupPlan,
  isInside,
  isLocalHost,
  missingPanelEnv,
  needsBuild,
  openCommand,
  parseEnvFile,
  parsePanelArgs,
  pgConnection,
} from './panel-lib.mjs';

describe('parsePanelArgs', () => {
  it('varsayılanlar', () => {
    assert.deepEqual(parsePanelArgs([]), {
      update: false,
      open: true,
      check: false,
      port: 3000,
    });
  });
  it('--check tarayıcıyı kapatır', () => {
    const o = parsePanelArgs(['--check', '--port', '3100']);
    assert.equal(o.check, true);
    assert.equal(o.open, false);
    assert.equal(o.port, 3100);
  });
  it('geçersiz port ve bilinmeyen bayrak hata verir', () => {
    assert.throws(() => parsePanelArgs(['--port', 'abc']), /--port/);
    assert.throws(() => parsePanelArgs(['--port', '70000']), /--port/);
    assert.throws(() => parsePanelArgs(['--force']), /Bilinmeyen/);
  });
});

describe('openCommand', () => {
  it('her platform için doğru komut', () => {
    assert.deepEqual(openCommand('darwin', 'http://x'), {
      cmd: 'open',
      args: ['http://x'],
    });
    assert.deepEqual(openCommand('win32', 'http://x'), {
      cmd: 'cmd',
      args: ['/c', 'start', '', 'http://x'],
    });
    assert.equal(openCommand('linux', 'http://x').cmd, 'xdg-open');
  });
});

describe('needsBuild', () => {
  it('marker yoksa veya commit farklıysa build', () => {
    assert.equal(needsBuild({ marker: null, head: 'a', dirtyPaths: [] }), true);
    assert.equal(
      needsBuild({ marker: { commit: 'b' }, head: 'a', dirtyPaths: [] }),
      true,
    );
  });
  it('kodda değişiklik varsa veya son build kirliyse build', () => {
    assert.equal(
      needsBuild({
        marker: { commit: 'a' },
        head: 'a',
        dirtyPaths: [' M apps/x'],
      }),
      true,
    );
    assert.equal(
      needsBuild({
        marker: { commit: 'a', dirty: true },
        head: 'a',
        dirtyPaths: [],
      }),
      true,
    );
  });
  it('güncelse atla', () => {
    assert.equal(
      needsBuild({
        marker: { commit: 'a', dirty: false },
        head: 'a',
        dirtyPaths: [],
      }),
      false,
    );
  });
});

describe('parseEnvFile / missingPanelEnv', () => {
  it('yorum, boş satır, tırnak ve CRLF', () => {
    const env = parseEnvFile('# yorum\r\nA=1\r\n\r\nB="iki"\nC=\nD=\'x=y\'\n');
    assert.deepEqual(env, { A: '1', B: 'iki', C: '', D: 'x=y' });
  });
  it('boş değerler eksik sayılır', () => {
    assert.deepEqual(
      missingPanelEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'u',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      }),
      ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    );
  });
});

describe('pgConnection', () => {
  it('şifre argümanlara girmez, env ile verilir', () => {
    const c = pgConnection(
      'postgresql://postgres.abc:s%40fe%23pw@aws-0-eu.pooler.supabase.com:5432/postgres',
    );
    assert.ok(!c.args.join(' ').includes('s@fe#pw'));
    assert.equal(c.env.PGPASSWORD, 's@fe#pw');
    assert.deepEqual(c.args, [
      '--host',
      'aws-0-eu.pooler.supabase.com',
      '--port',
      '5432',
      '--username',
      'postgres.abc',
      '--dbname',
      'postgres',
    ]);
  });
  it('uzak sunucuda SSL zorunlu, yerelde değil', () => {
    assert.equal(
      pgConnection('postgresql://u:p@db.x.supabase.co:5432/postgres').env
        .PGSSLMODE,
      'require',
    );
    assert.equal(
      pgConnection('postgresql://u:p@127.0.0.1:54322/postgres').env.PGSSLMODE,
      undefined,
    );
  });
  it('geçersiz adres hata verir', () => {
    assert.throws(() => pgConnection('mysql://x'), /postgresql/);
    assert.throws(() => pgConnection('bozuk'), /geçerli/);
  });
});

describe('yedek yardımcıları', () => {
  it('klasör adında : yok', () => {
    assert.equal(
      backupDirName(new Date('2026-10-21T13:05:09.123Z')),
      '2026-10-21T13-05-09Z',
    );
  });
  it('plan şema, public veri ve auth kullanıcılarını içerir', () => {
    assert.deepEqual(
      backupPlan().map((p) => p.file),
      ['schema.sql', 'data-public.sql', 'data-auth.sql'],
    );
  });
  it('repo içindeki klasör reddedilir (büyük/küçük harf duyarsız)', () => {
    assert.equal(isInside('/repo/backups', '/repo'), true);
    assert.equal(isInside('C:\\Repo\\x', 'c:\\repo', '\\'), true);
    assert.equal(isInside('/repo-backups', '/repo'), false);
  });
  it('yerel host tespiti', () => {
    assert.equal(isLocalHost('127.0.0.1'), true);
    assert.equal(isLocalHost('db.abc.supabase.co'), false);
  });
});
