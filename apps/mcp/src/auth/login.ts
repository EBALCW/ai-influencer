// Tarayıcıyla giriş (RFC 8252: yerel uygulama + geri döngü adresi + PKCE).
//
// Panelin giriş yolları e-posta bağlantısı (magic link) ve Google'dır (docs/AUTH.md); parola
// yoktur. Bu yüzden komut satırı parola sormaz: kullanıcı tarayıcıda, Supabase Auth'un kendi
// sayfalarında giriş yapar; Auth tarayıcıyı `http://127.0.0.1:<port>/callback?code=…` adresine
// döndürür; kod, yalnız bu sürecin belleğindeki PKCE doğrulayıcısıyla oturuma çevrilir.
//
// * Dinleyici yalnız 127.0.0.1'e bağlanır, tek bir geri dönüşü kabul eder ve kapanır.
// * Kodu ele geçiren başka bir yerel süreç doğrulayıcı olmadan oturum alamaz; saldırganın kendi
//   kodunu bu dinleyiciye göndermesi de işe yaramaz (doğrulayıcı eşleşmez).
// * Geri dönüş adresi Supabase Auth'un izinli yönlendirme listesinde olmalıdır
//   (docs/mcp-panel.md → "Giriş"). Listede değilse Auth tarayıcıyı panele döndürür ve bu komut
//   zaman aşımına uğrar.
import { createServer, type Server } from 'node:http';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import type { PanelConfig } from '../config.ts';
import type { TokenResponse } from './session.ts';

export const DEFAULT_LOGIN_PORT = 47821;
export const CALLBACK_PATH = '/callback';
const LOGIN_TIMEOUT_MS = 5 * 60_000;

export function redirectUrl(port: number): string {
  return `http://127.0.0.1:${port}${CALLBACK_PATH}`;
}

export type LoginMethod =
  | { readonly kind: 'email'; readonly email: string }
  | { readonly kind: 'google' };

export class LoginError extends Error {}

const PAGE = (title: string, body: string) =>
  `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${title}</title>` +
  '<meta name="referrer" content="no-referrer">' +
  '<style>body{font:16px system-ui,sans-serif;margin:15vh auto;max-width:32rem;padding:0 1rem;color:#111}</style>' +
  `</head><body><h1>${title}</h1><p>${body}</p></body></html>`;

export type CallbackResult =
  { readonly code: string } | { readonly error: string };

/** Geri dönüş isteğini ayrıştırır. Kod biçimi denetlenir; hata metni sabit bir kümeye indirgenir. */
export function parseCallback(requestUrl: string): CallbackResult | null {
  const url = new URL(requestUrl, 'http://127.0.0.1');
  if (url.pathname !== CALLBACK_PATH) return null;
  const code = url.searchParams.get('code');
  if (code && /^[A-Za-z0-9._~-]{8,512}$/.test(code)) return { code };
  const error =
    url.searchParams.get('error_code') ?? url.searchParams.get('error');
  return {
    error: error && /^[a-z0-9_]{1,60}$/i.test(error) ? error : 'gecersiz_donus',
  };
}

/**
 * 127.0.0.1:<port> üzerinde tek bir geri dönüşü bekler. `ready` dinleyici açılınca çözülür;
 * `result` kod gelince, hata dönünce ya da süre dolunca sonuçlanır. Her durumda dinleyici kapanır.
 */
export function waitForCallback(
  port: number,
  timeoutMs: number = LOGIN_TIMEOUT_MS,
): { ready: Promise<void>; result: Promise<string>; close: () => void } {
  let server: Server | null = null;
  let timer: NodeJS.Timeout | null = null;
  const close = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    server?.close();
    server?.closeAllConnections();
    server = null;
  };
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const result = new Promise<string>((resolve, reject) => {
    server = createServer((request, response) => {
      const headers = {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy':
          "default-src 'none'; style-src 'unsafe-inline'",
      };
      // DNS rebinding'e karşı: yalnız geri döngü adıyla gelen istek kabul edilir.
      const host = (request.headers.host ?? '').replace(/:\d+$/, '');
      const parsed =
        request.method === 'GET' &&
        (host === '127.0.0.1' || host === 'localhost')
          ? parseCallback(request.url ?? '/')
          : null;
      if (!parsed) {
        response.writeHead(404, headers).end(PAGE('Bulunamadı', ''));
        return;
      }
      if ('code' in parsed) {
        response
          .writeHead(200, headers)
          .end(
            PAGE(
              'Giriş alındı',
              'Bu sekmeyi kapatıp terminale dönebilirsiniz.',
            ),
          );
        close();
        resolve(parsed.code);
        return;
      }
      response
        .writeHead(400, headers)
        .end(PAGE('Giriş tamamlanamadı', 'Terminaldeki iletiye bakın.'));
      close();
      reject(new LoginError(`Giriş tamamlanamadı (${parsed.error}).`));
    });
    server.on('error', (error: NodeJS.ErrnoException) => {
      close();
      const failure = new LoginError(
        error.code === 'EADDRINUSE'
          ? `Port ${port} kullanımda. Başka bir giriş denemesi açık olabilir; kapatıp yeniden deneyin.`
          : 'Yerel giriş dinleyicisi açılamadı.',
      );
      rejectReady(failure);
      reject(failure);
    });
    server.listen(port, '127.0.0.1', () => resolveReady());
    timer = setTimeout(() => {
      close();
      reject(
        new LoginError(
          'Giriş süresi doldu (5 dakika). Tarayıcı panele döndüyse geri dönüş adresi Supabase Auth izin ' +
            'listesinde değildir: docs/mcp-panel.md → "Giriş".',
        ),
      );
    }, timeoutMs);
  });
  // Çağıran `ready` reddini ayrıca ele alır; yakalanmamış ret uyarısı üretmesin.
  result.catch(() => {});
  return { ready, result, close };
}

