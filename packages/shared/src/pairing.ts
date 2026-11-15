// Üretim makinesi eşlemesi (#211, docs/AUTH.md → "Üretim makinesi oturumu"). Makine programı
// (Node) ve panel (sunucu + tarayıcı) aynı kodu kullanır; yalnız Web Crypto'ya dayanır.
// Bu dosya başka dosya içe aktarmaz.
//
// Akış: makine yerelde 256 bitlik bir cihaz sırrı ve X25519 anahtar çifti üretir. Kullanıcıya
// gösterdiği "eşleme metni" sırrın YALNIZ özetini (doğrulayıcı), açık anahtarı, makinenin adını
// ve platformunu taşır. Panelde onaylanınca sunucu yenileme token'ını açık anahtara mühürler;
// makine sırrını sunarak mührü bir kez alır ve özel anahtarıyla açar.

export const PAIRING_PREFIX = 'aiw1';
/** Eşleme metni üretildikten sonra bu kadar süre onaylanabilir. */
export const PAIRING_REQUEST_TTL_SECONDS = 600;
export const PAIRING_PLATFORMS = ['darwin', 'win32', 'linux'] as const;
export type PairingPlatform = (typeof PAIRING_PLATFORMS)[number];

export interface PairingRequest {
  /** Cihaz sırrının SHA-256 özeti (64 hex). Sırrın kendisi makineden çıkmaz. */
  verifier: string;
  /** Makinenin X25519 açık anahtarı (base64url, 43 karakter). */
  publicKey: string;
  platform: PairingPlatform;
  /** Makinenin adı (1-80 karakter). */
  name: string;
  /** Metnin üretildiği an (epoch saniye). */
  startedAt: number;
}

const HEX64 = /^[0-9a-f]{64}$/;
const KEY43 = /^[A-Za-z0-9_-]{43}$/;
const SECRET = /^[A-Za-z0-9_-]{43}$/;
const PHRASE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function utf8(text: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new TextEncoder().encode(text));
}

function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

