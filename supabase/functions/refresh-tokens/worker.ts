export type Platform = 'youtube' | 'tiktok';
export type Token = {
  access_token: string;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};
export type Job = {
  id: string;
  platform: Platform;
  externalId: string;
  leaseId: string;
  token: Token;
};
export type Credentials = Partial<
  Record<Platform, { id: string; secret: string }>
>;
export interface Store {
  claim(platforms: Platform[]): Promise<Job[]>;
  finish(
    job: Job,
    result: 'ok' | 'retry' | 'error',
    token: Token | null,
    expiresAt: string | null,
  ): Promise<boolean>;
}
const record = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const text = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : null);
export async function refreshTokens(
  store: Store,
  credentials: Credentials,
  fetcher: typeof fetch = fetch,
  now: () => number = Date.now,
) {
  const platforms = (['youtube', 'tiktok'] as const).filter(
    (p) => credentials[p],
  );
  if (!platforms.length)
    return { configured: false, updated: 0, retried: 0, failed: 0, stale: 0 };
  const jobs = await store.claim(platforms);
  const result = {
    configured: true,
    updated: 0,
    retried: 0,
    failed: 0,
    stale: 0,
  };
  for (const job of jobs) {
    const cfg = credentials[job.platform];
    if (!cfg || !job.token.refresh_token) {
      await store.finish(job, 'error', null, null);
      result.failed++;
      continue;
    }
    let outcome: 'ok' | 'retry' | 'error' = 'retry';
    let token: Token | null = null;
    let expiry: string | null = null;
    try {
      const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: job.token.refresh_token,
        client_secret: cfg.secret,
        [job.platform === 'youtube' ? 'client_id' : 'client_key']: cfg.id,
      });
      const response = await fetcher(
        job.platform === 'youtube'
          ? 'https://oauth2.googleapis.com/token'
          : 'https://open.tiktokapis.com/v2/oauth/token/',
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
        },
      );
      const data = record(await response.json());
      if (response.ok && !data.error) {
        const access = text(data.access_token),
          refresh =
            text(data.refresh_token) ??
            (job.platform === 'youtube' ? job.token.refresh_token : null);
        const seconds = data.expires_in;
        if (
          !access ||
          !refresh ||
          typeof seconds !== 'number' ||
          !Number.isInteger(seconds) ||
          seconds <= 0 ||
          seconds > 366 * 86400 ||
          (job.platform === 'tiktok' && data.open_id !== job.externalId)
        )
          outcome = 'error';
        else {
          token = {
            access_token: access,
            refresh_token: refresh,
            ...((text(data.scope) ?? job.token.scope)
              ? { scope: text(data.scope) ?? job.token.scope }
              : {}),
            ...((text(data.token_type) ?? job.token.token_type)
              ? { token_type: text(data.token_type) ?? job.token.token_type }
              : {}),
          };
          expiry = new Date(now() + seconds * 1000).toISOString();
          outcome = 'ok';
        }
      } else if (
        response.status === 401 ||
        ['invalid_grant', 'invalid_token', 'access_denied'].includes(
          String(data.error),
        )
      )
        outcome = 'error';
      // Ağ, 429 ve sağlayıcı 5xx: lease bırakılır, sonraki cron tekrar dener. Gövde/anahtar loglanmaz.
    } catch {
      outcome = 'retry';
    }
    const applied = await store.finish(job, outcome, token, expiry);
    if (!applied) result.stale++;
    else if (outcome === 'ok') result.updated++;
    else if (outcome === 'error') result.failed++;
    else result.retried++;
  }
  return result;
}
