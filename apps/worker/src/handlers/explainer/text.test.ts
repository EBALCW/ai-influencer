import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSpoken,
  cleanLabel,
  cleanText,
  makeBeats,
  splitSentences,
  spokenNumber,
  truncate,
  turkishNumber,
  withCaptionBreaks,
} from './text.ts';

test('Türkçe cümle bölme: sayı, kısaltma ve sıra sayısı cümleyi bölmez', () => {
  assert.deepEqual(
    splitSentences(
      'Planörün motoru yok. Yine de 3.000 kilometre uçar! Peki nasıl? Dr. Öz 3. bölümde anlatıyor.',
    ),
    [
      'Planörün motoru yok.',
      'Yine de 3.000 kilometre uçar!',
      'Peki nasıl?',
      'Dr. Öz 3. bölümde anlatıyor.',
    ],
  );
  assert.deepEqual(
    splitSentences('Isı 22,5 dereceydi. "Çok sıcak." dedi. İşte bu.'),
    ['Isı 22,5 dereceydi.', '"Çok sıcak." dedi.', 'İşte bu.'],
  );
  // Türkçe büyük harfler (İ, Ş, Ç, Ö, Ü) cümle başı sayılır
  assert.deepEqual(splitSentences('Bitti. İkincisi başladı. Şimdi üçüncü.'), [
    'Bitti.',
    'İkincisi başladı.',
    'Şimdi üçüncü.',
  ]);
  assert.deepEqual(splitSentences('nokta yok'), ['nokta yok']);
});

test('vuruşlar: paragraf böler, kısa cümleler birleşir, uzun cümle bölünmez', () => {
  const beats = makeBeats(
    'Motor yok. Yakıt yok. Yine de uçar.\n\nÖnce bir uçak ya da vinç, onu halatla havaya çeker.',
  );
  assert.deepEqual(beats, [
    'Motor yok. Yakıt yok. Yine de uçar.',
    'Önce bir uçak ya da vinç, onu halatla havaya çeker.',
  ]);
  const long =
    'Bu çok uzun bir cümle ve içinde virgüller, bağlaçlar ve daha pek çok kelime var ki yüz on karakteri rahatça aşsın diye uzadıkça uzuyor.';
  assert.deepEqual(makeBeats(`${long} Kısa.`), [long, 'Kısa.']);
  // Tek satır sonu boşluk sayılır; boş metin vuruş üretmez
  assert.deepEqual(makeBeats('bir\niki.'), ['bir iki.']);
  assert.deepEqual(makeBeats(' \n\n \n'), []);
});

test('temizlik: işaretleme, görünmez karakter ve emoji metinden çıkar', () => {
  assert.equal(cleanText('a*b | c​\u0007d 🚀 e'), 'a b c d e');
  assert.equal(cleanText('  çok   boşluk \r\n  satır  '), 'çok boşluk\nsatır');
  // Türkçe harfler ve birleşik harfler (NFC) korunur
  assert.equal(cleanText('İstanbul İıŞşĞğÖöÜüÇç'), 'İstanbul İıŞşĞğÖöÜüÇç');
  assert.equal(cleanLabel('  iki\nsatır  ', 40), 'iki satır');
  assert.equal(truncate('bir iki üç dört beş', 12), 'bir iki üç…');
  assert.equal(truncate('kısa', 12), 'kısa');
});

test('sayıların Türkçe okunuşu', () => {
  assert.equal(turkishNumber(0), 'sıfır');
  assert.equal(turkishNumber(1000), 'bin');
  assert.equal(turkishNumber(1996), 'bin dokuz yüz doksan altı');
  assert.equal(turkishNumber(3008), 'üç bin sekiz');
  assert.equal(turkishNumber(100), 'yüz');
  assert.equal(turkishNumber(2_500_000), 'iki milyon beş yüz bin');
  assert.equal(turkishNumber(1_001_000), 'bir milyon bin');
  assert.equal(turkishNumber(-1), null);
  assert.equal(turkishNumber(1.5), null);

  assert.equal(spokenNumber('3.000'), 'üç bin');
  assert.equal(spokenNumber('40'), 'kırk');
  assert.equal(spokenNumber('%40'), 'yüzde kırk');
  assert.equal(spokenNumber('1,5'), 'bir virgül beş');
  assert.equal(spokenNumber('3,05'), 'üç virgül sıfır beş');
  // Sayı olmayan ya da belirsiz biçim: ses servisine bırakılır
  for (const token of ['007', '40-50', '3.00', 'A4', '12:30', '1e9', ''])
    assert.equal(spokenNumber(token), null, token);
});

test('okunuş sözlüğü: yalnız Türkçe, senaryonun verdiği öncelikli', () => {
  const lines = ['1.000 metre alçalırken 40, 50 kilometre.', 'NASA 22 dedi.'];
  assert.deepEqual(buildSpoken(lines, 'tr'), {
    '1.000': 'bin',
    '40': 'kırk',
    '50': 'elli',
    '22': 'yirmi iki',
  });
  assert.deepEqual(buildSpoken(lines, 'en'), {});
  assert.deepEqual(
    buildSpoken(lines, 'tr', {
      NASA: 'nasa',
      '22': 'yirmi iki buçuk',
      'iki kelime': 'x',
    }),
    {
      '1.000': 'bin',
      '40': 'kırk',
      '50': 'elli',
      '22': 'yirmi iki buçuk',
      NASA: 'nasa',
    },
  );
});

test('altyazı parçaları: sınırı aşmaz, virgülde böler, kelime kaybetmez', () => {
  const line =
    'Modern bir planör 1.000 metre alçalırken 40, 50 kilometre ileri gidebilir.';
  const marked = withCaptionBreaks(line, 38);
  assert.equal(marked.replace(/ \| /g, ' '), line);
  for (const part of marked.split(' | '))
    assert.ok(Array.from(part).length <= 38, part);
  assert.equal(
    withCaptionBreaks(
      'Önce bir uçak ya da vinç, onu halatla havaya çeker.',
      38,
    ),
    'Önce bir uçak ya da vinç, | onu halatla havaya çeker.',
  );
  // Sınırdan uzun tek kelime tek başına kalır; işaret başta ya da sonda olmaz
  const long = withCaptionBreaks(`kısa ${'u'.repeat(60)} son`, 20);
  assert.equal(long, `kısa | ${'u'.repeat(60)} | son`);
  assert.ok(!/^\||\|$/.test(withCaptionBreaks('a, b, c,', 2)));
});
