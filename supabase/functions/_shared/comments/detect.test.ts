import { assertEquals } from '@std/assert';
import { detectBrandInquiry, foldText } from './detect.ts';

// Fixture metinleri uydurmadır (repo public, gerçek yorum kopyalanmaz).
Deno.test('iş birliği anahtar kelimeleri yakalanır', () => {
  for (const text of [
    'Collab yapalım mı?',
    'We would love a COLLABORATION',
    'Sponsorluk için yazdık',
    'Looking for sponsors',
    'İŞ BİRLİĞİ teklifimiz var',
    'işbirliği için DM',
    'is birligi?',
    'iş-birliğine açık mısınız',
    'PARTNERSHIP inquiry',
  ]) {
    assertEquals(detectBrandInquiry(text), true, text);
  }
});

Deno.test('e-posta adresi fırsat sayılır', () => {
  assertEquals(detectBrandInquiry('Detaylar için ekip@ornek.example'), true);
  assertEquals(detectBrandInquiry('MAIL: Pazarlama.Ekibi@Marka.co.uk'), true);
});

Deno.test('yanlış pozitifler', () => {
  for (const text of [
    'Harika video!',
    'Bu kısım çok iyi', // "is" kelime içinde
    'Birlikte izledik',
    '@kullanici bunu gör', // mention, e-posta değil
    'Bu işi birlikte yaptık',
    '',
  ]) {
    assertEquals(detectBrandInquiry(text), false, text);
  }
});

Deno.test('Türkçe harf katlama: İ/ı/I aynı biçime iner', () => {
  assertEquals(foldText('İŞ BİRLİĞİ'), 'is birligi');
  assertEquals(foldText('ışık'), 'isik');
  assertEquals(foldText('PARTNERSHIP'), 'partnership');
});
