// Yorum işleri (#61): son 7 günün postlarındaki yorumları toplar ('fetch') ve kuyruktaki
// yanıtları gönderir ('reply'). Her hesap/yanıt için sync_runs satırı açılır; harcanan kota
// birimi oraya yazılır (#51 YouTube kota uyarısı aynı toplamı okur).
//
// Kota dostu: hesaplar ve postlar SIRAYLA işlenir; platform kapsamlı rate limit'te o
// platformun kalan hesapları atlanır; süre bütçesi aşılırsa kalan iş sonraki cron'a kalır.
// Yanıtlar asla otomatik toplu üretilmez: yalnız panelde bir insanın gönderdiği kuyruk satırı.
import {
  PermanentError,
  RateLimitedError,
  type SocialPlatform,
  type SyncAccount,
  TokenExpiredError,
  TransientError,
} from '../collectors/types.ts';
import {
  defaultRetryPolicy,
  redact,
  type RetryPolicy,
  withRetry,
} from '../sync/orchestrator.ts';
import type { SyncRunStatus } from '../sync/store.ts';
import { detectBrandInquiry } from './detect.ts';
import { type CommentAdapterRegistry, getCommentAdapter } from './index.ts';
import type { CommentRow, CommentStore, QueuedReply } from './store.ts';
import type { CollectedComment, CollectorContext } from './types.ts';

export interface CommentDeps {
  store: CommentStore;
  adapters: CommentAdapterRegistry;
  fetch: typeof fetch;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  retry?: RetryPolicy;
  budgetMs?: number;
  /** Kaç günlük yorum (varsayılan 7). */
  windowDays?: number;
  /** Hesap başına en fazla post. */
  postsPerAccount?: number;
  /** Tek çalışmada en fazla yanıt. */
  replyLimit?: number;
  log?: (message: string) => void;
}

export interface CommentRunSummary {
  accountId: string;
  platform: SocialPlatform;
  status: SyncRunStatus;
  processed: number;
  error: string | null;
}

export interface FetchSummary {
  runs: CommentRunSummary[];
  skipped: {
    accountId: string;
    reason: 'no_adapter' | 'rate_limited' | 'budget';
  }[];
}

export interface ReplySummary {
  sent: number;
  failed: number;
  requeued: number;
  skipped: number;
}

export const DEFAULT_WINDOW_DAYS = 7;
/** Bilinen en yeni yorumdan bu kadar geriye yeniden okunur (sıra/saat kaymasına karşı). */
const OVERLAP_MS = 60 * 60 * 1000;
/** Rate limit'te yanıt en fazla bu kadar kez yeniden sıraya alınır. */
export const MAX_REPLY_ATTEMPTS = 5;
const DEFAULT_REQUEUE_S = 15 * 60;

const sleepMs = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Adaptör çıktısı → comments satırı. Geçersiz/pencere dışı yorum null. */
export function toCommentRow(
  account: SyncAccount,
  postId: string,
  c: CollectedComment,
  floor: Date,
): CommentRow | null {
  const externalId =
    typeof c.externalId === 'string' ? c.externalId.trim() : '';
  const at = c.publishedAt instanceof Date ? c.publishedAt : null;
  if (!externalId || externalId.length > 200 || !at) return null;
  if (Number.isNaN(at.getTime()) || at.getTime() < floor.getTime()) return null;
  const text = typeof c.text === 'string' ? c.text.slice(0, 10_000) : '';
  const parent =
    typeof c.parentExternalId === 'string' && c.parentExternalId.trim()
      ? c.parentExternalId.trim().slice(0, 200)
      : null;
  const likes =
    typeof c.likeCount === 'number' &&
    Number.isFinite(c.likeCount) &&
    c.likeCount >= 0
      ? Math.min(Math.round(c.likeCount), 2_147_483_647)
      : null;
  return {
    post_id: postId,
    account_id: account.id,
    platform: account.platform,
    external_id: externalId,
    parent_external_id: parent,
    author_name: (typeof c.authorName === 'string' ? c.authorName : '')
      .trim()
      .slice(0, 100),
    text,
    published_at: at.toISOString(),
    like_count: likes,
    is_brand_inquiry: detectBrandInquiry(text),
  };
}

function makeCtx(
  account: SyncAccount,
  token: CollectorContext['token'],
  deps: { fetch: typeof fetch; now: () => Date; log: (m: string) => void },
  onQuota: (units: number) => void,
): CollectorContext {
  const secrets = [token.accessToken, token.refreshToken];
  return {
    account,
    token,
    fetch: deps.fetch,
    now: deps.now(),
    reportQuota: (units) => {
      if (Number.isFinite(units) && units > 0) onQuota(units);
    },
    warn: (m) =>
      deps.log(
        `comments ${account.platform}/${account.id}: ${redact(m, secrets)}`,
      ),
  };
}

