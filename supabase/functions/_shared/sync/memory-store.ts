// Testler için bellek içi SyncStore. Benzersizlik kuralları veritabanıyla aynıdır:
// posts (account_id, external_id), metric_snapshots (post_id, target_hours),
// account_snapshots (account_id, captured_at).
import type { SocialToken, SyncAccount } from '../collectors/types.ts';
import type {
  AccountSnapshotRow,
  DueSnapshot,
  MetricSnapshotRow,
  PostRow,
  SyncJob,
  SyncRunStatus,
  SyncStore,
} from './store.ts';

export interface MemoryRun {
  id: string;
  job: SyncJob;
  platform: string;
  accountId: string;
  status: 'running' | SyncRunStatus;
  processedCount: number;
  quotaUnits: number | null;
  error: string | null;
}

export class MemoryStore implements SyncStore {
  accounts: SyncAccount[] = [];
  tokens = new Map<string, SocialToken>();
  due: DueSnapshot[] = [];
  posts: (PostRow & { id: string })[] = [];
  metrics: MetricSnapshotRow[] = [];
  accountSnapshots: AccountSnapshotRow[] = [];
  runs: MemoryRun[] = [];
  statusChanges: { accountId: string; status: string }[] = [];

  listAccounts(accountId?: string) {
    return Promise.resolve(
      this.accounts.filter((a) => !accountId || a.id === accountId),
    );
  }
  readToken(accountId: string) {
    return Promise.resolve(this.tokens.get(accountId) ?? null);
  }
  dueSnapshots(_at: Date, limit: number, accountId?: string) {
    // Zaten yazılmış hedefler "due" değildir (SQL'deki NOT EXISTS).
    return Promise.resolve(
      this.due
        .filter((d) => !accountId || d.accountId === accountId)
        .filter(
          (d) =>
            !this.metrics.some(
              (m) => m.post_id === d.postId && m.target_hours === d.targetHours,
            ),
        )
        .slice(0, limit),
    );
  }
  latestPublishedAt(accountId: string) {
    const dates = this.posts
      .filter((p) => p.account_id === accountId)
      .map((p) => new Date(p.published_at).getTime());
    return Promise.resolve(dates.length ? new Date(Math.max(...dates)) : null);
  }
  upsertPosts(rows: PostRow[]) {
    for (const row of rows) {
      const i = this.posts.findIndex(
        (p) =>
          p.account_id === row.account_id && p.external_id === row.external_id,
      );
      if (i >= 0) this.posts[i] = { ...this.posts[i], ...row };
      else this.posts.push({ ...row, id: `post-${this.posts.length + 1}` });
    }
    return Promise.resolve(rows.length);
  }
  insertMetricSnapshot(row: MetricSnapshotRow) {
    if (
      row.target_hours !== null &&
      this.metrics.some(
        (m) => m.post_id === row.post_id && m.target_hours === row.target_hours,
      )
    )
      return Promise.resolve(false);
    this.metrics.push(row);
    return Promise.resolve(true);
  }
  upsertAccountSnapshot(row: AccountSnapshotRow) {
    const i = this.accountSnapshots.findIndex(
      (s) =>
        s.account_id === row.account_id && s.captured_at === row.captured_at,
    );
    if (i >= 0) this.accountSnapshots[i] = row;
    else this.accountSnapshots.push(row);
    return Promise.resolve();
  }
  setAccountStatus(accountId: string, status: 'active' | 'expired' | 'error') {
    this.statusChanges.push({ accountId, status });
    const a = this.accounts.find((x) => x.id === accountId);
    if (a && (status === 'active' || status === 'error')) a.status = status;
    return Promise.resolve();
  }
  startRun(run: { job: SyncJob; platform: string; accountId: string }) {
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
    r: {
      status: SyncRunStatus;
      processedCount: number;
      quotaUnits: number | null;
      error: string | null;
    },
  ) {
    const run = this.runs.find((x) => x.id === id);
    if (run) Object.assign(run, r);
    return Promise.resolve();
  }
}
