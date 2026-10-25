import 'server-only';
import { z } from 'zod';
import type { OAuthPlatform } from './state';

export class OAuthProviderError extends Error {}
export const SCOPES = {
  instagram: [
    'instagram_business_basic',
    'instagram_business_manage_insights',
    'instagram_business_content_publish',
    'instagram_business_manage_comments',
  ],
  youtube: [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.force-ssl',
  ],
  tiktok: ['user.info.basic', 'user.info.stats', 'video.list'],
};
export type SupportedPlatform = keyof typeof SCOPES;
const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  token_type: z.string().optional(),
  scope: z.string(),
  expires_in: z
    .number()
    .int()
    .positive()
    .max(366 * 86400),
});
export type OAuthToken = z.infer<typeof tokenSchema>;
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

export function providerConfig(
  platform: OAuthPlatform,
  env: Record<string, string | undefined> = process.env,
) {
  const prefix =
    platform === 'youtube'
      ? 'GOOGLE'
      : platform === 'instagram'
        ? 'INSTAGRAM'
        : 'TIKTOK';
  const clientId = env[`${prefix}_CLIENT_ID`];
  const secret = env[`${prefix}_CLIENT_SECRET`];
  const origin = env.OAUTH_REDIRECT_BASE;
  if (!clientId || !secret || !origin)
    throw new OAuthProviderError('OAuth sunucu yapılandırması eksik.');
  let base: URL;
  try {
    base = new URL(origin);
  } catch {
    throw new OAuthProviderError('OAuth dönüş adresi geçersiz.');
  }
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    base.pathname !== '/' ||
    (base.protocol !== 'https:' &&
      !(
        platform === 'youtube' &&
        base.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(base.hostname)
      ))
  )
    throw new OAuthProviderError('OAuth dönüş adresi güvenli değil.');
  return {
    platform,
    graphVersion: /^v[0-9]+\.[0-9]+$/.test(env.INSTAGRAM_GRAPH_VERSION ?? '')
      ? env.INSTAGRAM_GRAPH_VERSION!
      : 'v23.0',
    clientId,
    secret,
    origin: base.origin,
    redirectUri: `${base.origin}/api/oauth/${platform}/callback`,
  };
}
export type ProviderConfig = ReturnType<typeof providerConfig>;
export function authorizationUrl(
  cfg: ProviderConfig,
  state: string,
  challenge: string,
) {
  const url = new URL(
    cfg.platform === 'youtube'
      ? 'https://accounts.google.com/o/oauth2/v2/auth'
      : cfg.platform === 'instagram'
        ? 'https://www.instagram.com/oauth/authorize'
        : 'https://www.tiktok.com/v2/auth/authorize/',
  );
  url.searchParams.set(
    cfg.platform === 'tiktok' ? 'client_key' : 'client_id',
    cfg.clientId,
  );
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', cfg.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set(
    'scope',
    SCOPES[cfg.platform].join(cfg.platform === 'youtube' ? ' ' : ','),
  );
  if (cfg.platform === 'youtube') {
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
  }
  if (cfg.platform === 'instagram') {
    url.searchParams.set('enable_fb_login', '0');
  }
  // TikTok Web Login Kit PKCE belirtmez; Desktop Kit hex SHA256 kullanır. Web'e desktop PKCE uygulanmaz.
  return url.toString();
}
async function request(url: string, init: RequestInit, fetcher: typeof fetch) {
  let response: Response;
  try {
    response = await fetcher(url, {
      ...init,
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new OAuthProviderError('Sağlayıcıya ulaşılamadı.');
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new OAuthProviderError('Sağlayıcı yanıtı geçersiz.');
  }
  if (
    !response.ok ||
    (obj(data).error &&
      (typeof obj(data).error !== 'object' ||
        obj(obj(data).error).code !== 'ok'))
  )
    throw new OAuthProviderError('Sağlayıcı isteği reddetti.');
  return obj(data);
}
export async function exchangeCode(
  cfg: ProviderConfig,
  code: string,
  verifier: string,
  fetcher = fetch,
): Promise<OAuthToken> {
  if (cfg.platform === 'instagram')
    return exchangeInstagram(cfg, code, fetcher);
  const fields: Record<string, string> = {
    client_secret: cfg.secret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: cfg.redirectUri,
  };
  fields[cfg.platform === 'youtube' ? 'client_id' : 'client_key'] =
    cfg.clientId;
  if (cfg.platform === 'youtube') fields.code_verifier = verifier;
  const body = await request(
    cfg.platform === 'youtube'
      ? 'https://oauth2.googleapis.com/token'
      : 'https://open.tiktokapis.com/v2/oauth/token/',
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    },
    fetcher,
  );
  const result = tokenSchema.safeParse(body);
  if (!result.success)
    throw new OAuthProviderError('Token yanıtı doğrulanamadı.');
  const granted = result.data.scope.split(/[ ,]+/);
  if (SCOPES[cfg.platform].some((scope) => !granted.includes(scope)))
    throw new OAuthProviderError('Gerekli izinlerin tamamı verilmedi.');
  if (!result.data.refresh_token)
    throw new OAuthProviderError(
      'Yenileme izni alınamadı; hesabı yeniden yetkilendirin.',
    );
  return result.data;
}
export async function accountIdentity(
  cfg: ProviderConfig,
  token: OAuthToken,
  fetcher = fetch,
) {
  if (cfg.platform === 'instagram') {
    const body = await request(
      `https://graph.instagram.com/${cfg.graphVersion}/me?fields=user_id,username`,
      { headers: { authorization: `Bearer ${token.access_token}` } },
      fetcher,
    );
    const identity = z
      .object({
        user_id: z.string().regex(/^[0-9]+$/),
        username: z.string().min(1).max(255),
      })
      .safeParse(body);
    if (!identity.success)
      throw new OAuthProviderError('Instagram hesap kimliği doğrulanamadı.');
    return { id: identity.data.user_id, handle: identity.data.username };
  }
  const body = await request(
    cfg.platform === 'youtube'
      ? 'https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true'
      : 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name',
    { headers: { authorization: `Bearer ${token.access_token}` } },
    fetcher,
  );
  let id: unknown, handle: unknown;
  if (cfg.platform === 'youtube') {
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length !== 1)
      throw new OAuthProviderError('Tek bir YouTube kanalı seçilmelidir.');
    const item = obj(items[0]);
    id = item.id;
    handle = obj(item.snippet).customUrl ?? id;
  } else {
    const user = obj(obj(body.data).user);
    id = user.open_id;
    handle = user.display_name ?? id;
  }
  const parsed = z
    .object({
      id: z.string().min(1).max(255),
      handle: z.string().min(1).max(255),
    })
    .safeParse({ id, handle });
  if (!parsed.success)
    throw new OAuthProviderError('Sosyal hesap kimliği doğrulanamadı.');
  return parsed.data;
}