/** Adresi varsayılan tarayıcıda açar. Kabuk kullanılmaz; adres tek bir argümandır. */
export function openBrowser(url: string): void {
  const [command, args]: [string, string[]] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['rundll32', ['url.dll,FileProtocolHandler', url]]
        : ['xdg-open', [url]];
  try {
    const child = spawn(command, args, {
      stdio: 'ignore',
      detached: true,
      shell: false,
    });
    child.on('error', () => {});
    child.unref();
  } catch {
    // Tarayıcı açılamazsa adres zaten terminale yazılmıştır.
  }
}

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

export type LoginIo = {
  /** Kullanıcıya gösterilecek satır (stderr). Token ya da kod içermez. */
  readonly say: (line: string) => void;
  readonly open: (url: string) => void;
};

/**
 * Giriş akışını yürütür ve Supabase oturumunu döndürür. Oturum hiçbir yere yazılmaz; çağıran
 * önce otomasyon işaretini ve onay yoklamasını yapar, sonra kasaya yazar (cli.ts).
 */
export async function loginWithBrowser(
  config: PanelConfig,
  method: LoginMethod,
  io: LoginIo,
  options: { port?: number; timeoutMs?: number } = {},
): Promise<TokenResponse> {
  const port = options.port ?? DEFAULT_LOGIN_PORT;
  const redirectTo = redirectUrl(port);
  const client = createClient(config.supabaseUrl, config.anonKey, {
    auth: {
      flowType: 'pkce',
      storage: memoryStorage(),
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const callback = waitForCallback(port, options.timeoutMs);
  try {
    await callback.ready;
    if (method.kind === 'email') {
      const { error } = await client.auth.signInWithOtp({
        email: method.email,
        options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
      });
      if (error) {
        // Hız sınırı ile "kayıtlı değil" ayrı söylenir: kullanıcı beklemesi gerektiğini bilsin
        if (error.status === 429 || error.code === 'over_email_send_rate_limit')
          throw new LoginError(
            'E-posta gönderim sınırı doldu (panel, MCP ve makine girişleri aynı saatlik sınırı paylaşır). ' +
              "E-posta beklemeden girmek için panelde Ayarlar → Araç girişi'nden kod üretip `--code` ile girin " +
              '(ya da yaklaşık bir saat sonra yeniden deneyin / --google kullanın).',
          );
        throw new LoginError(
          'Giriş bağlantısı gönderilemedi: e-posta kayıtlı bir ekip üyesine ait olmalı.',
        );
      }
      io.say(
        'Giriş bağlantısı e-posta adresinize gönderildi. Bağlantıyı BU BİLGİSAYARDAKİ tarayıcıda açın; bu pencere bekliyor.',
      );
    } else {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (error || !data.url) {
        throw new LoginError('Google ile giriş başlatılamadı.');
      }
      io.say(
        'Tarayıcıda Google ile giriş sayfası açılıyor. Açılmazsa şu adresi açın:',
      );
      io.say(data.url);
      io.open(data.url);
    }
    const code = await callback.result;
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      throw new LoginError(
        'Giriş kodu oturuma çevrilemedi (kod bu giriş denemesine ait değil ya da süresi dolmuş).',
      );
    }
    return {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_in: data.session.expires_in,
      user: { id: data.session.user.id, email: data.session.user.email },
    };
  } finally {
    callback.close();
  }
}
