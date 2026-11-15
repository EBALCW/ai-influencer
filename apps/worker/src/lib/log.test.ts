import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createLogger, createMemoryLogger, formatLine } from './log.ts';

const at = new Date('2026-11-16T09:08:07Z');

test('satır biçimi: saat, seviye, mesaj, alanlar', () => {
  assert.equal(
    formatLine(at, 'info', 'İş alındı', {
      is: '3f2a',
      tur: 'clip.selftest',
      not: 'iki kelime',
      yok: undefined,
      ilerleme: 40,
    }),
    '09:08:07 bilgi   İş alındı  is=3f2a  tur=clip.selftest  not="iki kelime"  ilerleme=40',
  );
});

test('sırlar konsola ulaşmaz: desen, alan adı, bilinen sır, ev klasörü', () => {
  const lines: string[] = [];
  const log = createLogger({
    write: (line) => lines.push(line),
    now: () => at,
    home: '/Users/ornek',
  });
  log.addSecret('kisa-yenileme-tokeni');
  log.info('yenileme kisa-yenileme-tokeni ile yapıldı', {
    refresh_token: 'kisa-yenileme-tokeni',
    dosya: '/Users/ornek/x/cikti.txt',
    hata: new Error('Bearer abcdefgh12345678 reddedildi'),
  });
  const out = lines.join('\n');
  assert.equal(out.includes('kisa-yenileme-tokeni'), false);
  assert.equal(out.includes('abcdefgh12345678'), false);
  assert.equal(out.includes('/Users/ornek'), false);
  assert.match(out, /dosya=~\/x\/cikti\.txt/);
  assert.match(out, /refresh_token="\[gizli\]"/);
});

test('--json: satır başına bir nesne; child alanları taşınır; seviye süzgeci', () => {
  const lines: string[] = [];
  const log = createLogger({
    json: true,
    level: 'warn',
    write: (line) => lines.push(line),
    now: () => at,
  });
  const child = log.child({ is: 'abc' });
  child.info('görünmez');
  child.warn('görünür', { asama: 'prepare' });
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]!), {
    zaman: '2026-11-16T09:08:07.000Z',
    seviye: 'warn',
    mesaj: 'görünür',
    is: 'abc',
    asama: 'prepare',
  });
});

test('bellek kaydedicisi her seviyeyi toplar', () => {
  const log = createMemoryLogger();
  log.debug('a');
  log.error('b');
  assert.equal(log.lines.length, 2);
});