export async function revokeToken(
  cfg: ProviderConfig,
  token: { access_token: string; refresh_token?: string },
  fetcher = fetch,
) {
  if (cfg.platform === 'instagram') {
    const body = await request(
      `https://graph.instagram.com/${cfg.graphVersion}/me/permissions`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${token.access_token}` },
      },
      fetcher,
    );
    if (body.success !== true)
      throw new OAuthProviderError('Instagram izni kaldırma doğrulanamadı.');
    return;
  }
  const fields: Record<string, string> =
    cfg.platform === 'youtube'
      ? { token: token.refresh_token ?? token.access_token }
      : {
          client_key: cfg.clientId,
          client_secret: cfg.secret,
          token: token.access_token,
        };
  let response: Response;
  try {
    response = await fetcher(
      cfg.platform === 'youtube'
        ? 'https://oauth2.googleapis.com/revoke'
        : 'https://open.tiktokapis.com/v2/oauth/revoke/',
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(fields).toString(),
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch {
    throw new OAuthProviderError(
      'Sağlayıcı bağlantısı kaldırılamadı; üç dakika sonra tekrar deneyin.',
    );
  }
  if (!response.ok)
    throw new OAuthProviderError('Sağlayıcı bağlantısı kaldırmayı reddetti.');
  const raw = await response.text();
  if (raw) {
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new OAuthProviderError('Sağlayıcı kaldırma yanıtı doğrulanamadı.');
    }
    if (obj(body).error)
      throw new OAuthProviderError('Sağlayıcı bağlantısı kaldırmayı reddetti.');
  }
}

// Instagram Login does not document PKCE. The existing single-use, user-bound
// state remains mandatory; no unsupported code_challenge is sent.
async function exchangeInstagram(
  cfg: ProviderConfig,
  code: string,
  fetcher: typeof fetch,
): Promise<OAuthToken> {
  const short = await request(
    'https://api.instagram.com/oauth/access_token',
    {
      method: 'POST',
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.secret,
        grant_type: 'authorization_code',
        redirect_uri: cfg.redirectUri,
        code,
      }),
    },
    fetcher,
  );
  const parsed = z
    .object({
      access_token: z.string().min(1),
      user_id: z.union([
        z.string().regex(/^[0-9]+$/),
        z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      ]),
      permissions: z.array(z.string()),
    })
    .safeParse(short);
  if (
    !parsed.success ||
    SCOPES.instagram.some((p) => !parsed.data.permissions.includes(p))
  )
    throw new OAuthProviderError(
      'Instagram token veya izin yanıtı doğrulanamadı.',
    );
  const url = new URL('https://graph.instagram.com/access_token');
  url.search = new URLSearchParams({
    grant_type: 'ig_exchange_token',
    client_secret: cfg.secret,
    access_token: parsed.data.access_token,
  }).toString();
  // Meta requires these parameters on the server-side GET endpoint. request()
  // always discards provider/network error details and disables redirects/cache.
  const long = await request(url.toString(), { method: 'GET' }, fetcher);
  const result = tokenSchema.safeParse({
    ...long,
    scope: parsed.data.permissions.join(','),
  });
  if (!result.success)
    throw new OAuthProviderError('Instagram uzun ömürlü token doğrulanamadı.');
  // Verify that the long-lived credential belongs to the code-exchange subject.
  const identity = await accountIdentity(cfg, result.data, fetcher);
  if (identity.id !== String(parsed.data.user_id))
    throw new OAuthProviderError('Instagram hesap kimliği eşleşmedi.');
  return result.data;
}
