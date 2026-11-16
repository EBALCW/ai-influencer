// Kodla giriş (docs/AUTH.md → "Araç girişi"): e-posta beklemeden, panelde üretilen tek
// kullanımlık kodla oturum açar.
//
// Kullanıcı panelde (Ayarlar → Üretim makineleri → Araç girişi) kendi hesabı için bir kod üretir
// ve bu komutun sorduğu yere yapıştırır. Kod, Supabase Auth'un giriş e-postasındaki bağlantıda
// taşıdığı özetin (token_hash) aynısıdır; anon anahtarla `/auth/v1/verify` ucunda oturuma çevrilir.
//
// * Kod komut satırı argümanı olarak ALINMAZ (kabuk geçmişine ve süreç listesine girer): gizli
//   girdiyle sorulur ya da standart girdiden (boru) okunur.
// * Kod ekrana, hata iletisine ya da günlüğe yazılmaz.
// * Oturum burada hiçbir yere yazılmaz; çağıran (cli.ts) önce otomasyon işaretini ve onay
//   yoklamasını yapar, sonra kasaya yazar. Tarayıcıyla girişteki sıra aynen geçerlidir.
import type { Readable, Writable } from 'node:stream';
import type { PanelConfig } from '../config.ts';
import { LoginError } from './login.ts';
import type { FetchLike, TokenResponse } from './session.ts';

/** Supabase Auth özet biçimi (onaltılık; PKCE akışında `pkce_` önekli). */
const TOOL_CODE = /^[A-Za-z0-9_-]{16,256}$/;
const MAX_INPUT = 4096;
const REQUEST_TIMEOUT_MS = 15_000;

export const CODE_HINT =
  "Panelde Ayarlar → Üretim makineleri → Araç girişi'nden yeni bir kod üretip yeniden deneyin.";

/** Yapıştırılan girdiyi koda indirger; biçim uymuyorsa null (girdi iletiye taşınmaz). */
export function parseToolCode(input: string): string | null {
  const value = input.trim();
  return TOOL_CODE.test(value) ? value : null;
}

type Input = Readable & {
  isTTY?: boolean;
  setRawMode?: (mode: boolean) => unknown;
};

/**
 * Kodu okur. Girdi bir uçbirimse ham kipe geçilir (yankı kapanır, yazılan görünmez); uçbirim
 * değilse (boru: `… | pnpm mcp:login --code`) ilk satır okunur. Ctrl+C iptal eder.
 */
export function readToolCode(input: Input, output: Writable): Promise<string> {
  return new Promise((resolve, reject) => {
    const raw = Boolean(input.isTTY && input.setRawMode);
    let value = '';
    const finish = (error: Error | null) => {
      input.off('data', onData);
      input.off('end', onEnd);
      input.off('error', onError);
      if (raw) {
        input.setRawMode?.(false);
        output.write('\n');
      }
      input.pause();
      if (error) return reject(error);
      const code = parseToolCode(value);
      if (code) resolve(code);
      else
        reject(new LoginError(`Bu bir giriş koduna benzemiyor. ${CODE_HINT}`));
    };
    const onEnd = () => finish(null);
    const onError = () => finish(new LoginError('Giriş kodu okunamadı.'));
    const onData = (chunk: Buffer | string) => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\u0003')
          return finish(new LoginError('Giriş iptal edildi.'));
        if (char === '\r' || char === '\n') return finish(null);
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else if (char >= ' ' && value.length < MAX_INPUT) value += char;
      }
    };
    output.write('Giriş kodu (yapıştırınca görünmez): ');
    if (raw) input.setRawMode?.(true);
    input.on('data', onData);
    input.on('end', onEnd);
    input.on('error', onError);
    input.resume();
  });
}

/**
 * Kodu oturuma çevirir. Kod tek kullanımlıktır: Auth onu doğrularken siler; ikinci deneme ve
 * süresi dolmuş kod aynı iletiyle reddedilir (hangisi olduğu açıklanmaz).
 */
export async function loginWithCode(
  config: PanelConfig,
  code: string,
  fetchImpl: FetchLike = globalThis.fetch as unknown as FetchLike,
): Promise<TokenResponse> {
  if (!parseToolCode(code))
    throw new LoginError(`Bu bir giriş koduna benzemiyor. ${CODE_HINT}`);
  let status = 0;
  let json: unknown = null;
  try {
    const response = await fetchImpl(`${config.supabaseUrl}/auth/v1/verify`, {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'magiclink', token_hash: code }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    status = response.status;
    const text = await response.text();
    json = text ? JSON.parse(text) : null;
  } catch {
    // Ayrıntı (adres, gövde) iletiye taşınmaz
    if (status === 0)
      throw new LoginError('Panele (Supabase Auth) ulaşılamadı.');
  }
  if (status === 429)
    throw new LoginError(
      'Çok fazla deneme yapıldı. Bir dakika sonra yeniden deneyin.',
    );
  if (status >= 400 && status < 500)
    throw new LoginError(
      `Giriş kodu geçersiz, kullanılmış ya da süresi dolmuş. ${CODE_HINT}`,
    );
  const token = json as Partial<TokenResponse> | null;
  if (
    status !== 200 ||
    !token ||
    typeof token.access_token !== 'string' ||
    typeof token.refresh_token !== 'string' ||
    typeof token.expires_in !== 'number'
  )
    throw new LoginError('Giriş tamamlanamadı (Auth beklenmeyen yanıt verdi).');
  return {
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_in: token.expires_in,
    user: { id: token.user?.id, email: token.user?.email },
  };
}
