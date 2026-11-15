// Makine oturumu: yenileme token'ı kasada durur, erişim token'ı yalnız bellekte.
// Supabase yenileme token'ını her kullanımda değiştirir; yenisi hemen kasaya yazılır.
import type { Http, Tokens } from './api.ts';
import type { CredentialStore } from './credential-store.ts';
import { ApiError, SessionError } from './errors.ts';
import type { Logger } from './log.ts';
import { refreshAtMs } from './timing.ts';

export interface Session {
  /** Geçerli erişim token'ı; süresi dolmak üzereyse önce yeniler. */
  accessToken(): Promise<string>;
  /** Sunucu 401 dediğinde: token'ı zorla yeniler. */
  forceRefresh(): Promise<string>;
  /** Oturum bilgisi (ilk yenilemeden sonra dolu). */
  current(): Pick<Tokens, 'userId' | 'sessionId' | 'expiresAtMs'> | null;
  /** Sunucudaki oturumu kapatır ve kasadaki kaydı siler. */
  logout(): Promise<void>;
  /** Yalnız kasadaki kaydı siler (oturum sunucuda zaten geçersiz). */
  forget(): Promise<void>;
}

export interface SessionOptions {
  http: Http;
  store: CredentialStore;
  account: string;
  log: Logger;
  now?: () => number;
  /** Girişten yeni gelen yenileme token'ı; verilmezse kasadan okunur. */
  initialRefreshToken?: string;
}

export const NOT_LOGGED_IN =
  'Bu makinede giriş yapılmamış. Önce `pnpm worker:login` çalıştır.';

export function createSession(options: SessionOptions): Session {
  const { http, store, account, log } = options;
  const now = options.now ?? Date.now;
  let tokens: Tokens | null = null;
  let pending: Promise<Tokens> | null = null;
  let seed = options.initialRefreshToken ?? null;

  async function refresh(): Promise<Tokens> {
    const refreshToken =
      tokens?.refreshToken ?? seed ?? (await store.get(account));
    if (!refreshToken) throw new SessionError(NOT_LOGGED_IN);
    log.addSecret(refreshToken);
    let next: Tokens;
    try {
      next = await http.refresh(refreshToken);
    } catch (error) {
      if (error instanceof SessionError) {
        // Oturum sunucuda bitmiş (yetki kaldırıldı ya da token eskidi): kayıt işe yaramaz
        tokens = null;
        seed = null;
        await store.delete(account).catch(() => undefined);
        throw new SessionError(
          'Makinenin oturumu geçersiz (yetkisi kaldırılmış olabilir). Yeniden giriş için `pnpm worker:login` çalıştır.',
        );
      }
      throw error;
    }
    log.addSecret(next.refreshToken);
    log.addSecret(next.accessToken);
    // Eski token artık geçersiz: yenisi kasaya yazılamazsa sonraki açılışta oturum kaybolur.
    // Yine de bu çalıştırma bellekteki token'la sürer; kullanıcı uyarılır.
    try {
      await store.set(account, next.refreshToken);
    } catch (error) {
      log.error(
        'Yenilenen oturum kasaya yazılamadı; program kapanınca yeniden giriş gerekecek.',
        { hata: error },
      );
    }
    seed = null;
    tokens = next;
    return next;
  }

  function refreshOnce(): Promise<Tokens> {
    pending ??= refresh().finally(() => {
      pending = null;
    });
    return pending;
  }

  return {
    async accessToken() {
      if (tokens && now() < refreshAtMs(tokens.issuedAtMs, tokens.expiresAtMs))
        return tokens.accessToken;
      return (await refreshOnce()).accessToken;
    },
    async forceRefresh() {
      return (await refreshOnce()).accessToken;
    },
    current() {
      return tokens
        ? {
            userId: tokens.userId,
            sessionId: tokens.sessionId,
            expiresAtMs: tokens.expiresAtMs,
          }
        : null;
    },
    async logout() {
      try {
        const token = tokens?.accessToken ?? (await refreshOnce()).accessToken;
        await http.logout(token);
      } catch (error) {
        if (!(error instanceof SessionError) && !(error instanceof ApiError))
          throw error;
        // Oturum zaten geçersiz: yereldeki kaydı silmek yeterli
      } finally {
        tokens = null;
        seed = null;
      }
      await store.delete(account);
    },
    async forget() {
      tokens = null;
      seed = null;
      await store.delete(account);
    },
  };
}
