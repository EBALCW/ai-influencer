// Orkestratörün veritabanı sözleşmesi. Üretimde `supabase-store.ts` (service role),
// testlerde bellek içi sahte uygulama kullanılır.
import type {
  SocialPlatform,
  SocialToken,
  SyncAccount,
} from '../collectors/types.ts';

export type SyncJob = 'metrics' | 'posts' | 'accounts' | 'manual';
export type SyncRunStatus = 'succeeded' | 'failed' | 'partial';

export interface DueSnapshot {
  postId: string;
  accountId: string;
  platform: SocialPlatform;
  externalId: string;
  publishedAt: Date;
  targetHours: number;
}

export interface PostRow {
  account_id: string;
  external_id: string;
  url: string | null;
  caption: string;
  published_at: string;
  duration_s: number | null;
  is_short: boolean;
}

export interface MetricSnapshotRow {
  post_id: string;
  captured_at: string;
  hours_since_publish: number;
  target_hours: number | null;
  views: number;
  reach: number | null;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  avg_watch_time_s: number | null;
  completion_rate: number | null;
  raw_payload: Record<string, unknown>;
}

export interface AccountSnapshotRow {
  account_id: string;
  captured_at: string;
  followers: number;
  following: number | null;
  media_count: number | null;
  reach_day: number | null;
  profile_views: number | null;
  total_views: number | null;
  total_likes: number | null;
}

export interface SyncStore {
  /** status active/error ve token_ref'i olan hesaplar (accountId verilirse yalnız o). */
  listAccounts(accountId?: string): Promise<SyncAccount[]>;
  readToken(accountId: string): Promise<SocialToken | null>;
  dueSnapshots(
    at: Date,
    limit: number,
    accountId?: string,
  ): Promise<DueSnapshot[]>;
  latestPublishedAt(accountId: string): Promise<Date | null>;
  /** (account_id, external_id) upsert; yazılan satır sayısı. */
  upsertPosts(rows: PostRow[]): Promise<number>;
  /** (post_id, target_hours) çakışırsa yazmaz; false = zaten vardı. */
  insertMetricSnapshot(row: MetricSnapshotRow): Promise<boolean>;
  /** (account_id, captured_at) upsert. */
  upsertAccountSnapshot(row: AccountSnapshotRow): Promise<void>;
  setAccountStatus(
    accountId: string,
    status: 'active' | 'expired' | 'error',
  ): Promise<void>;
  startRun(run: {
    job: SyncJob;
    platform: SocialPlatform;
    accountId: string;
  }): Promise<string>;
  finishRun(
    id: string,
    result: {
      status: SyncRunStatus;
      processedCount: number;
      quotaUnits: number | null;
      error: string | null;
    },
  ): Promise<void>;
}
