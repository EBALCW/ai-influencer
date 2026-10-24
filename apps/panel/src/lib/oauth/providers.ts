import 'server-only';
import { z } from 'zod';
import type { OAuthPlatform } from './state';

export class OAuthProviderError extends Error {}
export const SCOPES = {
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
  if (platform === 'instagram')
    throw new OAuthProviderError('Instagram OAuth adaptörü henüz etkin değil.');
  const prefix = platform === 'youtube' ? 'GOOGLE' : 'TIKTOK';
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
      : 'https://www.tiktok.com/v2/auth/authorize/',
  );
  url.searchParams.set(
    cfg.platform === 'youtube' ? 'client_id' : 'client_key',
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