async function sha256(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

/** Makine adı: denetim karakterleri atılır, boşluklar sadeleşir. Geçersizse null. */
export function normalizeMachineName(input: string): string | null {
  const name = input
    .replace(
      /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202f\u2066-\u2069]/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
  return name.length >= 1 && name.length <= 80 ? name : null;
}

/** Cihaz sırrının doğrulayıcısı: sır metninin (base64url) UTF-8 baytlarının SHA-256'sı, hex. */
export async function pairingVerifier(secret: string): Promise<string> {
  return toHex(await sha256(utf8(secret)));
}

export function isPairingSecret(value: string): boolean {
  return SECRET.test(value);
}

export interface PairingKeys {
  /** 256 bit rastgele; yalnız makinenin belleğinde durur. */
  secret: string;
  verifier: string;
  publicKey: string;
  privateKey: CryptoKey;
}

export async function generatePairingKeys(): Promise<PairingKeys> {
  const secret = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const pair = (await crypto.subtle.generateKey({ name: 'X25519' }, false, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const publicKey = toBase64Url(
    new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)),
  );
  return {
    secret,
    verifier: await pairingVerifier(secret),
    publicKey,
    privateKey: pair.privateKey,
  };
}

/** `aiw1.<doğrulayıcı>.<açık anahtar>.<platform>.<an, 36'lık>.<ad, base64url>` */
export function encodePairingRequest(request: PairingRequest): string {
  return [
    PAIRING_PREFIX,
    request.verifier,
    request.publicKey,
    request.platform,
    Math.floor(request.startedAt).toString(36),
    toBase64Url(utf8(request.name)),
  ].join('.');
}

/** Eşleme metnini çözer; biçim tam uymuyorsa null. Boşluk ve satır sonları yok sayılır. */
export function parsePairingRequest(input: string): PairingRequest | null {
  if (typeof input !== 'string' || input.length > 2000) return null;
  const parts = input.replace(/\s+/g, '').split('.');
  if (parts.length !== 6) return null;
  const [prefix, verifier, publicKey, platform, started, encodedName] =
    parts as [string, string, string, string, string, string];
  if (prefix !== PAIRING_PREFIX) return null;
  if (!HEX64.test(verifier) || !KEY43.test(publicKey)) return null;
  if (!(PAIRING_PLATFORMS as readonly string[]).includes(platform)) return null;
  if (!/^[0-9a-z]{1,9}$/.test(started)) return null;
  if (!/^[A-Za-z0-9_-]{1,440}$/.test(encodedName)) return null;
  let name: string | null;
  try {
    name = normalizeMachineName(
      new TextDecoder('utf-8', { fatal: true }).decode(
        fromBase64Url(encodedName),
      ),
    );
  } catch {
    return null;
  }
  if (!name) return null;
  const startedAt = parseInt(started, 36);
  if (!Number.isSafeInteger(startedAt) || startedAt <= 0) return null;
  const request: PairingRequest = {
    verifier,
    publicKey,
    platform: platform as PairingPlatform,
    name,
    startedAt,
  };
  // Tek bir kanonik yazım: aynı içerik için farklı metin (ve farklı kontrol kodu) olmasın
  return encodePairingRequest(request) === parts.join('.') ? request : null;
}

/**
 * Kontrol kodu: eşleme metninin tamamından türeyen 8 karakter (ör. `ABCD-2345`). Makine ve panel
 * aynı kodu gösterir; kullanıcı önündeki makineyi eşlediğini buradan anlar. Sır değildir.
 */
export async function pairingPhrase(request: PairingRequest): Promise<string> {
  const digest = await sha256(utf8(`phrase:${encodePairingRequest(request)}`));
  let out = '';
  for (let i = 0; i < 8; i++) out += PHRASE_ALPHABET[(digest[i] ?? 0) & 31];
  return `${out.slice(0, 4)}-${out.slice(4)}`;
}

/** Metin hâlâ onaylanabilir mi? (Saat farkı için ileri yönde 2 dakika pay.) */
export function isPairingRequestFresh(
  request: PairingRequest,
  nowSeconds: number,
): boolean {
  return (
    request.startedAt <= nowSeconds + 120 &&
    request.startedAt > nowSeconds - PAIRING_REQUEST_TTL_SECONDS
  );
}

const SEAL_INFO = 'ai-influencer/worker-pairing/v1';

async function sealKey(
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  ephemeralPublic: Uint8Array<ArrayBuffer>,
  recipientPublic: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> {
  const shared = await crypto.subtle.deriveBits(
    { name: 'X25519', public: publicKey },
    privateKey,
    256,
  );
  const material = await crypto.subtle.importKey('raw', shared, 'HKDF', false, [
    'deriveKey',
  ]);
  const salt = new Uint8Array(64);
  salt.set(ephemeralPublic, 0);
  salt.set(recipientPublic, 32);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: utf8(SEAL_INFO) },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function importPublic(raw: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', raw, { name: 'X25519' }, false, []);
}

/**
 * Metni makinenin açık anahtarına mühürler (tek kullanımlık X25519 + HKDF-SHA256 + AES-256-GCM).
 * Çıktı: base64( geçici açık anahtar 32 | iv 12 | şifreli metin + etiket ). Yalnız özel anahtar açar.
 */
export async function sealForMachine(
  recipientPublicKey: string,
  plaintext: string,
): Promise<string> {
  if (!KEY43.test(recipientPublicKey))
    throw new Error('Makinenin açık anahtarı geçersiz.');
  const recipientRaw = fromBase64Url(recipientPublicKey);
  const recipient = await importPublic(recipientRaw);
  const ephemeral = (await crypto.subtle.generateKey(
    { name: 'X25519' },
    false,
    ['deriveBits'],
  )) as CryptoKeyPair;
  const ephemeralRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', ephemeral.publicKey),
  );
  const key = await sealKey(
    ephemeral.privateKey,
    recipient,
    ephemeralRaw,
    recipientRaw,
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8(plaintext)),
  );
  const blob = new Uint8Array(32 + 12 + sealed.length);
  blob.set(ephemeralRaw, 0);
  blob.set(iv, 32);
  blob.set(sealed, 44);
  let binary = '';
  for (const byte of blob) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** `sealForMachine` çıktısını makinenin özel anahtarıyla açar; bozuksa hata fırlatır. */
export async function openSealed(
  keys: Pick<PairingKeys, 'privateKey' | 'publicKey'>,
  sealedBase64: string,
): Promise<string> {
  if (!/^[A-Za-z0-9+/]{80,1100}={0,2}$/.test(sealedBase64))
    throw new Error('Mühürlü metin geçersiz.');
  const binary = atob(sealedBase64);
  const blob = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) blob[i] = binary.charCodeAt(i);
  if (blob.length < 32 + 12 + 16 + 1)
    throw new Error('Mühürlü metin geçersiz.');
  const ephemeralRaw = blob.slice(0, 32);
  const key = await sealKey(
    keys.privateKey,
    await importPublic(ephemeralRaw),
    ephemeralRaw,
    fromBase64Url(keys.publicKey),
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: blob.slice(32, 44) },
    key,
    blob.slice(44),
  );
  return new TextDecoder('utf-8', { fatal: true }).decode(plain);
}
