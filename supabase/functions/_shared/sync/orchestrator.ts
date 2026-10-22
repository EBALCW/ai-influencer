// Senkronizasyon orkestratörü (#53): hangi hesap/post için hangi toplayıcının çağrılacağına
// karar verir, tekrar dener, sonucu idempotent yazar ve sync_runs'a günlük düşer.
//
// Kota/rate-limit dostu: hesaplar SIRAYLA işlenir (eşzamanlılık yok), platform kapsamlı rate
// limit'te o platformun kalan hesapları bu çalışmada atlanır, süre bütçesi aşılırsa kalan iş
// bir sonraki cron çalışmasına kalır (zamanı gelen snapshot'lar pencere boyunca "due" kalır).
import {
  type CollectedMetrics,
  type CollectedPost,
  type Collector,
  type CollectorContext,
  type CollectorRegistry,
  getCollector,
  PermanentError,
  RateLimitedError,
  type SocialPlatform,
  TokenExpiredError,
  TransientError,
  type SyncAccount,
} from '../collectors/index.ts';
import type {
  DueSnapshot,
  MetricSnapshotRow,
  PostRow,
  SyncJob,
  SyncRunStatus,
  SyncStore,
} from './store.ts';

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  /** Retry-After bundan uzunsa beklenmez; iş sonraki çalışmaya kalır. */
  maxRetryAfterMs: number;
}

export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 8_000,
  maxRetryAfterMs: 30_000,
};

export interface SyncDeps {
  store: SyncStore;
  collectors: CollectorRegistry;
  fetch: typeof fetch;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  retry?: RetryPolicy;
  /** Çalışma süre bütçesi (Edge Function duvar saati sınırının altında). */
  budgetMs?: number;
  /** Tek çalışmada en fazla kaç snapshot. */
  dueLimit?: number;
  log?: (message: string) => void;
}

export interface AccountRunSummary {
  accountId: string;
  platform: SocialPlatform;
  status: SyncRunStatus;
  processed: number;
  error: string | null;
}

export interface SyncSummary {
  job: SyncJob;
  runs: AccountRunSummary[];
  /** Toplayıcısı olmayan, rate limit/süre bütçesi yüzünden atlanan hesaplar. */
  skipped: {
    accountId: string;
    reason: 'no_collector' | 'rate_limited' | 'budget';
  }[];
}

const sleepMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Hata metninden token ve token benzeri sorgu parametrelerini temizler, kısaltır. */
export function redact(
  message: string,
  secrets: (string | undefined)[] = [],
): string {
  let out = message;
  for (const s of secrets) {
    if (s && s.length >= 4) out = out.split(s).join('[gizli]');
  }
  out = out.replace(
    /((?:access|refresh)_token|client_secret|token|key)=([^&\s"']+)/gi,
    '$1=[gizli]',
  );
  out = out.replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/g, 'Bearer [gizli]');
  return out.length > 500 ? `${out.slice(0, 497)}...` : out;
}

/** Tipli hatalara göre tekrar dener: rate limit → Retry-After, geçici → üstel backoff. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  policy: RetryPolicy,
  sleep: (ms: number) => Promise<void>,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= policy.maxAttempts) throw error;
      if (error instanceof RateLimitedError) {
        const wait =
          error.retryAfterSeconds === null
            ? Math.min(
                policy.baseDelayMs * 2 ** (attempt - 1),
                policy.maxDelayMs,
              )
            : error.retryAfterSeconds * 1000;
        if (wait > policy.maxRetryAfterMs) throw error;
        await sleep(wait);
        continue;
      }
      if (error instanceof TransientError) {
        await sleep(
          Math.min(policy.baseDelayMs * 2 ** (attempt - 1), policy.maxDelayMs),
        );
        continue;
      }
      throw error;
    }
  }
}

const count = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
const decimal = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;

/** Toplayıcı çıktısı → metric_snapshots satırı. Ölçülmeyen NOT NULL alan 0 + `_unmeasured`. */
export function toMetricRow(
  due: DueSnapshot,
  metrics: CollectedMetrics,
  capturedAt: Date,
  warn: (m: string) => void,
): MetricSnapshotRow {
  const unmeasured: string[] = [];
  const required = (name: string, v: unknown) => {
    const n = count(v);
    if (n === null) unmeasured.push(name);
    return n ?? 0;
  };
  let completion = decimal(metrics.completionRate);
  if (completion !== null && completion > 1) {
    warn(`completion_rate 0–1 dışında (${completion}); NULL yazıldı`);
    completion = null;
  }
  const raw = { ...(metrics.raw ?? {}) } as Record<string, unknown>;
  const row: MetricSnapshotRow = {
    post_id: due.postId,
    captured_at: capturedAt.toISOString(),
    hours_since_publish: Math.max(
      0,
      Math.round(
        ((capturedAt.getTime() - due.publishedAt.getTime()) / 3_600_000) * 100,
      ) / 100,
    ),
    target_hours: due.targetHours,
    views: required('views', metrics.views),
    reach: count(metrics.reach),
    likes: required('likes', metrics.likes),
    comments: required('comments', metrics.comments),
    shares: required('shares', metrics.shares),
    saves: required('saves', metrics.saves),
    avg_watch_time_s: decimal(metrics.avgWatchTimeS),
    completion_rate: completion,
    raw_payload: raw,
  };
  if (unmeasured.length > 0) raw._unmeasured = unmeasured;
  return row;
}

export function toPostRow(
  accountId: string,
  post: CollectedPost,
): PostRow | null {
  const externalId =
    typeof post.externalId === 'string' ? post.externalId.trim() : '';
  const published = post.publishedAt instanceof Date ? post.publishedAt : null;
  if (!externalId || !published || Number.isNaN(published.getTime()))
    return null;
  return {
    account_id: accountId,
    external_id: externalId,
    url: typeof post.url === 'string' && post.url ? post.url : null,
    caption: typeof post.caption === 'string' ? post.caption : '',
    published_at: published.toISOString(),
    duration_s: decimal(post.durationS),
    is_short: post.isShort ?? true,
  };
}

/** UTC gün başlangıcı: hesap snapshot'ı günde bir satır. */
export function utcDay(d: Date): string {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  ).toISOString();
}

