// Oturum yönetimi: kasadaki yenileme token'ından kısa ömürlü erişim token'ı üretir.
//
// * Erişim token'ı yalnız bellekte durur; kasada yalnız yenileme token'ı ve kimlik bilgisi vardır.
// * Supabase yenileme token'ı tek kullanımlıktır: her yenilemede yenisi gelir ve hemen kasaya
//   yazılır. Aynı makinede iki MCP süreci (iki istemci penceresi) aynı kaydı paylaşır; yenilemeden
//   önce kasa yeniden okunur ki diğer sürecin döndürdüğü token kullanılsın.
// * Token'lar hiçbir hata iletisine ya da günlüğe girmez.
import type { PanelConfig } from '../config.ts';
import { ToolError } from '../lib/errors.ts';
import type { CredentialStore } from './credential-store.ts';

export type StoredSession = {
  readonly v: 1;
  /** Token'ın ait olduğu Supabase projesi; başka projeye gönderilmez. */
  readonly url: string;
  readonly refresh_token: string;
  readonly user_id: string;
  readonly session_id: string;
  readonly email?: string;
  readonly saved_at: string;
};

export type TokenResponse = {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_in: number;
  readonly user?: { readonly id?: string; readonly email?: string };
};

export type FetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
) => Promise<{ status: number; text(): Promise<string> }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function accountFor(config: PanelConfig): string {
  return new URL(config.supabaseUrl).host;
}

/** Erişim token'ının gövdesi (imza DOĞRULANMAZ; yalnız kendi token'ımızın alanlarını okumak için). */
export function tokenClaims(accessToken: string): {
  sub?: string;
  session_id?: string;
  exp?: number;
  role?: string;
  email?: string;
} {
  try {
    const part = accessToken.split('.')[1] ?? '';
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as never;
  } catch {
    return {};
  }
}

export function parseStoredSession(raw: string | null): StoredSession | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredSession>;
    if (
      value.v !== 1 ||
      typeof value.url !== 'string' ||
      typeof value.refresh_token !== 'string' ||
      value.refresh_token.length < 4 ||
      typeof value.user_id !== 'string' ||
      !UUID.test(value.user_id) ||
      typeof value.session_id !== 'string' ||
      !UUID.test(value.session_id)
    ) {
      return null;
    }
    return value as StoredSession;
  } catch {
    return null;
  }
}

/** Token yanıtından kasaya yazılacak kaydı kurar; oturum kimliği yoksa reddeder. */
export function storedSessionFrom(
  config: PanelConfig,
  token: TokenResponse,
  now: Date = new Date(),
): StoredSession {
  const claims = tokenClaims(token.access_token);
  if (
    !claims.sub ||
    !UUID.test(claims.sub) ||
    !claims.session_id ||
    !UUID.test(claims.session_id) ||
    claims.role !== 'authenticated'
  ) {
    // session_id claim'i olmayan oturum insan / otomasyon ayrımına giremez: kullanılmaz.
    throw new ToolError(
      'oturum_gecersiz',
      'Oturum kimliği (session_id) okunamadı; bu oturum kullanılamaz.',
    );
  }
  const email = token.user?.email ?? claims.email;
  return {
    v: 1,
    url: config.supabaseUrl,
    refresh_token: token.refresh_token,
    user_id: claims.sub,
    session_id: claims.session_id,
    ...(email ? { email } : {}),
    saved_at: now.toISOString(),
  };
}

const NOT_LOGGED_IN = () =>
  new ToolError(
    'giris_gerekli',
    'Panele giriş yapılmamış ya da oturum sona ermiş.',
    {
      advice:
        'Kullanıcı repo kökünde `pnpm mcp:login` çalıştırmalı (tarayıcıda giriş yapılır). Sonra aracı yeniden dene.',
    },
  );

/** Erişim token'ı bu kadar saniye kala yenilenir. */
const REFRESH_MARGIN_SECONDS = 60;
const REQUEST_TIMEOUT_MS = 15_000;

export class SessionManager {
  readonly #config: PanelConfig;
  readonly #store: CredentialStore;
  readonly #fetch: FetchLike;
  readonly #now: () => number;
  #access: { token: string; expiresAt: number } | null = null;
  #identity: StoredSession | null = null;
  #refreshing: Promise<string> | null = null;

  constructor(options: {
    config: PanelConfig;
    store: CredentialStore;
    fetch?: FetchLike;
    now?: () => number;
  }) {
    this.#config = options.config;
    this.#store = options.store;
    this.#fetch = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
    this.#now = options.now ?? Date.now;
  }