const errorText = (error: unknown, secrets: (string | undefined)[]) =>
  redact(
    error instanceof TransientError ||
      error instanceof PermanentError ||
      error instanceof RateLimitedError ||
      error instanceof TokenExpiredError
      ? error.message
      : `Beklenmeyen hata: ${error instanceof Error ? error.message : String(error)}`,
    secrets,
  );

// ── Yorum toplama ───────────────────────────────────────────────────────────

export async function fetchComments(deps: CommentDeps): Promise<FetchSummary> {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? sleepMs;
  const policy = deps.retry ?? defaultRetryPolicy;
  const log = deps.log ?? ((m: string) => console.log(m));
  const started = now();
  const deadline = started.getTime() + (deps.budgetMs ?? 120_000);
  const floor = new Date(
    started.getTime() -
      (deps.windowDays ?? DEFAULT_WINDOW_DAYS) * 24 * 3_600_000,
  );
  const summary: FetchSummary = { runs: [], skipped: [] };
  const limited = new Set<SocialPlatform>();

  for (const account of await deps.store.listAccounts()) {
    const adapter = getCommentAdapter(deps.adapters, account.platform);
    if (!adapter) {
      summary.skipped.push({ accountId: account.id, reason: 'no_adapter' });
      continue;
    }
    if (limited.has(account.platform)) {
      summary.skipped.push({ accountId: account.id, reason: 'rate_limited' });
      continue;
    }
    if (now().getTime() >= deadline) {
      summary.skipped.push({ accountId: account.id, reason: 'budget' });
      continue;
    }

    const runId = await deps.store.startRun({
      job: 'comments',
      platform: account.platform,
      accountId: account.id,
    });
    let processed = 0;
    let quota = 0;
    let failures = 0;
    let lastError: string | null = null;
    let rateLimited = false;
    let fatal: string | null = null;
    let secrets: (string | undefined)[] = [];
    try {
      const token = await deps.store.readToken(account.id);
      if (!token)
        throw new TokenExpiredError('Token kasada bulunamadı', 'error');
      secrets = [token.accessToken, token.refreshToken];
      const ctx = makeCtx(
        account,
        token,
        { fetch: deps.fetch, now, log },
        (u) => {
          quota += u;
        },
      );
      const posts = await deps.store.recentPosts(
        account.id,
        floor,
        deps.postsPerAccount ?? 25,
      );
      for (const post of posts) {
        if (now().getTime() >= deadline) {
          rateLimited = true; // kalan iş sonraki çalışmaya
          lastError = 'Süre bütçesi doldu: kalan postlar sonraki çalışmada';
          break;
        }
        try {
          const latest = await deps.store.latestCommentAt(post.id);
          const since = new Date(
            Math.max(
              floor.getTime(),
              latest ? latest.getTime() - OVERLAP_MS : 0,
            ),
          );
          const collected = await withRetry(
            () => adapter.fetchComments(ctx, post, { since }),
            policy,
            sleep,
          );
          const rows: CommentRow[] = [];
          for (const c of collected) {
            const row = toCommentRow(account, post.id, c, floor);
            if (row) rows.push(row);
          }
          if (rows.length > 0)
            processed += await deps.store.upsertComments(rows);
        } catch (error) {
          if (error instanceof RateLimitedError) {
            rateLimited = true;
            lastError = 'Rate limit: kalan iş sonraki çalışmaya bırakıldı';
            if (error.scope === 'platform') limited.add(account.platform);
            break;
          }
          if (error instanceof TokenExpiredError) throw error;
          failures += 1;
          lastError = errorText(error, secrets);
        }
      }
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        fatal = redact(`Token: ${error.message}`, secrets);
        try {
          await deps.store.setAccountStatus(account.id, error.accountStatus);
        } catch (statusError) {
          log(
            `comments: hesap durumu yazılamadı (${redact(String(statusError), secrets)})`,
          );
        }
      } else {
        fatal = errorText(error, secrets);
      }
    }

    let status: SyncRunStatus;
    let message: string | null = fatal;
    if (fatal) status = 'failed';
    else if (failures > 0 && processed === 0 && !rateLimited) {
      status = 'failed';
      message = lastError;
    } else if (failures > 0 || rateLimited) {
      status = 'partial';
      message = lastError;
    } else status = 'succeeded';

    try {
      await deps.store.finishRun(runId, {
        status,
        processedCount: processed,
        quotaUnits: quota > 0 ? quota : null,
        error: message,
      });
    } catch (finishError) {
      log(
        `comments: günlük kapatılamadı (${redact(String(finishError), secrets)})`,
      );
    }
    summary.runs.push({
      accountId: account.id,
      platform: account.platform,
      status,
      processed,
      error: message,
    });
  }
  return summary;
}

// ── Yanıt gönderimi ─────────────────────────────────────────────────────────