class Budget {
  constructor(
    private readonly deadline: number,
    private readonly now: () => Date,
  ) {}
  get exceeded() {
    return this.now().getTime() >= this.deadline;
  }
}

export async function runSync(
  job: SyncJob,
  deps: SyncDeps,
  opts: { accountId?: string } = {},
): Promise<SyncSummary> {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? sleepMs;
  const policy = deps.retry ?? defaultRetryPolicy;
  const log = deps.log ?? ((m: string) => console.log(m));
  const started = now();
  const budget = new Budget(
    started.getTime() + (deps.budgetMs ?? 120_000),
    now,
  );
  const summary: SyncSummary = { job, runs: [], skipped: [] };
  const limitedPlatforms = new Set<SocialPlatform>();

  // metrics işi yalnız zamanı gelen postu olan hesaplara dokunur.
  let due: DueSnapshot[] = [];
  if (job === 'metrics' || job === 'manual') {
    due = await deps.store.dueSnapshots(
      started,
      deps.dueLimit ?? 500,
      opts.accountId,
    );
  }
  let accounts = await deps.store.listAccounts(opts.accountId);
  if (job === 'metrics') {
    const withDue = new Set(due.map((d) => d.accountId));
    accounts = accounts.filter((a) => withDue.has(a.id));
  }

  for (const account of accounts) {
    const collector = getCollector(deps.collectors, account.platform);
    if (!collector) {
      summary.skipped.push({ accountId: account.id, reason: 'no_collector' });
      continue;
    }
    if (limitedPlatforms.has(account.platform)) {
      summary.skipped.push({ accountId: account.id, reason: 'rate_limited' });
      continue;
    }
    if (budget.exceeded) {
      summary.skipped.push({ accountId: account.id, reason: 'budget' });
      continue;
    }
    const result = await syncAccount(job, account, collector, {
      ...deps,
      due: due.filter((d) => d.accountId === account.id),
      now,
      sleep,
      policy,
      log,
      budget,
    });
    if (result.platformLimited) limitedPlatforms.add(account.platform);
    summary.runs.push(result.summary);
  }
  if (summary.skipped.some((s) => s.reason === 'no_collector')) {
    log(`sync ${job}: toplayıcısı olmayan platform hesapları atlandı`);
  }
  return summary;
}

interface AccountDeps extends SyncDeps {
  due: DueSnapshot[];
  now: () => Date;
  sleep: (ms: number) => Promise<void>;
  policy: RetryPolicy;
  log: (message: string) => void;
  budget: Budget;
}

