// YouTube Data API v3 + YouTube Analytics API v2 için ince HTTP istemcisi (#51).
// Ağ çağrıları yalnız `ctx.fetch` ile yapılır (testlerde sahte fetch). Token `Authorization`
// başlığında gider, URL'e yazılmaz; hata mesajlarına URL, token veya yanıt gövdesi konmaz.
import {
  type CollectorContext,
  type CollectorError,
  PermanentError,
  RateLimitedError,
  TokenExpiredError,
  TransientError,
  parseRetryAfter,
} from '../collectors/types.ts';
import {
  quotaCost,
  secondsUntilQuotaReset,
  type YoutubeDataEndpoint,
} from './quota.ts';

export const YOUTUBE_DATA_BASE = 'https://www.googleapis.com/youtube/v3';
export const YOUTUBE_ANALYTICS_BASE =
  'https://youtubeanalytics.googleapis.com/v2';

type Params = Record<string, string | number | undefined>;

/** Google hata gövdesindeki makine okunur nedenler (`error.errors[].reason`, `error.status`). */
export function googleErrorReasons(body: unknown): string[] {
  if (!body || typeof body !== 'object') return [];
  const err = (body as { error?: unknown }).error;
  if (typeof err === 'string') return [err]; // OAuth uç noktası: { error: 'invalid_grant' }
  if (!err || typeof err !== 'object') return [];
  const out: string[] = [];
  const e = err as { errors?: unknown; status?: unknown; details?: unknown };
  if (Array.isArray(e.errors)) {
    for (const item of e.errors) {
      const reason = (item as { reason?: unknown })?.reason;
      if (typeof reason === 'string') out.push(reason);
    }
  }
  if (Array.isArray(e.details)) {
    for (const item of e.details) {
      const reason = (item as { reason?: unknown })?.reason;
      if (typeof reason === 'string') out.push(reason);
    }
  }
  if (typeof e.status === 'string') out.push(e.status);
  return out;
}

const QUOTA_REASONS = new Set(['quotaExceeded', 'dailyLimitExceeded']);
const RATE_REASONS = new Set([
  'rateLimitExceeded',
  'userRateLimitExceeded',
  'RATE_LIMIT_EXCEEDED',
  'RESOURCE_EXHAUSTED',
]);
const TOKEN_REASONS = new Set([
  'invalid_grant',
  'authError',
  'UNAUTHENTICATED',
]);

/**
 * HTTP hatası → tipli hata.
 * - 401 / `invalid_grant` / `authError` → TokenExpiredError (`invalid_grant` = iptal → 'error')
 * - 403|429 + quotaExceeded/dailyLimitExceeded → RateLimitedError('platform', kota sıfırlanana kadar)
 * - 403|429 + rateLimitExceeded/userRateLimitExceeded, ya da nedensiz 429 → RateLimitedError('account')
 * - 5xx / 408 → TransientError
 * - diğerleri → PermanentError (mesajda yalnız durum kodu ve neden adı)
 */
export function youtubeError(
  response: Response,
  body: unknown,
  label: string,
  now: Date,
): CollectorError {
  const status = response.status;
  const reasons = googleErrorReasons(body);
  const has = (set: Set<string>) => reasons.some((r) => set.has(r));
  const reasonText = reasons.length > 0 ? `, ${reasons[0]}` : '';

  if (reasons.includes('invalid_grant')) {
    return new TokenExpiredError(
      `${label}: yenileme yetkisi iptal edilmiş (invalid_grant)`,
      'error',
    );
  }
  if (status === 401 || has(TOKEN_REASONS)) {
    return new TokenExpiredError(`${label}: yetki reddedildi (${status})`);
  }
  if ((status === 403 || status === 429) && has(QUOTA_REASONS)) {
    return new RateLimitedError(
      `${label}: günlük YouTube kotası doldu (${status}${reasonText})`,
      secondsUntilQuotaReset(now),
      'platform',
    );
  }
  if (
    status === 429 ||
    ((status === 403 || status === 400) && has(RATE_REASONS))
  ) {
    return new RateLimitedError(
      `${label}: rate limit (${status}${reasonText})`,
      parseRetryAfter(response.headers.get('retry-after'), now),
      'account',
    );
  }
  if (status >= 500 || status === 408) {
    return new TransientError(`${label}: geçici hata (${status}${reasonText})`);
  }
  return new PermanentError(
    `${label}: istek reddedildi (${status}${reasonText})`,
  );
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request(
  ctx: CollectorContext,
  url: URL,
  label: string,
  /** Yanıt geldiğinde (durum kodundan bağımsız) bir kez çağrılır. */
  onResponse: () => void = () => {},
): Promise<unknown> {
  let response: Response;
  try {
    response = await ctx.fetch(url.toString(), {
      headers: {
        authorization: `Bearer ${ctx.token.accessToken}`,
        accept: 'application/json',
      },
    });
  } catch {
    throw new TransientError(`${label}: ağ hatası`);
  }
  onResponse();
  const body = await readJson(response);
  if (!response.ok) throw youtubeError(response, body, label, ctx.now);
  if (!body || typeof body !== 'object') {
    throw new PermanentError(`${label}: beklenmeyen yanıt biçimi`);
  }
  return body;
}

function buildUrl(base: string, path: string, params: Params): URL {
  const url = new URL(`${base}/${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }
  return url;
}

/**
 * Data API GET. Kota birimi yanıt geldikten sonra (başarılı/başarısız) raporlanır: Google
 * geçersiz isteklere de kota yazar. Ağ hatasında istek ulaşmadığı için raporlanmaz.
 */
export async function dataGet(
  ctx: CollectorContext,
  endpoint: YoutubeDataEndpoint,
  params: Params,
): Promise<Record<string, unknown>> {
  const path = endpoint.split('.')[0];
  const url = buildUrl(YOUTUBE_DATA_BASE, path, params);
  const body = await request(ctx, url, `YouTube ${endpoint}`, () =>
    ctx.reportQuota(quotaCost(endpoint)),
  );
  return body as Record<string, unknown>;
}

/** Analytics API `reports.query` (Data API kotasına sayılmaz). */
export async function analyticsQuery(
  ctx: CollectorContext,
  params: Params,
): Promise<Record<string, unknown>> {
  const url = buildUrl(YOUTUBE_ANALYTICS_BASE, 'reports', params);
  return (await request(ctx, url, 'YouTube Analytics')) as Record<
    string,
    unknown
  >;
}
