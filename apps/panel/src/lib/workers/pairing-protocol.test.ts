// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  encodePairingRequest,
  generatePairingKeys,
  isPairingRequestFresh,
  isPairingSecret,
  normalizeMachineName,
  openSealed,
  pairingPhrase,
  pairingVerifier,
  parsePairingRequest,
  sealForMachine,
  type PairingRequest,
} from '@ai-influencer/shared';

// Eşleme protokolünün ortak kodu (packages/shared/src/pairing.ts): makine ve panel aynı
// fonksiyonları kullanır. Sabit vektör, makine tarafındaki testle (apps/worker) aynıdır.
const request: PairingRequest = {
  verifier: 'ab'.repeat(32),
  publicKey: 'A'.repeat(43),
  platform: 'darwin',
  name: 'Stüdyo Mac',
  startedAt: 1_795_000_000,
};
const text =
  'aiw1.abababababababababababababababababababababababababababababababab.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA.darwin.top2v4.U3TDvGR5byBNYWM';

describe('eşleme metni', () => {
  it('kodlanır ve geri çözülür; boşluk ve satır sonu yok sayılır', () => {
    expect(encodePairingRequest(request)).toBe(text);
    expect(parsePairingRequest(text)).toEqual(request);
    expect(
      parsePairingRequest(`  ${text.slice(0, 40)}\n${text.slice(40)}  `),
    ).toEqual(request);
  });

  it.each([
    ['boş', ''],
    ['önek yanlış', text.replace('aiw1', 'aiw2')],
    ['eksik parça', text.split('.').slice(0, 5).join('.')],
    ['fazla parça', `${text}.x`],
    ['doğrulayıcı kısa', text.replace('abab', 'ab')],
    ['doğrulayıcı büyük harf', text.replace('abab', 'ABAB')],
    ['anahtar kısa', text.replace('AAAA', 'AAA')],
    ['platform bilinmiyor', text.replace('darwin', 'amiga')],
    ['ad boş', text.replace('U3TDvGR5byBNYWM', 'ICAg')],
    ['ad bozuk utf-8', text.replace('U3TDvGR5byBNYWM', '_w')],
    [
      'kanonik değil (ad kırpılmamış)',
      text.replace('U3TDvGR5byBNYWM', 'IFN0w7xkeW8gTWFj'),
    ],
    ['aşırı uzun', `${text}${'A'.repeat(3000)}`],
  ])('geçersiz metni reddeder: %s', (_name, value) => {
    expect(parsePairingRequest(value)).toBeNull();
  });

  it('makine adından denetim ve yön karakterlerini atar', () => {
    expect(normalizeMachineName('  Stüdyo\u0000\tMac‮ ')).toBe('Stüdyo Mac');
    expect(normalizeMachineName('\u0007')).toBeNull();
    expect(normalizeMachineName('a'.repeat(81))).toBeNull();
  });

  it('süre: 10 dakika, ileri yönde 2 dakika pay', () => {
    const now = request.startedAt;
    expect(isPairingRequestFresh(request, now)).toBe(true);
    expect(isPairingRequestFresh(request, now + 599)).toBe(true);
    expect(isPairingRequestFresh(request, now + 600)).toBe(false);
    expect(isPairingRequestFresh(request, now - 120)).toBe(true);
    expect(isPairingRequestFresh(request, now - 121)).toBe(false);
  });
});

describe('kontrol kodu', () => {
  it('metnin tamamından türer (sabit vektör)', async () => {
    expect(await pairingPhrase(request)).toBe('AGCA-BT7K');
  });

  it('herhangi bir alan değişince değişir', async () => {
    const base = await pairingPhrase(request);
    for (const changed of [
      { ...request, name: 'Stüdyo Mac 2' },
      { ...request, platform: 'win32' as const },
      { ...request, publicKey: 'B'.repeat(43) },
      { ...request, verifier: 'cd'.repeat(32) },
      { ...request, startedAt: request.startedAt + 1 },
    ])
      expect(await pairingPhrase(changed)).not.toBe(base);
    expect(base).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });
});

describe('cihaz sırrı ve mühür', () => {
  it('sır 256 bit; doğrulayıcı SHA-256 özetidir (sabit vektör)', async () => {
    const keys = await generatePairingKeys();
    expect(isPairingSecret(keys.secret)).toBe(true);
    expect(keys.publicKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(keys.verifier).toBe(await pairingVerifier(keys.secret));
    expect((await generatePairingKeys()).secret).not.toBe(keys.secret);
    expect(await pairingVerifier('cihazsirri' + '1'.padStart(33, '0'))).toBe(
      'c2673e751c82bb3017a1ddf34ed92d469dba41d584db96d2f9c18ab68266c997',
    );
  });

  it('mührü yalnız makinenin özel anahtarı açar', async () => {
    const machine = await generatePairingKeys();
    const sealed = await sealForMachine(machine.publicKey, 'yenileme-token');
    expect(sealed).toMatch(/^[A-Za-z0-9+/]{80,1100}={0,2}$/);
    expect(await openSealed(machine, sealed)).toBe('yenileme-token');
    // Aynı metin her seferinde farklı mühürlenir
    expect(await sealForMachine(machine.publicKey, 'yenileme-token')).not.toBe(
      sealed,
    );
    const other = await generatePairingKeys();
    await expect(openSealed(other, sealed)).rejects.toThrow();
    // Başka makinenin açık anahtarıyla karıştırma
    await expect(
      openSealed(
        { privateKey: machine.privateKey, publicKey: other.publicKey },
        sealed,
      ),
    ).rejects.toThrow();
    // Bozulmuş mühür
    const bytes = Buffer.from(sealed, 'base64');
    bytes[bytes.length - 1] = bytes[bytes.length - 1]! ^ 1;
    await expect(
      openSealed(machine, bytes.toString('base64')),
    ).rejects.toThrow();
    await expect(openSealed(machine, 'kisa')).rejects.toThrow(/geçersiz/);
    await expect(sealForMachine('kisa', 'x')).rejects.toThrow(/geçersiz/);
  });
});
