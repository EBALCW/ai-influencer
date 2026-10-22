// TikTok Display API v2 için ince HTTP istemcisi (#52). Ağ çağrıları yalnız `ctx.fetch` ile
// yapılır (testlerde sahte fetch). Token `Authorization: Bearer` başlığında gider, URL'e
// yazılmaz; hata mesajlarına URL, token veya yanıt gövdesi (`error.message`) konmaz.
//
// Yanıt zarfı: `{ data: {...}, error: { code, message, log_id } }`. Başarıda `error.code`
// "ok" olur; TikTok bazı hataları HTTP 200 ile de döndürebildiği için kod her yanıtta okunur.
import {
  type CollectorContext,
  type CollectorError,
  PermanentError,
  RateLimitedError,
  TokenExpiredError,
  TransientError,
  parseRetryAfter,
} from '../collectors/types.ts';

export const TIKTOK_API_BASE = 'https://open.tiktokapis.com/v2';

export type TiktokEndpoint = 'user/info' | 'video/list' | 'video/query';

/** TikTok `error.code` (makine okunur). "ok" = başarı; yoksa null. */
export function tiktokErrorCode(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const err = (body as { error?: unknown }).error;
  if (!err || typeof err !== 'object') return null;
  const code = (err as { code?: unknown }).code;
  return typeof code === 'string' && code !== '' ? code : null;
}

const TOKEN_CODES = new Set(['access_token_invalid']);
/** Kullanıcı izni geri almış/eksik: yeniden bağlanmak gerekir → hesap `error`. */
const SCOPE_CODES = new Set([
  'scope_not_authorized',
  'scope_permission_missed',
]);
const RATE_CODES = new Set(['rate_limit_exceeded']);
const TRANSIENT_CODES = new Set(['internal_error']);

/**
 * TikTok hatası → tipli hata.
 * - `scope_not_authorized` / `scope_permission_missed` → TokenExpiredError('error') (sync_failed)
 * - 401 / `access_token_invalid` → TokenExpiredError('expired')
 * - 429 / `rate_limit_exceeded` → RateLimitedError('account'; `Retry-After` varsa o kadar)
 * - 5xx / 408 / `internal_error` → TransientError
 * - diğerleri (`invalid_params`, 403, 404 …) → PermanentError (yalnız durum kodu ve hata kodu)
 */
export function tiktokError(
  response: Response,
  body: unknown,
  label: string,
  now: Date,
): CollectorError {
  const status = response.status;
  const code = tiktokErrorCode(body);
  const detail = code ? `${status}, ${code}` : String(status);

  if (code && SCOPE_CODES.has(code)) {
    return new TokenExpiredError(
      `${label}: gerekli TikTok izni verilmemiş (${detail})`,
      'error',
    );
  }
  if (status === 401 || (code && TOKEN_CODES.has(code))) {
    return new TokenExpiredError(`${label}: yetki reddedildi (${detail})`);
  }
  if (status === 429 || (code && RATE_CODES.has(code))) {
    return new RateLimitedError(
      `${label}: rate limit (${detail})`,
      parseRetryAfter(response.headers.get('retry-after'), now),
      'account',
    );
  }
  if (status >= 500 || status === 408 || (code && TRANSIENT_CODES.has(code))) {
    return new TransientError(`${label}: geçici hata (${detail})`);
  }
  return new PermanentError(`${label}: istek reddedildi (${detail})`);
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Display API isteği. `fields` sorgu parametresinde, gövde (POST) JSON olarak gider. Her yanıt
 * (başarılı/başarısız) `ctx.reportQuota(1)` ile istek olarak sayılır: TikTok'ta birim kotası yok,
 * dakikalık istek sınırı var; `sync_runs.quota_units` TikTok için istek sayısıdır.
 * Ağ hatasında istek ulaşmadığı için sayılmaz.
 */
export async function tiktokRequest(
  ctx: CollectorContext,
  endpoint: TiktokEndpoint,
  fields: readonly string[],
  body?: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const label = `TikTok ${endpoint}`;
  const url = new URL(`${TIKTOK_API_BASE}/${endpoint}/`);
  url.searchParams.set('fields', fields.join(','));
  const headers: Record<string, string> = {
    authorization: `Bearer ${ctx.token.accessToken}`,
    accept: 'application/json',
  };
  if (body) headers['content-type'] = 'application/json';

  let response: Response;
  try {
    response = await ctx.fetch(url.toString(), {
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new TransientError(`${label}: ağ hatası`);
  }
  ctx.reportQuota(1);
  const json = await readJson(response);
  const code = tiktokErrorCode(json);
  if (!response.ok || (code !== null && code !== 'ok')) {
    throw tiktokError(response, json, label, ctx.now);
  }
  const data =
    json && typeof json === 'object'
      ? (json as { data?: unknown }).data
      : undefined;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new PermanentError(`${label}: beklenmeyen yanıt biçimi`);
  }
  return data as Record<string, unknown>;
}