  get account(): string {
    return accountFor(this.#config);
  }

  /** Kasadaki kayıt (token'ı döndürmez; yalnız kimlik alanları dışarı verilmelidir). */
  async stored(): Promise<StoredSession | null> {
    const session = parseStoredSession(await this.#store.get(this.account));
    // Kayıt başka bir Supabase projesine aitse yok sayılır: token başka adrese gönderilmez.
    if (!session || session.url !== this.#config.supabaseUrl) return null;
    return session;
  }

  /** Son bilinen kimlik (denetim kaydı için); giriş yoksa null. */
  identity(): { userId: string; sessionId: string; email?: string } | null {
    return this.#identity
      ? {
          userId: this.#identity.user_id,
          sessionId: this.#identity.session_id,
          ...(this.#identity.email ? { email: this.#identity.email } : {}),
        }
      : null;
  }

  /** Yeni girişten sonra: token'ı kasaya yazar ve belleğe alır. */
  async adopt(token: TokenResponse): Promise<StoredSession> {
    const session = storedSessionFrom(
      this.#config,
      token,
      new Date(this.#now()),
    );
    await this.#store.set(this.account, JSON.stringify(session));
    this.#remember(session, token);
    return session;
  }

  /** Girişi kasaya YAZMADAN belleğe alır (giriş akışındaki denetimler bitene kadar). */
  hold(token: TokenResponse): StoredSession {
    const session = storedSessionFrom(
      this.#config,
      token,
      new Date(this.#now()),
    );
    this.#remember(session, token);
    return session;
  }

  #remember(session: StoredSession, token: TokenResponse): void {
    this.#identity = session;
    this.#access = {
      token: token.access_token,
      expiresAt:
        this.#now() +
        Math.max(0, token.expires_in - REFRESH_MARGIN_SECONDS) * 1000,
    };
  }

  async accessToken(): Promise<string> {
    if (this.#access && this.#now() < this.#access.expiresAt) {
      return this.#access.token;
    }
    this.#refreshing ??= this.#refresh().finally(() => {
      this.#refreshing = null;
    });
    return this.#refreshing;
  }

  async #refresh(): Promise<string> {
    let attempted: string | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const session = await this.stored();
      if (!session) throw NOT_LOGGED_IN();
      if (session.refresh_token === attempted) break;
      attempted = session.refresh_token;
      const result = await this.#post(
        '/auth/v1/token?grant_type=refresh_token',
        {
          refresh_token: session.refresh_token,
        },
      );
      if (result.status === 200 && result.json) {
        const token = result.json as TokenResponse;
        const next = storedSessionFrom(
          this.#config,
          token,
          new Date(this.#now()),
        );
        if (
          next.session_id !== session.session_id ||
          next.user_id !== session.user_id
        ) {
          // Yenileme aynı oturumu sürdürmelidir; değişen kimlik beklenmeyen bir durumdur.
          throw new ToolError(
            'oturum_gecersiz',
            'Oturum kimliği yenilemede değişti.',
          );
        }
        await this.#store.set(this.account, JSON.stringify(next));
        this.#remember(next, token);
        return token.access_token;
      }
      if (
        result.status >= 500 ||
        result.status === 429 ||
        result.status === 0
      ) {
        throw new ToolError('baglanti', 'Panele (Supabase Auth) ulaşılamadı.', {
          advice: 'Bir süre sonra yeniden dene.',
        });
      }
      // 400/401: token geçersiz ya da başka bir süreç onu az önce döndürdü → kasayı yeniden oku.
    }
    // Token kesin olarak geçersiz: ölü sırrı kasada bırakma.
    const current = await this.stored();
    if (current && current.refresh_token === attempted) {
      await this.#store.delete(this.account);
    }
    this.#access = null;
    this.#identity = null;
    throw NOT_LOGGED_IN();
  }

  /** Bu oturumu sunucuda kapatır (yalnız bu oturum; kullanıcının panel oturumu etkilenmez) ve kasadan siler. */
  async logout(): Promise<{ revoked: boolean; hadSession: boolean }> {
    const session = await this.stored();
    let revoked = false;
    if (session) {
      try {
        const token = await this.accessToken();
        const result = await this.#post(
          '/auth/v1/logout?scope=local',
          undefined,
          token,
        );
        revoked = result.status === 204 || result.status === 200;
      } catch {
        // Oturum zaten ölmüş olabilir; kasadan silmek yeter.
      }
    }
    await this.#store.delete(this.account);
    this.#access = null;
    this.#identity = null;
    return { revoked, hadSession: session !== null };
  }

  async #post(
    path: string,
    body: unknown,
    bearer?: string,
  ): Promise<{ status: number; json: unknown }> {
    try {
      const response = await this.#fetch(`${this.#config.supabaseUrl}${path}`, {
        method: 'POST',
        headers: {
          apikey: this.#config.anonKey,
          Authorization: `Bearer ${bearer ?? this.#config.anonKey}`,
          'Content-Type': 'application/json',
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      const text = await response.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // gövde JSON değil
      }
      return { status: response.status, json };
    } catch {
      return { status: 0, json: null };
    }
  }
}