export async function sendReplies(deps: CommentDeps): Promise<ReplySummary> {
  const now = deps.now ?? (() => new Date());
  const log = deps.log ?? ((m: string) => console.log(m));
  const deadline = now().getTime() + (deps.budgetMs ?? 120_000);
  const summary: ReplySummary = { sent: 0, failed: 0, requeued: 0, skipped: 0 };
  const accounts = new Map(
    (await deps.store.listAccounts()).map((a) => [a.id, a]),
  );
  const limited = new Set<SocialPlatform>();

  const queue = await deps.store.dueReplies(now(), deps.replyLimit ?? 20);
  for (const reply of queue) {
    if (now().getTime() >= deadline || limited.has(reply.platform)) {
      summary.skipped += 1;
      continue;
    }
    const adapter = getCommentAdapter(deps.adapters, reply.platform);
    const account = accounts.get(reply.accountId);
    if (!adapter || !account) {
      // Claim edilmeden kapatılır: platform desteklenmiyor ya da hesap bağlı değil.
      await deps.store.failReply(
        reply.id,
        adapter
          ? 'Hesap bağlı değil veya token yok; hesabı yeniden bağlayın.'
          : 'Bu platformda panelden yanıt desteklenmiyor.',
      );
      summary.failed += 1;
      continue;
    }
    if (!(await deps.store.claimReply(reply))) {
      summary.skipped += 1; // başka çalışma aldı
      continue;
    }
    const outcome = await sendOne(reply, account, adapter, deps, now, log);
    summary[outcome.kind] += 1;
    if (outcome.platformLimited) limited.add(reply.platform);
  }
  return summary;
}

async function sendOne(
  reply: QueuedReply,
  account: SyncAccount,
  adapter: NonNullable<ReturnType<typeof getCommentAdapter>>,
  deps: CommentDeps,
  now: () => Date,
  log: (m: string) => void,
): Promise<{ kind: 'sent' | 'failed' | 'requeued'; platformLimited: boolean }> {
  const runId = await deps.store.startRun({
    job: 'comment_reply',
    platform: reply.platform,
    accountId: reply.accountId,
  });
  let quota = 0;
  let secrets: (string | undefined)[] = [];
  let kind: 'sent' | 'failed' | 'requeued';
  let status: SyncRunStatus;
  let message: string | null = null;
  let platformLimited = false;
  try {
    const token = await deps.store.readToken(reply.accountId);
    if (!token) throw new TokenExpiredError('Token kasada bulunamadı', 'error');
    secrets = [token.accessToken, token.refreshToken];
    const ctx = makeCtx(
      account,
      token,
      { fetch: deps.fetch, now, log },
      (u) => {
        quota += u;
      },
    );
    // Tekrar deneme YOK: çift yanıt riski (types.ts → CommentAdapter.reply).
    const result = await adapter.reply(ctx, {
      commentExternalId: reply.commentExternalId,
      text: reply.body,
    });
    kind = 'sent';
    status = 'succeeded';
    try {
      await deps.store.completeReply(reply.id, result.externalId);
    } catch (recordError) {
      // Yanıt platformda gitti; satır 'sending'de kalır, bakım "platformda kontrol edin"
      // notuyla kapatır. Asla yeniden gönderilmez.
      message = 'Yanıt gönderildi ancak kaydı yazılamadı';
      log(
        `comments: yanıt kaydı yazılamadı (${redact(String(recordError), secrets)})`,
      );
    }
  } catch (error) {
    message = errorText(error, secrets);
    if (
      error instanceof RateLimitedError &&
      reply.attempts + 1 < MAX_REPLY_ATTEMPTS
    ) {
      // Rate limit'te istek işlenmemiştir: güvenle yeniden sıraya alınır.
      platformLimited = error.scope === 'platform';
      const wait = error.retryAfterSeconds ?? DEFAULT_REQUEUE_S;
      await deps.store.requeueReply(
        reply.id,
        new Date(now().getTime() + Math.max(60, wait) * 1000),
        message,
      );
      kind = 'requeued';
      status = 'partial';
    } else {
      if (error instanceof TokenExpiredError) {
        try {
          await deps.store.setAccountStatus(
            reply.accountId,
            error.accountStatus,
          );
        } catch (statusError) {
          log(
            `comments: hesap durumu yazılamadı (${redact(String(statusError), secrets)})`,
          );
        }
      }
      await deps.store.failReply(reply.id, message);
      kind = 'failed';
      status = 'failed';
    }
  }
  try {
    await deps.store.finishRun(runId, {
      status,
      processedCount: kind === 'sent' ? 1 : 0,
      quotaUnits: quota > 0 ? quota : null,
      error: message,
    });
  } catch (finishError) {
    log(
      `comments: günlük kapatılamadı (${redact(String(finishError), secrets)})`,
    );
  }
  return { kind, platformLimited };
}
