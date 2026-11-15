// Supabase REST istemcisi (Auth, PostgREST RPC, Storage). Ek paket yok: yalnız fetch.
// Hata gövdeleri ve token'lar loglanmaz; hata nesneleri yalnız kod, ipucu ve veritabanının
// Türkçe mesajını taşır.
import { ApiError, LoginError, NetworkError, SessionError } from './errors.ts';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  issuedAtMs: number;
  expiresAtMs: number;
  userId: string;
  sessionId: string | null;
}

export interface HttpOptions {
  supabaseUrl: string;
  anonKey: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
}

/** Giriş e-postasından gelen kanıt: bağlantıdaki özet ya da e-postadaki kod. */
export type LoginProof =
  | { kind: 'token_hash'; tokenHash: string; type: 'magiclink' | 'email' }
  | { kind: 'code'; email: string; code: string };

export interface Http {
  /** Mevcut kullanıcıya giriş e-postası gönderir (kayıt açmaz). */
  sendLoginEmail(email: string): Promise<void>;
  /** E-postadaki bağlantı ya da kodla oturum açar. */
  verifyLogin(proof: LoginProof): Promise<Tokens>;
  /** Parolası olan hesapla oturum açar. */
  signInWithPassword(email: string, password: string): Promise<Tokens>;
  refresh(refreshToken: string): Promise<Tokens>;
  logout(accessToken: string): Promise<void>;
  rpc<T>(
    name: string,
    args: Record<string, unknown>,
    accessToken: string | null,
  ): Promise<T>;
  select<T>(table: string, query: string, accessToken: string): Promise<T[]>;
  upload(
    objectPath: string,
    body: Uint8Array,
    contentType: string,
    accessToken: string,
  ): Promise<void>;
}

const RPC_NAME = /^[a-z][a-z0-9_]{0,62}$/;
/** Storage nesne yolu parçası: `..` ve ayraç içeremez. */
const PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