async function syncAccount(
  job: SyncJob,
  account: SyncAccount,
  collector: Collector,
  deps: AccountDeps,
): Promise<{ summary: AccountRunSummary; platformLimited: boolean }> {
  const { store } = deps;
  let processed = 0;
  let quota = 0;
  let itemFailures = 0;
  let rateLimited = false;
  let platformLimited = false;
  let fatal: string | null = null;
  let lastItemError: string | null = null;
  let secrets: (string | undefined)[] = [];
  const retry = <T>(fn: () => Promise<T>) =>
    withRetry(fn, deps.policy, deps.sleep);

  const runId = await store.startRun({
    job,
    platform: account.platform,
    accountId: account.id,
  });
  try {
    const token = await store.readToken(account.id);
    if (!token) throw new TokenExpiredError('Token kasada bulunamadı', 'error');
    secrets = [token.accessToken, token.refreshToken];
    const ctx: CollectorContext = {
      account,
      token,
      fetch: deps.fetch,
      now: deps.now(),
      reportQuota: (units) => {
        if (Number.isFinite(units) && units > 0) quota += units;
      },
      warn: (m) =>
        deps.log(
          `sync ${account.platform}/${account.id}: ${redact(m, secrets)}`,
        ),
    };

    const steps: ('posts' | 'accounts' | 'metrics')[] =
      job === 'manual' ? ['posts', 'accounts', 'metrics'] : [job];
    for (const step of steps) {
      if (rateLimited) break;
      try {
        if (step === 'posts') {
          const since = await store.latestPublishedAt(account.id);
          const posts = await retry(() => collector.fetchPosts(ctx, { since }));
          const rows: PostRow[] = [];
          for (const p of posts) {
            const row = toPostRow(account.id, p);
            if (row) rows.push(row);
            else
              ctx.warn('geçersiz post atlandı (externalId/publishedAt eksik)');
          }
          if (rows.length > 0) processed += await store.upsertPosts(rows);
        } else if (step === 'accounts') {
          const a = await retry(() => collector.fetchAccount(ctx));
          await store.upsertAccountSnapshot({
            account_id: account.id,
            captured_at: utcDay(deps.now()),
            followers: count(a.followers) ?? 0,
            following: count(a.following),
            media_count: count(a.mediaCount),
            reach_day: count(a.reachDay),
            profile_views: count(a.profileViews),
            total_views: count(a.totalViews),
          });
          processed += 1;
        } else {
          const r = await collectMetrics(collector, ctx, deps, retry);
          processed += r.processed;
          itemFailures += r.failures;
          lastItemError = r.lastError ?? lastItemError;
          if (r.rateLimited) {
            rateLimited = true;
            platformLimited ||= r.platformLimited;
          }
        }
      } catch (error) {
        if (error instanceof RateLimitedError) {
          rateLimited = true;
          platformLimited ||= error.scope === 'platform';
        } else {
          throw error;
        }
      }
    }
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      fatal = redact(`Token: ${error.message}`, secrets);
      try {
        await store.setAccountStatus(account.id, error.accountStatus);
      } catch (statusError) {
        deps.log(
          `sync: hesap durumu yazılamadı (${redact(String(statusError), secrets)})`,
        );
      }
    } else {
      fatal = redact(
        error instanceof Error ? error.message : String(error),
        secrets,
      );
    }
  }

  let status: SyncRunStatus;
  let message: string | null = fatal;
  if (fatal) status = 'failed';
  else if (itemFailures > 0 && processed === 0) {
    status = 'failed';
    message = lastItemError;
  } else if (itemFailures > 0 || rateLimited) {
    status = 'partial';
    message = rateLimited
      ? 'Rate limit: kalan iş sonraki çalışmaya bırakıldı'
      : lastItemError;
  } else status = 'succeeded';

  // Başarılı toplama, önceki hatalı durumu düzeltir.
  if (status !== 'failed' && account.status === 'error') {
    try {
      await store.setAccountStatus(account.id, 'active');
    } catch (statusError) {
      deps.log(
        `sync: hesap durumu yazılamadı (${redact(String(statusError), secrets)})`,
      );
    }
  }

  try {
    await store.finishRun(runId, {
      status,
      processedCount: processed,
      quotaUnits: quota > 0 ? quota : null,
      error: message,
    });
  } catch (finishError) {
    // Satır 'running'de kalırsa private.maintain_sync_runs bir saat sonra kapatır.
    deps.log(
      `sync: günlük kapatılamadı (${redact(String(finishError), secrets)})`,
    );
  }
  return {
    summary: {
      accountId: account.id,
      platform: account.platform,
      status,
      processed,
      error: message,
    },
    platformLimited,
  };
}

async function collectMetrics(
  collector: Collector,
  ctx: CollectorContext,
  deps: AccountDeps,
  retry: <T>(fn: () => Promise<T>) => Promise<T>,
) {
  let processed = 0;
  let failures = 0;
  let lastError: string | null = null;
  for (const due of deps.due) {
    if (deps.budget.exceeded) break;
    try {
      const metrics = await retry(() =>
        collector.fetchPostMetrics(ctx, {
          id: due.postId,
          externalId: due.externalId,
          publishedAt: due.publishedAt,
          targetHours: due.targetHours,
        }),
      );
      if (!metrics) {
        ctx.warn(`post platformda bulunamadı (${due.postId})`);
        continue;
      }
      const inserted = await deps.store.insertMetricSnapshot(
        toMetricRow(due, metrics, deps.now(), ctx.warn),
      );
      if (inserted) processed += 1;
    } catch (error) {
      if (error instanceof RateLimitedError) {
        return {
          processed,
          failures,
          lastError,
          rateLimited: true,
          platformLimited: error.scope === 'platform',
        };
      }
      if (error instanceof TokenExpiredError) throw error;
      failures += 1;
      lastError = redact(
        error instanceof TransientError || error instanceof PermanentError
          ? error.message
          : `Beklenmeyen hata: ${error instanceof Error ? error.message : String(error)}`,
        [ctx.token.accessToken, ctx.token.refreshToken],
      );
    }
  }
  return {
    processed,
    failures,
    lastError,
    rateLimited: false,
    platformLimited: false,
  };
}
