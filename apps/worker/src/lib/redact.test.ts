import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redactText, redactValue, safeErrorMessage } from './redact.ts';

const jwt =
  // Parçalardan kurulur: depoda gerçek token'a benzeyen bir sabit durmasın (secret taraması)
  [
    'eyJhbGciOiJIUzI1NiJ9',
    'eyJzdWIiOiIxMjM0NTY3ODkwIn0',
    'c2lnbmF0dXJlLWJ5dGVz',
  ].join('.');

test('JWT, Bearer başlığı ve anahtar=değer sırları maskelenir', () => {
  assert.equal(redactText(`token ${jwt} bitti`), 'token [gizli] bitti');
  assert.equal(
    redactText('Authorization: Bearer abcdefgh12345678'),
    'Authorization: [gizli]',
  );
  assert.equal(
    redactText('https://x.test/y?refresh_token=abcd1234&page=2'),
    'https://x.test/y?refresh_token=[gizli]&page=2',
  );
  assert.equal(
    redactText(`ortam dökümü: ${'API'}_${'SECRET'}=${'deneme' + 22}`),
    `ortam dökümü: ${'API'}_${'SECRET'}=[gizli]`,
  );
  assert.equal(
    redactText(`sb_${'sec' + 'ret'}_${'abcdefgh' + 1234}`),
    '[gizli]',
  );
  assert.equal(
    redactText(
      `-----BEGIN ${'PRIVATE'} KEY-----\nAAAA\n-----END ${'PRIVATE'} KEY-----`,
    ),
    '[gizli]',
  );
});

test('bilinen sır ve ev klasörü geçtiği yerde gizlenir', () => {
  assert.equal(
    redactText('yenileme v1.kisa-token-xyz reddedildi', {
      secrets: ['v1.kisa-token-xyz'],
    }),
    'yenileme [gizli] reddedildi',
  );
  assert.equal(
    redactText('/Users/ornek/films/a.mp4 yazıldı', { home: '/Users/ornek' }),
    '~/films/a.mp4 yazıldı',
  );
  assert.equal(
    redactText('C:/Users/ornek/x ve C:\\Users\\ornek\\y', {
      home: 'C:\\Users\\ornek',
    }),
    '~/x ve ~\\y',
  );
  // çok kısa "sır" her şeyi maskelemesin
  assert.equal(redactText('abc', { secrets: ['a'] }), 'abc');
});

test('sıradan metin değişmez', () => {
  const text = 'İş alındı: clip.selftest, aşama prepare (%40)';
  assert.equal(redactText(text), text);
});

test('redactValue: sır adlı alanlar ve iç içe metinler', () => {
  assert.deepEqual(
    redactValue({
      is: 'abc',
      refresh_token: 'gizli-deger',
      Authorization: 'x',
      ic: { apiKey: 1, not: `bak ${jwt}` },
      liste: [`Bearer abcdefgh12345678`],
      hata: new Error(`başarısız ${jwt}`),
    }),
    {
      is: 'abc',
      refresh_token: '[gizli]',
      Authorization: '[gizli]',
      ic: { apiKey: '[gizli]', not: 'bak [gizli]' },
      liste: ['[gizli]'],
      hata: 'başarısız [gizli]',
    },
  );
});

test('redactValue: derinlik ve uzunluk sınırı', () => {
  let deep: Record<string, unknown> = { v: 1 };
  for (let i = 0; i < 10; i++) deep = { d: deep };
  assert.match(JSON.stringify(redactValue(deep)), /\[…\]/);
  assert.equal(
    (redactValue(Array.from({ length: 80 }, () => 1)) as unknown[]).length,
    50,
  );
});

test('safeErrorMessage: sırsız, tek satır, sınırlı', () => {
  assert.equal(
    safeErrorMessage(new Error(`indirme\n  başarısız: ${jwt}`)),
    'indirme başarısız: [gizli]',
  );
  assert.equal(safeErrorMessage(undefined), 'Bilinmeyen hata.');
  assert.equal(safeErrorMessage(new Error('   ')), 'Bilinmeyen hata.');
  const long = safeErrorMessage('x'.repeat(900));
  assert.equal(long.length, 500);
  assert.ok(long.endsWith('…'));
});
