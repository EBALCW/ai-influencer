// Testler için bellek içi CommentStore. Kurallar veritabanıyla aynıdır: comments
// (account_id, external_id) tekil ve upsert panel durumunu korur; yanıt yalnız 'queued' iken
// alınabilir.
import type { SocialToken, SyncAccount } from '../collectors/types.ts';
import type { SyncRunStatus } from '../sync/store.ts';
import type {
  CommentJob,
  CommentRow,
  CommentStore,
  QueuedReply,
} from './store.ts';
import type { CommentPostRef } from './types.ts';

export interface MemoryComment extends CommentRow {
  id: string;
  status: 'new' | 'read' | 'replied' | 'hidden';
}

export interface MemoryReply {
  id: string;
  commentId: string;
  body: string;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  attempts: number;
  nextAttemptAt: Date;
  externalId: string | null;
  error: string | null;
}

export interface MemoryCommentRun {
  id: string;
  job: CommentJob;
  platform: string;
  accountId: string;
  status: 'running' | SyncRunStatus;
  processedCount: number;
  quotaUnits: number | null;
  error: string | null;
}

export class MemoryCommentStore implements CommentStore {
  accounts: SyncAccount[] = [];
  tokens = new Map<string, SocialToken>();
  posts: (CommentPostRef & { accountId: string })[] = [];
  comments: MemoryComment[] = [];
  replies: MemoryReply[] = [];
  runs: MemoryCommentRun[] = [];
  statusChanges: { accountId: string; status: string }[] = [];
  /** Yarış simülasyonu: true ise claimReply başka çalışma almış gibi davranır. */
  stealClaims = false;

  listAccounts() {
    return Promise.resolve([...this.accounts]);
  }
  readToken(accountId: string) {
    return Promise.resolve(this.tokens.get(accountId) ?? null);
  }
  setAccountStatus(accountId: string, status: string) {
    this.statusChanges.push({ accountId, status });
    return Promise.resolve();
  }
  recentPosts(accountId: string, since: Date, limit: number) {
    return Promise.resolve(
      this.posts
        .filter(
          (p) =>
            p.accountId === accountId &&
            p.publishedAt.getTime() >= since.getTime(),
        )
        .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
        .slice(0, limit)
        .map(({ id, externalId, publishedAt }) => ({
          id,
          externalId,
          publishedAt,
        })),
    );
  }
  latestCommentAt(postId: string) {
    const times = this.comments
      .filter((c) => c.post_id === postId)
      .map((c) => Date.parse(c.published_at));
    return Promise.resolve(times.length ? new Date(Math.max(...times)) : null);
  }
  upsertComments(rows: CommentRow[]) {
    for (const row of rows) {
      const existing = this.comments.find(
        (c) =>
          c.account_id === row.account_id && c.external_id === row.external_id,
      );
      if (existing) Object.assign(existing, row);
      else
        this.comments.push({
          ...row,
          id: crypto.randomUUID(),
          status: 'new',
        });
    }
    return Promise.resolve(rows.length);
  }

  dueReplies(at: Date, limit: number) {
    const out: QueuedReply[] = [];
    for (const r of this.replies) {
      if (r.status !== 'queued' || r.nextAttemptAt.getTime() > at.getTime())
        continue;
      const c = this.comments.find((x) => x.id === r.commentId);
      if (!c) continue;
      out.push({
        id: r.id,
        commentId: r.commentId,
        body: r.body,
        attempts: r.attempts,
        commentExternalId: c.external_id,
        accountId: c.account_id,
        platform: c.platform,
      });
    }
    return Promise.resolve(out.slice(0, limit));
  }
  claimReply(reply: QueuedReply) {
    const r = this.replies.find((x) => x.id === reply.id);
    if (!r || r.status !== 'queued' || this.stealClaims)
      return Promise.resolve(false);
    r.status = 'sending';
    r.attempts += 1;
    return Promise.resolve(true);
  }
  completeReply(id: string, externalId: string) {
    const r = this.replies.find((x) => x.id === id)!;
    r.status = 'sent';
    r.externalId = externalId;
    r.error = null;
    const c = this.comments.find((x) => x.id === r.commentId);
    if (c) c.status = 'replied';
    return Promise.resolve();
  }
  failReply(id: string, error: string) {
    const r = this.replies.find((x) => x.id === id)!;
    r.status = 'failed';
    r.error = error;
    return Promise.resolve();
  }
  requeueReply(id: string, nextAttemptAt: Date, error: string) {
    const r = this.replies.find((x) => x.id === id)!;
    r.status = 'queued';
    r.nextAttemptAt = nextAttemptAt;
    r.error = error;
    return Promise.resolve();
  }

  startRun(run: { job: CommentJob; platform: string; accountId: string }) {
    const id = `run-${this.runs.length + 1}`;
    this.runs.push({
      id,
      ...run,
      status: 'running',
      processedCount: 0,
      quotaUnits: null,
      error: null,
    });
    return Promise.resolve(id);
  }
  finishRun(
    id: string,
    result: {
      status: SyncRunStatus;
      processedCount: number;
      quotaUnits: number | null;
      error: string | null;
    },
  ) {
    Object.assign(
      this.runs.find((r) => r.id === id)!,
      result,
    );
    return Promise.resolve();
  }
}
