// Giriş (docs/AUTH.md → "Üretim makinesi oturumu"): makine, ekip üyesinin kendi girişiyle
// oturum açar. Panelin kullandığı yöntemin aynısı: Supabase Auth giriş e-postası. Parolası olan
// hesaplar parolayla da girebilir. Parola, bağlantı ve token ekrana ya da loga yazılmaz.
// `--code`: e-posta istenmez; panelde (Ayarlar → Üretim makineleri → Araç girişi) üretilen tek
// kullanımlık kod sorulur. Kod, giriş e-postasındaki bağlantının taşıdığı özetin aynısıdır.
import type { Http, LoginProof } from './api.ts';
import {
  CredentialStoreError,
  probeCredentialStore,
  type CredentialStore,
} from './credential-store.ts';
import { AbortedError, LoginError } from './errors.ts';
import type { Logger } from './log.ts';
import { createSession, type Session } from './session.ts';

export interface Prompter {
  /** Görünür girdi (ör. e-posta). */
  ask(question: string): Promise<string>;
  /** Gizli girdi (parola, giriş bağlantısı): ekranda gösterilmez. */
  askHidden(question: string): Promise<string>;
}

export interface LoginOptions {
  http: Http;
  store: CredentialStore;
  account: string;
  log: Logger;
  prompter: Prompter;
  say(line: string): void;
  method: 'email' | 'password' | 'code';
  signal?: AbortSignal;
}

const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,255}$/;
const TOKEN = /^[A-Za-z0-9_-]{16,256}$/;

/**
 * Kullanıcının yapıştırdığı girdiyi çözer: e-postadaki bağlantının adresi (içinde `token` ya da
 * `token_hash`), yalnız özet ya da e-postadaki 6-8 haneli kod. Tanınmayan girdi null.
 */
export function parseLoginInput(
  input: string,
  email: string,
): LoginProof | null {
  const value = input.trim();
  if (/^\d{6,8}$/.test(value)) return { kind: 'code', email, code: value };
  if (TOKEN.test(value))
    return { kind: 'token_hash', tokenHash: value, type: 'magiclink' };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  // Bazı şablonlar parametreleri # sonrasına koyar
  const params = [
    url.searchParams,
    new URLSearchParams(url.hash.replace(/^#/, '')),
  ];
  for (const source of params) {
    const tokenHash = source.get('token_hash') ?? source.get('token');
    if (tokenHash && TOKEN.test(tokenHash))
      return {
        kind: 'token_hash',
        tokenHash,
        type: source.get('type') === 'email' ? 'email' : 'magiclink',
      };
  }
  return null;
}

/** Panelde üretilen giriş kodu (yalnız özet; bağlantı ya da 6 haneli kod değil). */
export function parseLoginCode(input: string): string | null {
  const value = input.trim();
  return TOKEN.test(value) ? value : null;
}

export async function login(options: LoginOptions): Promise<Session> {
  const { http, prompter, say } = options;
  const aborted = () => {
    if (options.signal?.aborted) throw new AbortedError('Giriş iptal edildi.');
  };

  // Kasa çalışmıyorsa hiç başlanmaz: oturum açılıp da saklanamaz duruma düşülmesin.
  const usable = await probeCredentialStore(options.store);
  if (!usable.ok)
    throw new CredentialStoreError(
      `Güvenli kimlik kasası kullanılamıyor: ${usable.reason} Oturum düz dosyaya yazılmaz; giriş başlatılmadı.`,
    );

  let refreshToken: string;
  if (options.method === 'code') {
    // E-posta sorulmaz ve istenmez: kod hesabı kendisi belirler.
    const tokenHash = parseLoginCode(
      await prompter.askHidden('Giriş kodu (yapıştırınca görünmez): '),
    );
    aborted();
    if (!tokenHash)
      throw new LoginError(
        "Bu bir giriş koduna benzemiyor. Panelde Ayarlar → Üretim makineleri → Araç girişi'nden yeni bir kod üretip yeniden dene.",
      );
    options.log.addSecret(tokenHash);
    refreshToken = (
      await http.verifyLogin({
        kind: 'token_hash',
        tokenHash,
        type: 'magiclink',
      })
    ).refreshToken;
    return finishLogin(options, refreshToken, aborted);
  }

  const email = (await prompter.ask('E-posta: ')).trim().toLowerCase();
  aborted();
  if (!EMAIL.test(email)) throw new LoginError('E-posta adresi geçersiz.');

  if (options.method === 'password') {
    const password = await prompter.askHidden('Parola (yazarken görünmez): ');
    aborted();
    if (!password) throw new LoginError('Parola boş olamaz.');
    options.log.addSecret(password);
    refreshToken = (await http.signInWithPassword(email, password))
      .refreshToken;
  } else {
    await http.sendLoginEmail(email);
    say(
      [
        '',
        `${email} adresine giriş e-postası gönderildi.`,
        'E-postadaki bağlantıya TIKLAMA. Bağlantıya sağ tıkla → "Bağlantı adresini kopyala" de',
        've buraya yapıştır. (E-postada 6 haneli kod varsa onu da yazabilirsin.)',
        '',
      ].join('\n'),
    );
    let tokens = null;
    for (let attempt = 1; !tokens; attempt++) {
      const proof = parseLoginInput(
        await prompter.askHidden(
          'Bağlantı adresi ya da kod (yapıştırınca görünmez): ',
        ),
        email,
      );
      aborted();
      if (!proof) {
        if (attempt >= 3)
          throw new LoginError('Giriş bağlantısı ya da kodu tanınamadı.');
        say('Bu bir giriş bağlantısına ya da koda benzemiyor; yeniden dene.');
        continue;
      }
      options.log.addSecret(
        proof.kind === 'code' ? proof.code : proof.tokenHash,
      );
      tokens = await http.verifyLogin(proof);
    }
    refreshToken = tokens.refreshToken;
  }
  return finishLogin(options, refreshToken, aborted);
}

async function finishLogin(
  options: LoginOptions,
  refreshToken: string,
  aborted: () => void,
): Promise<Session> {
  aborted();

  options.log.addSecret(refreshToken);
  const session = createSession({
    http: options.http,
    store: options.store,
    account: options.account,
    log: options.log,
    initialRefreshToken: refreshToken,
  });
  // İlk yenileme: oturumun çalıştığını doğrular ve dönen yeni token'ı kasaya yazar.
  await session.accessToken();
  if ((await options.store.get(options.account)) === null) {
    await session.logout().catch(() => undefined);
    throw new CredentialStoreError(
      'Oturum kasaya yazılamadı; giriş geri alındı. Kasayı kontrol edip yeniden dene.',
    );
  }
  return session;
}