export function decodeJwtClaims(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  if (!payload) return {};
  try {
    const claims: unknown = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    );
    return claims && typeof claims === 'object'
      ? (claims as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function createHttp(options: HttpOptions): Http {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const now = options.now ?? Date.now;
  const base = options.supabaseUrl;

  async function request(
    path: string,
    init: {
      method: string;
      token: string | null;
      body?: string | Blob;
      contentType?: string;
      headers?: Record<string, string>;
    },
  ): Promise<{ status: number; json: unknown }> {
    let response: Response;
    try {
      response = await fetchImpl(`${base}${path}`, {
        method: init.method,
        headers: {
          apikey: options.anonKey,
          Authorization: `Bearer ${init.token ?? options.anonKey}`,
          ...(init.contentType ? { 'Content-Type': init.contentType } : {}),
          ...init.headers,
        },
        ...(init.body === undefined ? {} : { body: init.body }),
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      // Ayrıntı (adres, başlık) hata metnine taşınmaz
      throw new NetworkError('Supabase’e ulaşılamadı.');
    }
    let json: unknown = null;
    try {
      const raw = await response.text();
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }
    return { status: response.status, json };
  }

  function fail(status: number, json: unknown, fallback: string): never {
    const body = (json && typeof json === 'object' ? json : {}) as Record<
      string,
      unknown
    >;
    if (status >= 500 || status === 429 || status === 408)
      throw new NetworkError(`Supabase geçici hata verdi (${status}).`);
    throw new ApiError(text(body.message) ?? fallback, {
      status,
      code: text(body.code) ?? text(body.error_code) ?? text(body.error),
      hint: text(body.hint),
    });
  }

  function tokensFrom(json: unknown, issuedAtMs: number): Tokens {
    const body = (json ?? {}) as Record<string, unknown>;
    const accessToken = text(body.access_token);
    const nextRefresh = text(body.refresh_token);
    const expiresIn = Number(body.expires_in);
    if (
      !accessToken ||
      !nextRefresh ||
      !Number.isFinite(expiresIn) ||
      expiresIn <= 0
    )
      throw new NetworkError('Oturum yanıtı beklenen biçimde değil.');
    const claims = decodeJwtClaims(accessToken);
    const userId = text(claims.sub);
    if (!userId)
      throw new NetworkError('Oturum yanıtı beklenen biçimde değil.');
    return {
      accessToken,
      refreshToken: nextRefresh,
      issuedAtMs,
      expiresAtMs: issuedAtMs + expiresIn * 1000,
      userId,
      sessionId: text(claims.session_id),
    };
  }

  /** Giriş uçları: 4xx "giriş reddedildi"dir; gövdedeki ayrıntı kullanıcıya taşınmaz. */
  async function signIn(
    path: string,
    payload: Record<string, unknown>,
  ): Promise<Tokens> {
    const issuedAtMs = now();
    const { status, json } = await request(path, {
      method: 'POST',
      token: null,
      contentType: 'application/json',
      body: JSON.stringify(payload),
    });
    if (status === 429)
      throw new LoginError(
        'Çok fazla deneme yapıldı. Bir dakika sonra yeniden dene.',
      );
    if (status >= 400 && status < 500)
      throw new LoginError(
        'Giriş reddedildi: bilgiler yanlış ya da bağlantının süresi dolmuş.',
      );
    if (status !== 200) fail(status, json, 'Giriş yapılamadı.');
    return tokensFrom(json, issuedAtMs);
  }

  return {
    async sendLoginEmail(email) {
      const { status, json } = await request('/auth/v1/otp', {
        method: 'POST',
        token: null,
        contentType: 'application/json',
        // create_user: false → yalnız mevcut kullanıcılar (kayıt açılmaz)
        body: JSON.stringify({ email, create_user: false }),
      });
      if (status === 429)
        throw new LoginError(
          'Çok sık e-posta istendi. Bir dakika sonra yeniden dene.',
        );
      if (status >= 400 && status < 500)
        throw new LoginError(
          'Giriş e-postası gönderilemedi: bu adres ekipte kayıtlı olmayabilir.',
        );
      if (status < 200 || status >= 300)
        fail(status, json, 'Giriş e-postası gönderilemedi.');
    },

    verifyLogin(proof) {
      return signIn(
        '/auth/v1/verify',
        proof.kind === 'token_hash'
          ? { type: proof.type, token_hash: proof.tokenHash }
          : { type: 'email', email: proof.email, token: proof.code },
      );
    },

    signInWithPassword(email, password) {
      return signIn('/auth/v1/token?grant_type=password', { email, password });
    },

    async refresh(refreshToken) {
      const issuedAtMs = now();
      const { status, json } = await request(
        '/auth/v1/token?grant_type=refresh_token',
        {
          method: 'POST',
          token: null,
          contentType: 'application/json',
          body: JSON.stringify({ refresh_token: refreshToken }),
        },
      );
      if (status === 400 || status === 401 || status === 403 || status === 404)
        throw new SessionError('Oturum geçersiz ya da yetkisi kaldırılmış.');
      if (status !== 200) fail(status, json, 'Oturum yenilenemedi.');
      return tokensFrom(json, issuedAtMs);
    },

    async logout(accessToken) {
      const { status, json } = await request('/auth/v1/logout?scope=local', {
        method: 'POST',
        token: accessToken,
      });
      // 401/403/404: oturum zaten yok
      if (status >= 400 && ![401, 403, 404].includes(status))
        fail(status, json, 'Oturum kapatılamadı.');
    },

    async rpc<T>(
      name: string,
      args: Record<string, unknown>,
      accessToken: string | null,
    ) {
      if (!RPC_NAME.test(name)) throw new Error('RPC adı geçersiz.');
      const { status, json } = await request(`/rest/v1/rpc/${name}`, {
        method: 'POST',
        token: accessToken,
        contentType: 'application/json',
        body: JSON.stringify(args),
      });
      if (status < 200 || status >= 300)
        fail(status, json, 'İstek reddedildi.');
      return json as T;
    },

    async select<T>(table: string, query: string, accessToken: string) {
      if (!RPC_NAME.test(table)) throw new Error('Tablo adı geçersiz.');
      const { status, json } = await request(`/rest/v1/${table}?${query}`, {
        method: 'GET',
        token: accessToken,
      });
      if (status < 200 || status >= 300)
        fail(status, json, 'Okuma reddedildi.');
      return Array.isArray(json) ? (json as T[]) : [];
    },

    async upload(objectPath, body, contentType, accessToken) {
      const segments = objectPath.split('/');
      if (
        segments.length !== 3 ||
        !segments.every((part) => PATH_SEGMENT.test(part))
      )
        throw new Error('Yükleme yolu geçersiz.');
      const { status, json } = await request(
        `/storage/v1/object/productions/${segments.join('/')}`,
        {
          method: 'POST',
          token: accessToken,
          contentType,
          body: new Blob([new Uint8Array(body)]),
          // Aşama yeniden denenirse aynı dosyanın üstüne yazılır
          headers: { 'x-upsert': 'true' },
        },
      );
      if (status < 200 || status >= 300)
        fail(status, json, 'Dosya yüklenemedi.');
    },
  };
}
